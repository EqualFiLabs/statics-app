import {
  staticsBasketConversionAbi,
  type ReviewedBasketConversionMarket,
} from "@statics-protocol/sdk/basket-conversion";
import {
  getAddress,
  keccak256,
  parseAbi,
  toFunctionSelector,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

export type PhaseTwoMarket = Omit<ReviewedBasketConversionMarket, "basketId" | "chainId"> & {
  basketId: string;
  name: string;
  symbol: string;
};
type ContractIdentity = { address: Address; runtimeCodeHash: Hex };

export type PhaseTwoManifest = {
  version: 1;
  chainId: number;
  protocolCommit: string;
  diamond: ContractIdentity;
  deploymentBlock: string;
  conversionFacet: ContractIdentity;
  redemptionFacet: ContractIdentity;
  basketViewFacet: ContractIdentity;
  hook: ContractIdentity;
  zap: ContractIdentity;
  router: ContractIdentity;
  poolManager: ContractIdentity;
  quoter: ContractIdentity;
  quote: ContractIdentity;
  markets: readonly PhaseTwoMarket[];
};

const loupeAbi = parseAbi(["function facetAddress(bytes4) view returns (address)"]);
export const phaseTwoExitAbi = parseAbi([
  "function isBasketAssetImpaired(uint256,address) view returns (bool)",
  "function quoteRedeem(uint256,uint256) view returns (uint256[])",
  "function quoteRedeemImpaired(uint256,uint256) view returns (uint256[])",
  "function redeem(uint256,uint256,address,uint256[]) returns (uint256[])",
  "function redeemImpaired(uint256,uint256,address,uint256[]) returns (uint256[])",
]);

async function phaseTwoBlock(client: PublicClient, manifest: PhaseTwoManifest) {
  if (
    manifest.version !== 1 ||
    (await client.getChainId()) !== manifest.chainId ||
    !/^[a-f0-9]{40}$/i.test(manifest.protocolCommit)
  ) {
    throw new Error("The Phase 2 deployment does not match this network.");
  }
  const blockNumber = await client.getBlockNumber();
  if (blockNumber < BigInt(manifest.deploymentBlock))
    throw new Error("Phase 2 is not active at this block.");
  return blockNumber;
}

async function verifyRuntime(
  client: PublicClient,
  identities: ContractIdentity[],
  blockNumber: bigint
) {
  await Promise.all(
    identities.map(async ({ address, runtimeCodeHash }) => {
      const code = await client.getCode({ address, blockNumber });
      if (!code || keccak256(code).toLowerCase() !== runtimeCodeHash.toLowerCase()) {
        throw new Error("Phase 2 runtime differs from the reviewed release.");
      }
    })
  );
}

export async function verifyPhaseTwoExit(client: PublicClient, manifest: PhaseTwoManifest) {
  const blockNumber = await phaseTwoBlock(client, manifest);
  await verifyRuntime(
    client,
    [manifest.diamond, manifest.redemptionFacet, manifest.basketViewFacet],
    blockNumber
  );
  await Promise.all(
    phaseTwoExitAbi.map(async (item) => {
      const actual = await client.readContract({
        address: manifest.diamond.address,
        abi: loupeAbi,
        functionName: "facetAddress",
        args: [toFunctionSelector(item)],
        blockNumber,
      });
      const expected =
        item.name === "isBasketAssetImpaired" ? manifest.basketViewFacet : manifest.redemptionFacet;
      if (getAddress(actual) !== getAddress(expected.address)) {
        throw new Error("Phase 2 redemption selectors differ from the reviewed release.");
      }
    })
  );
  return blockNumber;
}

export async function verifyPhaseTwo(client: PublicClient, manifest: PhaseTwoManifest) {
  const blockNumber = await phaseTwoBlock(client, manifest);
  await verifyRuntime(
    client,
    [
      manifest.diamond,
      manifest.conversionFacet,
      manifest.hook,
      manifest.zap,
      manifest.router,
      manifest.poolManager,
      manifest.quoter,
      manifest.quote,
    ],
    blockNumber
  );
  const [config, ...facets] = await Promise.all([
    client.readContract({
      address: manifest.diamond.address,
      abi: staticsBasketConversionAbi,
      functionName: "basketConversionConfiguration",
      blockNumber,
    }),
    ...staticsBasketConversionAbi
      .filter((item) => item.type === "function")
      .map((item) =>
        client.readContract({
          address: manifest.diamond.address,
          abi: loupeAbi,
          functionName: "facetAddress",
          args: [toFunctionSelector(item)],
          blockNumber,
        })
      ),
  ] as const);
  for (const key of ["hook", "zap", "router", "poolManager"] as const) {
    if (getAddress(config[key]) !== getAddress(manifest[key].address))
      throw new Error("Phase 2 configuration changed.");
  }
  if (facets.some((facet) => getAddress(facet) !== getAddress(manifest.conversionFacet.address))) {
    throw new Error("Phase 2 conversion selectors differ from the reviewed release.");
  }
}

export function reviewPhaseTwoMarket(
  manifest: PhaseTwoManifest,
  market: PhaseTwoMarket
): ReviewedBasketConversionMarket {
  if (getAddress(market.quote) !== getAddress(manifest.quote.address))
    throw new Error("Unknown quote asset.");
  return { ...market, chainId: manifest.chainId, basketId: BigInt(market.basketId) };
}

import {
  encodeFunctionData,
  erc20Abi,
  getAddress,
  parseAbi,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import {
  buildActivateProtocolPoolPolTransaction,
  buildAppendPoolRewardAssetCall,
  buildClaimCreatorRevenueCall,
  buildFundPoolRewardCall,
  buildSetPoolRewardAllocatorShareCall,
  buildSettleProtocolPoolRevenueCall,
  staticsRangeGaugeAbi,
  staticsSwapFeeHookAbi,
} from "@statics-protocol/sdk/phase-one";
import type { PhaseOneDeployment, PublicPoolToken } from "@/lib/deployments/types";
import type { IndexedPublicPool } from "@/lib/indexer/phase-one";
import { boundedGaugeRead } from "@/lib/rewards/gauge-reads";
import { isNativeCurrency } from "@/lib/phase-one/liquidity";

/**
 * Creator controls for public (General) Statics pools. Signatures follow the deployed
 * `IStaticsProtocolRevenue`; the SDK has no ABI entries for these yet.
 */
export const creatorAbi = parseAbi([
  "function poolCreatorConfiguration(bytes32 poolId) view returns (address creator, address pendingCreator, address revenueRecipient)",
  "function creatorRevenue(bytes32 poolId, address asset) view returns (uint256 amount)",
  "function protocolPolFundingConfig(bytes32 poolId) view returns (bool activated, bool overridden, uint16 shareBps)",
  "function protocolPolActivationFee() view returns (uint256 fee)",
  "function rewardRestricted(address asset) view returns (bool restricted)",
  "function setCreatorRevenueRecipient(bytes32 poolId, address recipient)",
  "function proposePoolCreator(bytes32 poolId, address newCreator)",
  "function acceptPoolCreator(bytes32 poolId)",
]);
const hookWethAbi = parseAbi(["function weth() view returns (address)"]);

/** Slot 0 streams protocol STATICS; creators append up to four more reward tokens. */
export const STATICS_REWARD_SLOT = 0;
export const MAX_REWARD_SLOTS = 5;

export type CreatorPool = Readonly<{
  poolId: Hex;
  poolKey: IndexedPublicPool["poolKey"];
  token0: PublicPoolToken;
  token1: PublicPoolToken;
}>;

export type RewardSlot = Readonly<{
  slot: number;
  asset: Address;
  allocatorShareBps: number;
  periodFinish: bigint;
  remaining: bigint;
}>;

export type CreatorPoolState = Readonly<{
  creator: Address;
  pendingCreator: Address | null;
  recipient: Address;
  /** Unsettled creator share held by the hook, per pool currency (native stays native). */
  pending: readonly Readonly<{ currency: Address; amount: bigint }>[];
  /** Settled creator credit, per claim asset (native settles as WETH). */
  settled: readonly Readonly<{ asset: Address; amount: bigint }>[];
  polActivated: boolean;
  polFee: bigint;
}>;

/** Candidate pools from the indexer; ownership is always confirmed on-chain before use. */
export function indexedCreatorPools(
  pools: readonly IndexedPublicPool[],
  wallet: Address
): IndexedPublicPool[] {
  return pools.filter((pool) => pool.creator.toLowerCase() === wallet.toLowerCase());
}

/** Settlement wraps native revenue, so its credit is claimed as WETH. */
export function claimAsset(currency: Address, weth: Address): Address {
  return isNativeCurrency(currency) ? weth : getAddress(currency);
}

export async function readRevenueWeth(
  client: PublicClient,
  deployment: PhaseOneDeployment
): Promise<Address> {
  return boundedGaugeRead(client, () =>
    client.readContract({
      address: deployment.contracts.publicHook,
      abi: hookWethAbi,
      functionName: "weth",
    })
  );
}

export async function readPoolRewards(
  client: PublicClient,
  deployment: PhaseOneDeployment,
  poolId: Hex
): Promise<{
  rewards: RewardSlot[];
  rewardDuration: bigint;
  now: bigint;
  fundingEnabled: boolean;
}> {
  const diamond = deployment.contracts.diamond;
  const [config, rewardDuration, block, gauge] = await Promise.all([
    boundedGaugeRead(client, () =>
      client.readContract({
        address: diamond,
        abi: staticsRangeGaugeAbi,
        functionName: "poolRewardConfig",
        args: [poolId],
      })
    ),
    boundedGaugeRead(client, () =>
      client.readContract({
        address: diamond,
        abi: staticsRangeGaugeAbi,
        functionName: "gaugeRewardDuration",
      })
    ),
    client.getBlock(),
    boundedGaugeRead(client, () =>
      client.readContract({
        address: diamond,
        abi: staticsRangeGaugeAbi,
        functionName: "gaugePool",
        args: [poolId],
      })
    ),
  ]);
  const count = Math.min(Number(config.slotCount), MAX_REWARD_SLOTS);
  const streams = await Promise.all(
    Array.from({ length: count }, (_, slot) =>
      boundedGaugeRead(client, () =>
        client.readContract({
          address: diamond,
          abi: staticsRangeGaugeAbi,
          functionName: "poolRewardStream",
          args: [poolId, slot],
        })
      )
    )
  );
  const rewards = streams.map((stream, slot) => ({
    slot,
    asset: getAddress(config.assets[slot]!),
    allocatorShareBps: Number(config.allocatorShareBps[slot]),
    periodFinish: BigInt(stream.periodFinish),
    remaining:
      stream.periodBudget > stream.periodEmitted ? stream.periodBudget - stream.periodEmitted : 0n,
  }));
  return {
    rewards,
    rewardDuration: BigInt(rewardDuration),
    now: block.timestamp,
    fundingEnabled: gauge.initialized && !gauge.stopped,
  };
}

export async function readCreatorPool(
  client: PublicClient,
  deployment: PhaseOneDeployment,
  pool: CreatorPool,
  weth: Address
): Promise<CreatorPoolState> {
  const diamond = deployment.contracts.diamond;
  const currencies = [pool.poolKey.currency0, pool.poolKey.currency1].map((c) => getAddress(c));
  // An ETH/WETH pool settles both currencies into the same WETH credit.
  const assets = [...new Set(currencies.map((currency) => claimAsset(currency, weth)))];
  const [configuration, pending, settled, pol, polFee] = await Promise.all([
    boundedGaugeRead(client, () =>
      client.readContract({
        address: diamond,
        abi: creatorAbi,
        functionName: "poolCreatorConfiguration",
        args: [pool.poolId],
      })
    ),
    Promise.all(
      currencies.map((currency) =>
        boundedGaugeRead(client, () =>
          client.readContract({
            address: deployment.contracts.publicHook,
            abi: staticsSwapFeeHookAbi,
            functionName: "pendingFeeDistribution",
            args: [pool.poolId, currency],
          })
        )
      )
    ),
    Promise.all(
      assets.map((asset) =>
        boundedGaugeRead(client, () =>
          client.readContract({
            address: diamond,
            abi: creatorAbi,
            functionName: "creatorRevenue",
            args: [pool.poolId, asset],
          })
        )
      )
    ),
    boundedGaugeRead(client, () =>
      client.readContract({
        address: diamond,
        abi: creatorAbi,
        functionName: "protocolPolFundingConfig",
        args: [pool.poolId],
      })
    ),
    boundedGaugeRead(client, () =>
      client.readContract({
        address: diamond,
        abi: creatorAbi,
        functionName: "protocolPolActivationFee",
      })
    ),
  ]);
  const [creator, pendingCreator, recipient] = configuration;
  return {
    creator: getAddress(creator),
    pendingCreator: pendingCreator === zeroAddress ? null : getAddress(pendingCreator),
    recipient: getAddress(recipient),
    pending: currencies.map((currency, index) => ({ currency, amount: pending[index]!.creator })),
    settled: assets.map((asset, index) => ({ asset, amount: settled[index]! })),
    polActivated: pol[0],
    polFee,
  };
}

/** Reward tokens the protocol allows and has not restricted, from the known token list. */
export async function readAllowedRewardTokens(
  client: PublicClient,
  deployment: PhaseOneDeployment,
  tokens: readonly PublicPoolToken[]
): Promise<PublicPoolToken[]> {
  const candidates = tokens.filter((token) => !isNativeCurrency(token.address));
  const flags = await Promise.all(
    candidates.map((token) =>
      Promise.all([
        boundedGaugeRead(client, () =>
          client.readContract({
            address: deployment.contracts.diamond,
            abi: staticsRangeGaugeAbi,
            functionName: "gaugeRewardAssetAllowed",
            args: [token.address],
          })
        ),
        boundedGaugeRead(client, () =>
          client.readContract({
            address: deployment.contracts.diamond,
            abi: creatorAbi,
            functionName: "rewardRestricted",
            args: [token.address],
          })
        ),
      ])
    )
  );
  return candidates.filter((_, index) => flags[index]![0] && !flags[index]![1]);
}

export type CreatorCall = Readonly<{ to: Address; data: Hex; value: bigint }>;
const call = (deployment: PhaseOneDeployment, data: Hex, value = 0n): CreatorCall => ({
  to: deployment.contracts.diamond,
  data,
  value,
});

export const creatorCalls = {
  settle: (deployment: PhaseOneDeployment, poolId: Hex, currency: Address) =>
    call(deployment, buildSettleProtocolPoolRevenueCall(poolId, currency)),
  /** Pays only the configured recipient; any caller may submit it. */
  claim: (
    deployment: PhaseOneDeployment,
    poolId: Hex,
    asset: Address,
    recipient: Address,
    minimum: bigint
  ) => call(deployment, buildClaimCreatorRevenueCall(poolId, asset, recipient, minimum)),
  setRecipient: (deployment: PhaseOneDeployment, poolId: Hex, recipient: Address) =>
    call(
      deployment,
      encodeFunctionData({
        abi: creatorAbi,
        functionName: "setCreatorRevenueRecipient",
        args: [poolId, recipient],
      })
    ),
  propose: (deployment: PhaseOneDeployment, poolId: Hex, next: Address) =>
    call(
      deployment,
      encodeFunctionData({
        abi: creatorAbi,
        functionName: "proposePoolCreator",
        args: [poolId, next],
      })
    ),
  accept: (deployment: PhaseOneDeployment, poolId: Hex) =>
    call(
      deployment,
      encodeFunctionData({ abi: creatorAbi, functionName: "acceptPoolCreator", args: [poolId] })
    ),
  /** `msg.value` must equal the activation fee exactly. */
  activatePol: (deployment: PhaseOneDeployment, poolId: Hex, fee: bigint) => {
    const prepared = buildActivateProtocolPoolPolTransaction(poolId, fee);
    return call(deployment, prepared.data, prepared.value);
  },
  appendReward: (deployment: PhaseOneDeployment, poolId: Hex, asset: Address) =>
    call(deployment, buildAppendPoolRewardAssetCall(poolId, asset)),
  setAllocatorShare: (deployment: PhaseOneDeployment, poolId: Hex, slot: number, bps: number) =>
    call(deployment, buildSetPoolRewardAllocatorShareCall(poolId, slot, bps)),
  fund: (
    deployment: PhaseOneDeployment,
    poolId: Hex,
    slot: number,
    amount: bigint,
    minRemainingDuration: bigint,
    expectedAllocatorShareBps: number
  ) =>
    call(
      deployment,
      buildFundPoolRewardCall(poolId, slot, amount, minRemainingDuration, expectedAllocatorShareBps)
    ),
  approve: (token: Address, spender: Address, amount: bigint): CreatorCall => ({
    to: token,
    data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] }),
    value: 0n,
  }),
};

/** Known pool tokens first; anything else (WETH for a native pool) is read from the token. */
export async function resolveTokens(
  client: PublicClient,
  addresses: readonly Address[],
  known: ReadonlyMap<string, PublicPoolToken>
): Promise<Map<string, PublicPoolToken>> {
  const result = new Map(known);
  const missing = [...new Set(addresses.map((a) => a.toLowerCase()))].filter((a) => !result.has(a));
  const read = await Promise.all(
    missing.map(async (lower) => {
      const address = getAddress(lower);
      const [symbol, name, decimals] = await Promise.allSettled([
        boundedGaugeRead(client, () =>
          client.readContract({ address, abi: erc20Abi, functionName: "symbol" })
        ),
        boundedGaugeRead(client, () =>
          client.readContract({ address, abi: erc20Abi, functionName: "name" })
        ),
        boundedGaugeRead(client, () =>
          client.readContract({ address, abi: erc20Abi, functionName: "decimals" })
        ),
      ]);
      if (decimals.status !== "fulfilled") return null;
      return {
        address,
        symbol:
          symbol.status === "fulfilled"
            ? symbol.value.trim().slice(0, 16) || `${address.slice(0, 6)}…`
            : `${address.slice(0, 6)}…`,
        name: name.status === "fulfilled" ? name.value.trim().slice(0, 64) : address,
        decimals: decimals.value,
        metadataSource: "onchain-import",
      } satisfies PublicPoolToken;
    })
  );
  for (const token of read) if (token) result.set(token.address.toLowerCase(), token);
  return result;
}

export function knownTokens(
  pools: readonly Readonly<{ token0: PublicPoolToken; token1: PublicPoolToken }>[]
): Map<string, PublicPoolToken> {
  const map = new Map<string, PublicPoolToken>();
  for (const pool of pools)
    for (const token of [pool.token0, pool.token1]) map.set(token.address.toLowerCase(), token);
  return map;
}

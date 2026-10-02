import { getAddress, keccak256, type PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import { v4PoolId } from "@statics-protocol/sdk";

import {
  parsePhaseOneDeploymentManifest,
  phaseOneFacetFingerprint,
  type PhaseOneDeploymentManifest,
} from "@/lib/deployments/phase-one-manifest";
import { verifyPhaseOneDeployment } from "@/lib/deployments/verify-phase-one";

const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const runtimeCode = "0x6000" as const;
const runtimeCodeHash = keccak256(runtimeCode);

function fixture() {
  const contracts = {
    diamond: { address: address("1"), runtimeCodeHash },
    timelock: { address: address("2"), runtimeCodeHash },
    publicHook: { address: address("3"), runtimeCodeHash },
    liquidityManager: { address: address("4"), runtimeCodeHash },
    statics: { address: address("5"), runtimeCodeHash },
    weth: { address: address("6"), runtimeCodeHash },
    poolManager: { address: address("7"), runtimeCodeHash },
    positionManager: { address: address("8"), runtimeCodeHash },
    permit2: { address: address("9"), runtimeCodeHash },
    quoter: { address: address("a"), runtimeCodeHash },
    stateView: { address: address("b"), runtimeCodeHash },
    universalRouter: { address: address("c"), runtimeCodeHash },
  } as const;
  const facets = [{ address: address("d"), runtimeCodeHash, selectors: ["0x12345678"] }];
  const poolKey = {
    currency0: contracts.statics.address,
    currency1: contracts.weth.address,
    fee: 10_000,
    tickSpacing: 8,
    hooks: contracts.publicHook.address,
  } as const;
  const manifest: PhaseOneDeploymentManifest = {
    schemaVersion: 1,
    deploymentId: "phase-one-fixture",
    network: "Fixture",
    chainId: 4_663,
    deploymentStartBlock: "1",
    protocolCommit: "1".repeat(40),
    sdkCommit: "2".repeat(40),
    installedPhase: 1,
    contracts,
    facetFingerprint: phaseOneFacetFingerprint(
      facets.map((facet) => ({
        ...facet,
        selectors: facet.selectors as readonly `0x${string}`[],
      }))
    ),
    facets,
    supportedPools: [
      {
        poolId: v4PoolId(poolKey),
        poolKey,
        token0: {
          address: contracts.statics.address,
          name: "Statics",
          symbol: "STATICS",
          decimals: 18,
        },
        token1: {
          address: contracts.weth.address,
          name: "Wrapped Ether",
          symbol: "WETH",
          decimals: 18,
        },
        enabled: true,
        registrationBlock: "2",
      },
    ],
  };
  return parsePhaseOneDeploymentManifest(manifest, "development-fixture");
}

function client(wrongHookDiamond = false): PublicClient {
  const deployment = fixture();
  const { contracts } = deployment;
  return {
    chain: { id: 4_663 },
    getCode: vi.fn().mockResolvedValue(runtimeCode),
    readContract: vi.fn(async ({ address: target, functionName }) => {
      const key = `${target.toLowerCase()}:${String(functionName)}`;
      const values: Record<string, unknown> = {
        [`${contracts.publicHook.toLowerCase()}:staticsDiamond`]: wrongHookDiamond
          ? address("f")
          : contracts.diamond,
        [`${contracts.publicHook.toLowerCase()}:poolManager`]: contracts.poolManager,
        [`${contracts.publicHook.toLowerCase()}:poolRegistration`]: {
          currency0: contracts.statics,
          currency1: contracts.weth,
          kind: 1,
          creator: address("e"),
          registered: true,
        },
        [`${contracts.liquidityManager.toLowerCase()}:staticsDiamond`]: contracts.diamond,
        [`${contracts.liquidityManager.toLowerCase()}:positionManager`]: contracts.positionManager,
        [`${contracts.liquidityManager.toLowerCase()}:poolManager`]: contracts.poolManager,
        [`${contracts.liquidityManager.toLowerCase()}:permit2`]: contracts.permit2,
        [`${contracts.quoter.toLowerCase()}:poolManager`]: contracts.poolManager,
        [`${contracts.stateView.toLowerCase()}:poolManager`]: contracts.poolManager,
        [`${contracts.stateView.toLowerCase()}:getSlot0`]: [1n, 0, 0, 10_000],
        [`${contracts.universalRouter.toLowerCase()}:poolManager`]: contracts.poolManager,
        [`${contracts.diamond.toLowerCase()}:facets`]: [
          { facetAddress: address("d"), functionSelectors: ["0x12345678"] },
        ],
      };
      if (!(key in values)) throw new Error(`Unexpected read ${key}`);
      return values[key];
    }),
  } as unknown as PublicClient;
}

describe("Phase 1 deployment verification", () => {
  it("verifies runtime identities, immutable bindings, facets, and pools", async () => {
    await expect(verifyPhaseOneDeployment(client(), fixture())).resolves.toBeUndefined();
  });

  it("fails closed on a mismatched immutable binding", async () => {
    await expect(verifyPhaseOneDeployment(client(true), fixture())).rejects.toThrow(
      "Public hook Diamond binding"
    );
  });
});

import { getAddress, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";

import { v4PoolId } from "@statics-protocol/sdk";

import {
  parsePhaseOneDeploymentManifest,
  phaseOneFacetFingerprint,
  type PhaseOneDeploymentManifest,
} from "@/lib/deployments/phase-one-manifest";
import {
  LOCAL_PHASE_ONE_DEPLOYMENT_ID,
  deploymentRegistry,
  hasCapability,
} from "@/lib/deployments/registry";

const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const hash = (digit: string) => `0x${digit.repeat(64)}` as const;

function manifest(): PhaseOneDeploymentManifest {
  const contracts = {
    diamond: { address: address("1"), runtimeCodeHash: hash("1") },
    timelock: { address: address("2"), runtimeCodeHash: hash("2") },
    publicHook: { address: address("3"), runtimeCodeHash: hash("3") },
    liquidityManager: { address: address("4"), runtimeCodeHash: hash("4") },
    statics: { address: address("5"), runtimeCodeHash: hash("5") },
    weth: { address: address("6"), runtimeCodeHash: hash("6") },
    poolManager: { address: address("7"), runtimeCodeHash: hash("7") },
    positionManager: { address: address("8"), runtimeCodeHash: hash("8") },
    permit2: { address: address("9"), runtimeCodeHash: hash("9") },
    quoter: { address: address("a"), runtimeCodeHash: hash("a") },
    stateView: { address: address("b"), runtimeCodeHash: hash("b") },
    universalRouter: { address: address("c"), runtimeCodeHash: hash("c") },
  } as const;
  const facets = [
    {
      address: address("d"),
      runtimeCodeHash: hash("d"),
      selectors: ["0x12345678" as const],
    },
  ];
  const poolKey = {
    currency0: contracts.statics.address,
    currency1: contracts.weth.address,
    fee: 10_000,
    tickSpacing: 8,
    hooks: contracts.publicHook.address,
  } as const;
  return {
    schemaVersion: 1,
    deploymentId: LOCAL_PHASE_ONE_DEPLOYMENT_ID,
    network: "Local Anvil",
    chainId: 31_337,
    deploymentStartBlock: "10",
    protocolCommit: "1".repeat(40),
    sdkCommit: "2".repeat(40),
    installedPhase: 1,
    contracts,
    facetFingerprint: phaseOneFacetFingerprint(facets),
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
        registrationBlock: "11",
      },
    ],
  };
}

describe("Phase 1 deployment manifest", () => {
  it("parses exact facets and PoolKeys into a deployment-scoped registry", () => {
    const deployment = parsePhaseOneDeploymentManifest(manifest(), "development-fixture");
    expect(deployment.installedPhase).toBe(1);
    expect(deployment.supportedPools[0]?.poolId).toBe(
      v4PoolId(deployment.supportedPools[0]!.poolKey)
    );
    expect(deployment.supportedPools[0]?.provenance.deploymentId).toBe(
      LOCAL_PHASE_ONE_DEPLOYMENT_ID
    );
    expect(hasCapability(deployment, "public-direct-swaps")).toBe(true);
    expect(hasCapability(deployment, "genesis-position-linking")).toBe(false);
  });

  it("accepts configured addresses and pools without optional provenance inventories", () => {
    const source = manifest();
    const minimal = {
      ...source,
      facets: undefined,
      facetFingerprint: undefined,
      contracts: Object.fromEntries(
        Object.entries(source.contracts).map(([name, value]) => [name, { address: value.address }])
      ),
    } as PhaseOneDeploymentManifest;
    const parsed = parsePhaseOneDeploymentManifest(minimal);
    expect(parsed.runtimeCodeHashes).toEqual({});
    expect(parsed.facets).toEqual([]);
    expect(parsed.supportedPools).toHaveLength(1);
  });

  it("rejects a mismatched fingerprint, hook, or PoolId", () => {
    expect(() =>
      parsePhaseOneDeploymentManifest({ ...manifest(), facetFingerprint: hash("f") })
    ).toThrow("facet fingerprint");

    const wrongHook = manifest();
    expect(() =>
      parsePhaseOneDeploymentManifest({
        ...wrongHook,
        supportedPools: [
          {
            ...wrongHook.supportedPools[0]!,
            poolKey: { ...wrongHook.supportedPools[0]!.poolKey, hooks: zeroAddress },
          },
        ],
      })
    ).toThrow("reviewed public hook");

    const wrongPool = manifest();
    expect(() =>
      parsePhaseOneDeploymentManifest({
        ...wrongPool,
        supportedPools: [{ ...wrongPool.supportedPools[0]!, poolId: hash("f") }],
      })
    ).toThrow("PoolId");
  });

  it("rejects missing and unexpected contract identities from untyped JSON", () => {
    const missing = manifest() as unknown as Record<string, unknown>;
    const missingContracts = { ...(missing.contracts as Record<string, unknown>) };
    delete missingContracts.quoter;
    expect(() =>
      parsePhaseOneDeploymentManifest({
        ...missing,
        contracts: missingContracts,
      } as unknown as PhaseOneDeploymentManifest)
    ).toThrow("contract quoter is required");

    const extra = manifest();
    expect(() =>
      parsePhaseOneDeploymentManifest({
        ...extra,
        contracts: {
          ...extra.contracts,
          unsafeRouter: extra.contracts.universalRouter,
        },
      } as PhaseOneDeploymentManifest)
    ).toThrow("Unsupported Phase 1 contract unsafeRouter");
  });

  it("composes a local Phase 1 deployment without requiring a Genesis fixture", () => {
    const phaseOne = manifest();
    const options = deploymentRegistry({
      NEXT_PUBLIC_APP_ENV: "development",
      NEXT_PUBLIC_APP_NETWORK: "anvil",
      NEXT_PUBLIC_STATICS_LOCAL_PHASE_ONE_MANIFEST: JSON.stringify(phaseOne),
    });
    const local = options.find((option) => option.networkId === "anvil");
    expect(local?.launch).toBeNull();
    expect(local?.phaseOne?.descriptor.deploymentId).toBe(LOCAL_PHASE_ONE_DEPLOYMENT_ID);
    expect(local?.descriptor.stage).toBe("phase-one");
    expect(local?.descriptor.capabilities).toContain("market-tape");
  });

  it("loads local Phase 1 on the mainnet fork chain ID", () => {
    const phaseOne = { ...manifest(), chainId: 4_663 };
    const options = deploymentRegistry({
      NEXT_PUBLIC_APP_ENV: "development",
      NEXT_PUBLIC_APP_NETWORK: "anvil",
      NEXT_PUBLIC_ANVIL_CHAIN_ID: "4663",
      NEXT_PUBLIC_STATICS_LOCAL_PHASE_ONE_MANIFEST: JSON.stringify(phaseOne),
    });
    expect(options[0].phaseOne?.descriptor.chainId).toBe(4_663);
    expect(options[0].phaseOne?.source).toBe("development-fixture");
    expect(options[0].descriptor.capabilities).toContain("market-tape");
  });
});

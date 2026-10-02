import { getAddress, isHash, keccak256, stringToHex, type Address, type Hex } from "viem";

import { v4PoolId } from "@statics-protocol/sdk";

import type {
  DeploymentDescriptor,
  PhaseOneContractName,
  PhaseOneDeployment,
  PhaseOneFacet,
  PublicPoolToken,
  SupportedPublicPool,
} from "@/lib/deployments/types";

type ManifestContract = Readonly<{ address: string; runtimeCodeHash: string }>;

export type PhaseOneDeploymentManifest = Readonly<{
  schemaVersion: 1;
  deploymentId: string;
  network: string;
  chainId: number;
  deploymentStartBlock: string;
  protocolCommit: string;
  sdkCommit: string;
  installedPhase: 1;
  contracts: Readonly<Record<PhaseOneContractName, ManifestContract>>;
  facetFingerprint: string;
  facets: readonly Readonly<{
    address: string;
    runtimeCodeHash: string;
    selectors: readonly string[];
  }>[];
  supportedPools: readonly Readonly<{
    poolId: string;
    poolKey: Readonly<{
      currency0: string;
      currency1: string;
      fee: number;
      tickSpacing: number;
      hooks: string;
    }>;
    token0: Readonly<{
      address: string;
      name: string;
      symbol: string;
      decimals: number;
      logoUri?: string;
    }>;
    token1: Readonly<{
      address: string;
      name: string;
      symbol: string;
      decimals: number;
      logoUri?: string;
    }>;
    enabled: boolean;
    registrationBlock: string;
  }>[];
}>;

const phaseOneCapabilities = [
  "overview",
  "wallet",
  "activity",
  "approval-tools",
  "positions",
  "protocol-liquidity",
  "protocol-rewards",
  "public-market-discovery",
  "public-direct-swaps",
  "public-lp-positions",
  "position-staking",
  "range-gauges",
  "gauge-allocations",
  "global-rewards",
  "lp-rewards",
  "allocator-rewards",
  "market-tape",
  "public-maintenance",
] as const;

function address(value: string, field: string): Address {
  try {
    return getAddress(value);
  } catch {
    throw new Error(`${field} must be a valid EVM address.`);
  }
}

function hash(value: string, field: string): Hex {
  if (!isHash(value)) throw new Error(`${field} must be a 32-byte hash.`);
  return value;
}

function commit(value: string, field: string): string {
  if (!/^[a-f0-9]{40}$/iu.test(value)) throw new Error(`${field} must be a 40-character commit.`);
  return value.toLowerCase();
}

function positiveBlock(value: string, field: string): bigint {
  const parsed = BigInt(value);
  if (parsed < 0n) throw new Error(`${field} must not be negative.`);
  return parsed;
}

function token(
  value: PhaseOneDeploymentManifest["supportedPools"][number]["token0"],
  field: string
): PublicPoolToken {
  if (!value.name.trim() || !value.symbol.trim()) {
    throw new Error(`${field} requires a name and symbol.`);
  }
  if (!Number.isInteger(value.decimals) || value.decimals < 0 || value.decimals > 255) {
    throw new Error(`${field}.decimals must fit uint8.`);
  }
  return {
    address: address(value.address, `${field}.address`),
    name: value.name.trim(),
    symbol: value.symbol.trim(),
    decimals: value.decimals,
    logoUri: value.logoUri,
    metadataSource: "reviewed-manifest",
  };
}

function normalizedFacetRows(facets: readonly PhaseOneFacet[]): string[] {
  return facets
    .map((facet) => {
      const selectors = [...facet.selectors].map((selector) => selector.toLowerCase()).sort();
      return `${facet.address.toLowerCase()}:${facet.runtimeCodeHash.toLowerCase()}:${selectors.join(",")}`;
    })
    .sort();
}

export function phaseOneFacetFingerprint(facets: readonly PhaseOneFacet[]): Hex {
  return keccak256(stringToHex(normalizedFacetRows(facets).join("|")));
}

export function parsePhaseOneDeploymentManifest(
  manifest: PhaseOneDeploymentManifest,
  source: PhaseOneDeployment["source"] = "checked-in-manifest"
): PhaseOneDeployment {
  if (manifest.schemaVersion !== 1) throw new Error("Unsupported Phase 1 manifest schema.");
  if (!manifest.deploymentId.trim()) throw new Error("Phase 1 deploymentId is required.");
  if (!Number.isSafeInteger(manifest.chainId) || manifest.chainId <= 0) {
    throw new Error("Phase 1 chainId must be a positive integer.");
  }
  if (manifest.installedPhase !== 1)
    throw new Error("The manifest must identify installed Phase 1.");

  const protocolCommit = commit(manifest.protocolCommit, "protocolCommit");
  const sdkCommit = commit(manifest.sdkCommit, "sdkCommit");
  const contracts = Object.fromEntries(
    Object.entries(manifest.contracts).map(([name, entry]) => [
      name,
      address(entry.address, `contracts.${name}.address`),
    ])
  ) as Record<PhaseOneContractName, Address>;
  const runtimeCodeHashes = Object.fromEntries(
    Object.entries(manifest.contracts).map(([name, entry]) => [
      name,
      hash(entry.runtimeCodeHash, `contracts.${name}.runtimeCodeHash`),
    ])
  ) as Record<PhaseOneContractName, Hex>;

  const seenFacetAddresses = new Set<string>();
  const seenSelectors = new Set<string>();
  const facets = manifest.facets.map((entry, index): PhaseOneFacet => {
    const facetAddress = address(entry.address, `facets.${index}.address`);
    const addressKey = facetAddress.toLowerCase();
    if (seenFacetAddresses.has(addressKey))
      throw new Error("Phase 1 facet addresses must be unique.");
    seenFacetAddresses.add(addressKey);
    if (entry.selectors.length === 0) throw new Error("Every Phase 1 facet requires selectors.");
    const selectors = entry.selectors.map((value, selectorIndex) => {
      if (!/^0x[a-f0-9]{8}$/iu.test(value)) {
        throw new Error(`facets.${index}.selectors.${selectorIndex} must be bytes4.`);
      }
      const selector = value.toLowerCase() as Hex;
      if (seenSelectors.has(selector))
        throw new Error("Phase 1 selectors must be globally unique.");
      seenSelectors.add(selector);
      return selector;
    });
    return {
      address: facetAddress,
      runtimeCodeHash: hash(entry.runtimeCodeHash, `facets.${index}.runtimeCodeHash`),
      selectors,
    };
  });
  if (facets.length === 0) throw new Error("The Phase 1 facet inventory is required.");
  const facetFingerprint = hash(manifest.facetFingerprint, "facetFingerprint");
  if (phaseOneFacetFingerprint(facets).toLowerCase() !== facetFingerprint.toLowerCase()) {
    throw new Error("Phase 1 facet fingerprint does not match the facet inventory.");
  }

  const seenPoolIds = new Set<string>();
  const supportedPools = manifest.supportedPools.map((entry, index): SupportedPublicPool => {
    const poolKey = {
      currency0: address(entry.poolKey.currency0, `supportedPools.${index}.poolKey.currency0`),
      currency1: address(entry.poolKey.currency1, `supportedPools.${index}.poolKey.currency1`),
      fee: entry.poolKey.fee,
      tickSpacing: entry.poolKey.tickSpacing,
      hooks: address(entry.poolKey.hooks, `supportedPools.${index}.poolKey.hooks`),
    };
    if (poolKey.currency0.toLowerCase() >= poolKey.currency1.toLowerCase()) {
      throw new Error("Phase 1 pool currencies must use canonical address order.");
    }
    if (!Number.isInteger(poolKey.fee) || poolKey.fee < 0 || poolKey.fee > 0xffffff) {
      throw new Error("Phase 1 pool fee must fit uint24.");
    }
    if (!Number.isInteger(poolKey.tickSpacing) || poolKey.tickSpacing <= 0) {
      throw new Error("Phase 1 pool tick spacing must be positive.");
    }
    if (poolKey.hooks.toLowerCase() !== contracts.publicHook.toLowerCase()) {
      throw new Error("Every supported Phase 1 pool must use the reviewed public hook.");
    }
    const poolId = hash(entry.poolId, `supportedPools.${index}.poolId`);
    if (v4PoolId(poolKey).toLowerCase() !== poolId.toLowerCase()) {
      throw new Error("Phase 1 PoolId does not match its PoolKey.");
    }
    if (seenPoolIds.has(poolId.toLowerCase())) throw new Error("Phase 1 PoolIds must be unique.");
    seenPoolIds.add(poolId.toLowerCase());
    const token0 = token(entry.token0, `supportedPools.${index}.token0`);
    const token1 = token(entry.token1, `supportedPools.${index}.token1`);
    if (
      token0.address.toLowerCase() !== poolKey.currency0.toLowerCase() ||
      token1.address.toLowerCase() !== poolKey.currency1.toLowerCase()
    ) {
      throw new Error("Phase 1 token metadata must match PoolKey currency order.");
    }
    return {
      poolId,
      poolKey,
      token0,
      token1,
      enabled: entry.enabled,
      provenance: {
        deploymentId: manifest.deploymentId,
        protocolCommit,
        registrationBlock: positiveBlock(
          entry.registrationBlock,
          `supportedPools.${index}.registrationBlock`
        ),
      },
    };
  });

  const descriptor: DeploymentDescriptor = {
    deploymentId: manifest.deploymentId,
    label: "Statics Phase 1",
    network: manifest.network,
    chainId: manifest.chainId,
    stage: "phase-one",
    capabilities: phaseOneCapabilities,
    available: true,
  };
  return {
    kind: "phase-one",
    descriptor,
    deploymentStartBlock: positiveBlock(manifest.deploymentStartBlock, "deploymentStartBlock"),
    protocolCommit,
    sdkCommit,
    installedPhase: 1,
    source,
    contracts,
    runtimeCodeHashes,
    facetFingerprint,
    facets,
    supportedPools,
  };
}

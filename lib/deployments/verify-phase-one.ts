import { getAddress, keccak256, parseAbi, type Address, type Hex, type PublicClient } from "viem";

import {
  staticsLiquidityManagerAbi,
  staticsSwapFeeHookAbi,
  universalRouterAbi,
  v4QuoterAbi,
  v4StateViewReadAbi,
} from "@statics-protocol/sdk/phase-one";

import { phaseOneFacetFingerprint } from "@/lib/deployments/phase-one-manifest";
import type { PhaseOneDeployment, PhaseOneFacet } from "@/lib/deployments/types";

const diamondLoupeAbi = parseAbi([
  "function facets() view returns ((address facetAddress,bytes4[] functionSelectors)[] facets_)",
]);

const runtimeVerificationCache = new Map<string, Promise<void>>();
const bindingVerificationCache = new Map<string, Promise<void>>();

function same(left: Address, right: Address): boolean {
  return getAddress(left) === getAddress(right);
}

function requireAddress(actual: Address, expected: Address, label: string): void {
  if (!same(actual, expected)) throw new Error(`${label} does not match the reviewed manifest.`);
}

function cacheKey(deployment: PhaseOneDeployment): string {
  return [
    deployment.descriptor.chainId,
    deployment.descriptor.deploymentId,
    deployment.protocolCommit,
    deployment.sdkCommit,
    deployment.facetFingerprint,
  ].join(":");
}

function requireSelectedChain(publicClient: PublicClient, deployment: PhaseOneDeployment): void {
  if (publicClient.chain && publicClient.chain.id !== deployment.descriptor.chainId) {
    throw new Error("The RPC chain does not match the selected Phase 1 deployment.");
  }
}

async function requireRuntime(
  publicClient: PublicClient,
  address: Address,
  expected: Hex,
  label: string
): Promise<void> {
  const code = await publicClient.getCode({ address });
  if (!code || code === "0x" || keccak256(code).toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`${label} runtime code does not match the reviewed Phase 1 manifest.`);
  }
}

async function verifyRuntimeCode(
  publicClient: PublicClient,
  deployment: PhaseOneDeployment
): Promise<void> {
  await Promise.all([
    ...Object.entries(deployment.runtimeCodeHashes).map(([name, expected]) =>
      requireRuntime(
        publicClient,
        deployment.contracts[name as keyof typeof deployment.contracts],
        expected,
        name
      )
    ),
    ...deployment.facets.map((facet, index) =>
      requireRuntime(publicClient, facet.address, facet.runtimeCodeHash, `facet ${index}`)
    ),
  ]);
}

async function verifyBindings(
  publicClient: PublicClient,
  deployment: PhaseOneDeployment
): Promise<void> {
  const contracts = deployment.contracts;
  const [
    hookDiamond,
    hookPoolManager,
    managerDiamond,
    managerPositionManager,
    managerPoolManager,
    managerPermit2,
    quoterPoolManager,
    stateViewPoolManager,
    routerPoolManager,
  ] = await Promise.all([
    publicClient.readContract({
      address: contracts.publicHook,
      abi: staticsSwapFeeHookAbi,
      functionName: "staticsDiamond",
    }),
    publicClient.readContract({
      address: contracts.publicHook,
      abi: staticsSwapFeeHookAbi,
      functionName: "poolManager",
    }),
    publicClient.readContract({
      address: contracts.liquidityManager,
      abi: staticsLiquidityManagerAbi,
      functionName: "staticsDiamond",
    }),
    publicClient.readContract({
      address: contracts.liquidityManager,
      abi: staticsLiquidityManagerAbi,
      functionName: "positionManager",
    }),
    publicClient.readContract({
      address: contracts.liquidityManager,
      abi: staticsLiquidityManagerAbi,
      functionName: "poolManager",
    }),
    publicClient.readContract({
      address: contracts.liquidityManager,
      abi: staticsLiquidityManagerAbi,
      functionName: "permit2",
    }),
    publicClient.readContract({
      address: contracts.quoter,
      abi: v4QuoterAbi,
      functionName: "poolManager",
    }),
    publicClient.readContract({
      address: contracts.stateView,
      abi: v4StateViewReadAbi,
      functionName: "poolManager",
    }),
    publicClient.readContract({
      address: contracts.universalRouter,
      abi: universalRouterAbi,
      functionName: "poolManager",
    }),
  ]);
  requireAddress(hookDiamond, contracts.diamond, "Public hook Diamond binding");
  requireAddress(hookPoolManager, contracts.poolManager, "Public hook PoolManager binding");
  requireAddress(managerDiamond, contracts.diamond, "Liquidity manager Diamond binding");
  requireAddress(
    managerPositionManager,
    contracts.positionManager,
    "Liquidity manager PositionManager binding"
  );
  requireAddress(
    managerPoolManager,
    contracts.poolManager,
    "Liquidity manager PoolManager binding"
  );
  requireAddress(managerPermit2, contracts.permit2, "Liquidity manager Permit2 binding");
  requireAddress(quoterPoolManager, contracts.poolManager, "Quoter PoolManager binding");
  requireAddress(stateViewPoolManager, contracts.poolManager, "StateView PoolManager binding");
  requireAddress(routerPoolManager, contracts.poolManager, "Universal Router PoolManager binding");

  const liveFacets = await publicClient.readContract({
    address: contracts.diamond,
    abi: diamondLoupeAbi,
    functionName: "facets",
  });
  const runtimeByAddress = new Map(
    deployment.facets.map((facet) => [facet.address.toLowerCase(), facet.runtimeCodeHash])
  );
  const normalized: PhaseOneFacet[] = liveFacets.map((facet) => {
    const runtimeCodeHash = runtimeByAddress.get(facet.facetAddress.toLowerCase());
    if (!runtimeCodeHash) throw new Error("The live Diamond contains an unreviewed facet.");
    return {
      address: getAddress(facet.facetAddress),
      runtimeCodeHash,
      selectors: facet.functionSelectors,
    };
  });
  if (normalized.length !== deployment.facets.length) {
    throw new Error("The live Diamond facet count does not match the Phase 1 manifest.");
  }
  if (
    phaseOneFacetFingerprint(normalized).toLowerCase() !== deployment.facetFingerprint.toLowerCase()
  ) {
    throw new Error("The live Diamond selectors do not match the reviewed Phase 1 fingerprint.");
  }

  await Promise.all(
    deployment.supportedPools.map(async (pool) => {
      const [registration, slot0] = await Promise.all([
        publicClient.readContract({
          address: contracts.publicHook,
          abi: staticsSwapFeeHookAbi,
          functionName: "poolRegistration",
          args: [pool.poolId],
        }),
        publicClient.readContract({
          address: contracts.stateView,
          abi: v4StateViewReadAbi,
          functionName: "getSlot0",
          args: [pool.poolId],
        }),
      ]);
      requireAddress(registration.currency0, pool.poolKey.currency0, "Pool currency0 registration");
      requireAddress(registration.currency1, pool.poolKey.currency1, "Pool currency1 registration");
      if (!registration.registered) throw new Error("A reviewed Phase 1 pool is not registered.");
      if (slot0[0] === 0n) throw new Error("A reviewed Phase 1 pool is not initialized.");
    })
  );
}

export async function verifyPhaseOneDeployment(
  publicClient: PublicClient,
  deployment: PhaseOneDeployment
): Promise<void> {
  requireSelectedChain(publicClient, deployment);
  await verifyRuntimeCode(publicClient, deployment);
  await verifyBindings(publicClient, deployment);
}

export async function verifyPhaseOneDeploymentCached(
  publicClient: PublicClient,
  deployment: PhaseOneDeployment
): Promise<void> {
  requireSelectedChain(publicClient, deployment);
  const key = cacheKey(deployment);
  let runtime = runtimeVerificationCache.get(key);
  if (!runtime) {
    runtime = verifyRuntimeCode(publicClient, deployment);
    runtimeVerificationCache.set(key, runtime);
  }
  try {
    await runtime;
  } catch (error) {
    runtimeVerificationCache.delete(key);
    throw error;
  }

  let bindings = bindingVerificationCache.get(key);
  if (!bindings) {
    bindings = verifyBindings(publicClient, deployment);
    bindingVerificationCache.set(key, bindings);
  }
  try {
    await bindings;
  } catch (error) {
    bindingVerificationCache.delete(key);
    throw error;
  }
}

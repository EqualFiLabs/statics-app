import { decodeFunctionResult, getAddress, type Address, type PublicClient } from "viem";
import { buildQuoteV4ExactInputSingleCall, v4QuoterAbi } from "@statics-protocol/sdk";

import type { DeploymentOption, LaunchPoolKey } from "@/lib/deployments/types";
import type { EvmSwapToken } from "@/lib/portal/uniswap";
import {
  buildQuoteV4ExactInputCall,
  candidatePaths,
  v4PathQuoterAbi,
  type PathHop,
} from "@/lib/trade/v4-path";
import {
  canonicalTradeDirection,
  poolKeyForLaunch,
  settlementForTrade,
  tokenAddress,
  zeroForTrade,
} from "@/lib/trade/canonical-market";

export type DirectSwapRoute = Readonly<{
  kind: "direct";
  id: string;
  chainId: number;
  deploymentId: string;
  phaseOne: boolean;
  poolKey: LaunchPoolKey;
  quoter: Address;
  router: Address;
  permit2: Address;
  inputToken: Address;
  zeroForOne: boolean;
  settlement:
    | Readonly<{ input: "erc20"; output: "erc20" }>
    | Readonly<{ input: "native"; output: "erc20"; wrappedNative: Address }>
    | Readonly<{ input: "erc20"; output: "native"; wrappedNative: Address }>;
  /**
   * Multi-pool candidates when no single pool trades the pair. Each is quoted; the best one is
   * executed. `poolKey` and `zeroForOne` are unused for these routes.
   */
  paths?: readonly (readonly PathHop[])[];
}>;

export type SwapRoute =
  | DirectSwapRoute
  | Readonly<{ kind: "uniswap"; id: string; chainId: number; deploymentId: string }>;

/** Select one route locally. Quoting a supported pool never fans out to routing APIs. */
export function selectSwapRoute(
  active: DeploymentOption,
  chainId: number,
  source: EvmSwapToken,
  destination: EvmSwapToken,
  includePhaseOne = true,
  /** Reviewed and verified discovered Phase 1 pools; defaults to the reviewed manifest. */
  pools?: readonly Readonly<{
    poolId: `0x${string}`;
    poolKey: LaunchPoolKey;
    swappable: boolean;
    reviewed?: boolean;
  }>[]
): SwapRoute {
  const launch = active.launch?.descriptor.chainId === chainId ? active.launch : null;
  const direction = canonicalTradeDirection(launch, source, destination);
  if (launch && direction) {
    return {
      kind: "direct",
      id: `${launch.descriptor.deploymentId}:${launch.market.poolId}`,
      chainId,
      deploymentId: launch.descriptor.deploymentId,
      phaseOne: false,
      poolKey: poolKeyForLaunch(launch),
      quoter: launch.contracts.quoter,
      router: launch.contracts.universalRouter,
      permit2: launch.contracts.permit2,
      inputToken: tokenAddress(launch, direction.input),
      zeroForOne: zeroForTrade(launch, direction.input),
      settlement: settlementForTrade(launch, direction),
    };
  }
  const phaseOne =
    includePhaseOne && active.phaseOne?.descriptor.chainId === chainId ? active.phaseOne : null;
  if (phaseOne) {
    const input = getAddress(source.kind === "native" ? phaseOne.contracts.weth : source.address);
    const output = getAddress(
      destination.kind === "native" ? phaseOne.contracts.weth : destination.address
    );
    const candidates =
      pools ?? phaseOne.supportedPools.map((pool) => ({ ...pool, swappable: pool.enabled }));
    const pool = candidates.find(
      (candidate) =>
        candidate.swappable &&
        ((getAddress(candidate.poolKey.currency0) === input &&
          getAddress(candidate.poolKey.currency1) === output) ||
          (getAddress(candidate.poolKey.currency1) === input &&
            getAddress(candidate.poolKey.currency0) === output))
    );
    if (pool) {
      return {
        kind: "direct",
        id: `${phaseOne.descriptor.deploymentId}:${pool.poolId}`,
        chainId,
        deploymentId: phaseOne.descriptor.deploymentId,
        phaseOne: true,
        poolKey: pool.poolKey,
        quoter: phaseOne.contracts.quoter,
        router: phaseOne.contracts.universalRouter,
        permit2: phaseOne.contracts.permit2,
        inputToken: input,
        zeroForOne: getAddress(pool.poolKey.currency0) === input,
        settlement:
          source.kind === "native"
            ? { input: "native", output: "erc20", wrappedNative: phaseOne.contracts.weth }
            : destination.kind === "native"
              ? { input: "erc20", output: "native", wrappedNative: phaseOne.contracts.weth }
              : { input: "erc20", output: "erc20" },
      };
    }
    // No single pool trades the pair: route through two or three Statics pools.
    const paths = candidatePaths(input, output, candidates);
    if (paths.length && input !== output) {
      const first = candidates.find((candidate) => candidate.poolId === paths[0]![0]!.poolId)!;
      return {
        kind: "direct",
        id: `${phaseOne.descriptor.deploymentId}:path:${input}:${output}:${paths.map((path) => path.map((hop) => hop.poolId.toLowerCase()).join(",")).join(";")}`,
        chainId,
        deploymentId: phaseOne.descriptor.deploymentId,
        phaseOne: true,
        poolKey: first.poolKey,
        quoter: phaseOne.contracts.quoter,
        router: phaseOne.contracts.universalRouter,
        permit2: phaseOne.contracts.permit2,
        inputToken: input,
        zeroForOne: false,
        settlement:
          source.kind === "native"
            ? { input: "native", output: "erc20", wrappedNative: phaseOne.contracts.weth }
            : destination.kind === "native"
              ? { input: "erc20", output: "native", wrappedNative: phaseOne.contracts.weth }
              : { input: "erc20", output: "erc20" },
        paths,
      };
    }
  }
  return {
    kind: "uniswap",
    id: `uniswap:${chainId}`,
    chainId,
    deploymentId: active.descriptor.deploymentId,
  };
}

/** The quoter itself determines executability; no deployment or reward preflight is needed. */
export async function quoteDirectSwap(
  publicClient: PublicClient,
  route: DirectSwapRoute,
  amountIn: bigint,
  account: Address
): Promise<bigint> {
  const result = await publicClient.call({
    account,
    to: route.quoter,
    data: buildQuoteV4ExactInputSingleCall(route.poolKey, route.zeroForOne, amountIn),
  });
  if (!result.data) throw new Error("No swap quote is available.");
  const [amountOut] = decodeFunctionResult({
    abi: v4QuoterAbi,
    functionName: "quoteExactInputSingle",
    data: result.data,
  });
  if (amountOut <= 0n) throw new Error("No swap quote is available.");
  return amountOut;
}

/**
 * Quote a route. A single-pool route quotes its pool; a multi-pool route quotes each candidate
 * path and returns the best, which is the path to execute.
 */
export async function quoteSwapRoute(
  publicClient: PublicClient,
  route: DirectSwapRoute,
  amountIn: bigint,
  account: Address
): Promise<{ amountOut: bigint; path?: readonly PathHop[] }> {
  if (!route.paths?.length)
    return { amountOut: await quoteDirectSwap(publicClient, route, amountIn, account) };
  const quotes = await Promise.all(
    route.paths.map(async (path) => {
      try {
        const result = await publicClient.call({
          account,
          to: route.quoter,
          data: buildQuoteV4ExactInputCall(route.inputToken, path, amountIn),
        });
        if (!result.data) return null;
        const [amountOut] = decodeFunctionResult({
          abi: v4PathQuoterAbi,
          functionName: "quoteExactInput",
          data: result.data,
        });
        return amountOut > 0n ? { amountOut, path } : null;
      } catch {
        // A path that cannot fill this amount (thin liquidity, a paused pool) is skipped.
        return null;
      }
    })
  );
  const best = quotes
    .filter((quote): quote is NonNullable<typeof quote> => quote !== null)
    .sort((a, b) => (a.amountOut === b.amountOut ? 0 : a.amountOut > b.amountOut ? -1 : 1))[0];
  if (!best) throw new Error("No swap quote is available.");
  return best;
}

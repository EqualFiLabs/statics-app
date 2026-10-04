import { decodeFunctionResult, getAddress, type Address, type PublicClient } from "viem";
import { buildQuoteV4ExactInputSingleCall, v4QuoterAbi } from "@statics-protocol/sdk";

import type { DeploymentOption, LaunchPoolKey } from "@/lib/deployments/types";
import type { EvmSwapToken } from "@/lib/portal/uniswap";
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
  includePhaseOne = true
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
    const pool = phaseOne.supportedPools.find(
      (candidate) =>
        candidate.enabled &&
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

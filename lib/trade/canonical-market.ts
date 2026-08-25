import { encodeFunctionData, getAddress, type Address, type Hex } from "viem";

import { dopplerStaticsTokenAbi, type V4PoolKey } from "@statics-protocol/sdk";

import type { LaunchDeployment } from "@/lib/deployments/types";
import { MAX_ERC20_ALLOWANCE } from "@/lib/protocol/approvals";

export type TradeAsset = "eth" | "weth" | "statics";
export type TradeDirection = Readonly<{ input: TradeAsset; output: TradeAsset }>;
export type CanonicalToken = Readonly<{
  address: Address;
  kind: "native" | "erc20";
}>;

export const tradeDirections: readonly TradeDirection[] = [
  { input: "eth", output: "statics" },
  { input: "weth", output: "statics" },
  { input: "statics", output: "weth" },
  { input: "statics", output: "eth" },
];

export function tradeSymbol(asset: TradeAsset): "ETH" | "WETH" | "STATICS" {
  if (asset === "eth") return "ETH";
  if (asset === "weth") return "WETH";
  return "STATICS";
}

function canonicalAsset(
  deployment: LaunchDeployment,
  token: CanonicalToken | undefined
): TradeAsset | null {
  if (!token) return null;
  if (token.kind === "native") return "eth";
  if (getAddress(token.address) === getAddress(deployment.contracts.statics)) return "statics";
  if (getAddress(token.address) === getAddress(deployment.contracts.weth)) return "weth";
  return null;
}

export function canonicalTradeDirection(
  deployment: LaunchDeployment | null,
  source: CanonicalToken | undefined,
  destination: CanonicalToken | undefined
): TradeDirection | null {
  if (!deployment) return null;
  const input = canonicalAsset(deployment, source);
  const output = canonicalAsset(deployment, destination);
  if (!input || !output || input === output) return null;
  if (input !== "statics" && output !== "statics") return null;
  return { input, output };
}

export function poolKeyForLaunch(deployment: LaunchDeployment): V4PoolKey {
  return {
    currency0: deployment.market.poolKey.currency0,
    currency1: deployment.market.poolKey.currency1,
    fee: deployment.market.poolKey.fee,
    tickSpacing: deployment.market.poolKey.tickSpacing,
    hooks: deployment.market.poolKey.hooks,
  };
}

export function tokenAddress(deployment: LaunchDeployment, asset: TradeAsset): Address {
  return asset === "statics" ? deployment.contracts.statics : deployment.contracts.weth;
}

export function zeroForTrade(deployment: LaunchDeployment, input: TradeAsset): boolean {
  const address = tokenAddress(deployment, input).toLowerCase();
  if (deployment.market.poolKey.currency0.toLowerCase() === address) return true;
  if (deployment.market.poolKey.currency1.toLowerCase() === address) return false;
  throw new Error("The selected input is not part of the reviewed STATICS market.");
}

export function settlementForTrade(
  deployment: LaunchDeployment,
  direction: TradeDirection
):
  | Readonly<{ input: "erc20"; output: "erc20" }>
  | Readonly<{ input: "native"; output: "erc20"; wrappedNative: Address }>
  | Readonly<{ input: "erc20"; output: "native"; wrappedNative: Address }> {
  if (direction.input === "eth") {
    return { input: "native", output: "erc20", wrappedNative: deployment.contracts.weth };
  }
  if (direction.output === "eth") {
    return { input: "erc20", output: "native", wrappedNative: deployment.contracts.weth };
  }
  return { input: "erc20", output: "erc20" };
}

export function maximumTokenApproval(spender: Address): Hex {
  return encodeFunctionData({
    abi: dopplerStaticsTokenAbi,
    functionName: "approve",
    args: [getAddress(spender), MAX_ERC20_ALLOWANCE],
  });
}

/**
 * The timestamp a swap deadline should be measured from.
 *
 * A deadline has to outlive the block the transaction actually lands in, not
 * the last one that happened to be mined. Three clocks can disagree, and each
 * is the right answer in some situation:
 *
 *   - `latest` leads on a fork whose time has been advanced past wall clock,
 *     which is how the Genesis Epoch gets tested.
 *   - `pending` leads where the node exposes the block being assembled.
 *   - wall clock leads on a fork sitting idle: Anvil mines only on activity, so
 *     the latest block can be arbitrarily stale while the next one jumps to
 *     real time. Anchoring to `latest` alone made every swap after a quiet
 *     period longer than the TTL revert with TransactionDeadlinePassed.
 *
 * Taking the greatest is correct in all three: a deadline that is further out
 * than necessary costs nothing, while one that is short reverts.
 */
export function swapDeadlineBase(
  latestTimestamp: bigint,
  pendingTimestamp: bigint | null,
  wallClockSeconds: bigint
): bigint {
  let base = latestTimestamp;
  if (pendingTimestamp !== null && pendingTimestamp > base) base = pendingTimestamp;
  if (wallClockSeconds > base) base = wallClockSeconds;
  return base;
}

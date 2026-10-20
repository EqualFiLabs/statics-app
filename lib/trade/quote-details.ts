import { getAddress, parseAbi, zeroAddress, type Address, type Hex, type PublicClient } from "viem";
import { v4PoolId } from "@statics-protocol/sdk/phase-one";
import type { LaunchPoolKey } from "@/lib/deployments/types";
import type { PathHop } from "@/lib/trade/v4-path";

const PIPS = 1_000_000n;
const Q192 = 1n << 192n;
/** v4 marks a dynamic LP fee with this flag in `PoolKey.fee`. */
const DYNAMIC_FEE_FLAG = 0x800000;
/** v4 hook permission bits: return deltas let a hook take an amount from the swap itself. */
const BEFORE_SWAP_FLAG = 1n << 7n;
const BEFORE_SWAP_RETURNS_DELTA_FLAG = 1n << 3n;
const AFTER_SWAP_RETURNS_DELTA_FLAG = 1n << 2n;

const stateViewAbi = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
]);
const staticsHookAbi = parseAbi([
  "function poolFeeRate(bytes32 poolId) view returns ((uint16 inputFeePips, uint16 outputFeePips, bool overridden) rate)",
]);

export type ImpactHop = Readonly<{
  poolId: Hex;
  zeroForOne: boolean;
  fee: number;
  hooks: Address;
}>;

export type PricedHop = Readonly<{
  zeroForOne: boolean;
  sqrtPriceX96: bigint;
  /** v4 swap fee: protocol fee for this direction combined with the LP fee. */
  swapFeePips: bigint;
  /** Statics hook fee on the input (before the pool) and the output (after it). */
  inputFeePips: bigint;
  outputFeePips: bigint;
}>;

/** The pools a direct route trades through, in order, with each pool's direction. */
export function routeHops(
  route: Readonly<{ inputToken: Address; poolKey: LaunchPoolKey; zeroForOne: boolean }>,
  path?: readonly PathHop[]
): ImpactHop[] {
  if (!path?.length)
    return [
      {
        poolId: v4PoolId(route.poolKey),
        zeroForOne: route.zeroForOne,
        fee: route.poolKey.fee,
        hooks: getAddress(route.poolKey.hooks),
      },
    ];
  let currencyIn = BigInt(route.inputToken);
  return path.map((hop) => {
    const next = BigInt(hop.intermediateCurrency);
    const zeroForOne = currencyIn < next;
    currencyIn = next;
    return { poolId: hop.poolId, zeroForOne, fee: hop.fee, hooks: getAddress(hop.hooks) };
  });
}

/** `protocolFee + lpFee - protocolFee * lpFee / 1e6`, as v4-core's ProtocolFeeLibrary. */
export function v4SwapFee(protocolFee: number, lpFee: number, zeroForOne: boolean): bigint {
  const directional = BigInt(zeroForOne ? protocolFee & 0xfff : protocolFee >> 12);
  const lp = BigInt(lpFee & 0xffffff);
  return directional + lp - (directional * lp) / PIPS;
}

/** Output at today's pool prices after every fee: what the trade would get with no price impact. */
export function noImpactOutput(amountIn: bigint, hops: readonly PricedHop[]): bigint {
  let amount = amountIn;
  for (const hop of hops) {
    amount = (amount * (PIPS - hop.inputFeePips)) / PIPS;
    amount = (amount * (PIPS - hop.swapFeePips)) / PIPS;
    const squared = hop.sqrtPriceX96 * hop.sqrtPriceX96;
    amount = hop.zeroForOne ? (amount * squared) / Q192 : (amount * Q192) / squared;
    amount = (amount * (PIPS - hop.outputFeePips)) / PIPS;
  }
  return amount;
}

/** Percent of output lost to moving the price, fees excluded. Never negative. */
export function priceImpactPercent(
  amountIn: bigint,
  amountOut: bigint,
  hops: readonly PricedHop[]
) {
  const ideal = noImpactOutput(amountIn, hops);
  if (ideal <= 0n || amountOut >= ideal) return 0;
  // Basis points of a basis point keep two decimals exact for display.
  return Number(((ideal - amountOut) * 1_000_000n) / ideal) / 10_000;
}

/**
 * Read prices and fees for each hop. Returns null when a pool's hook could take an amount we
 * cannot read (another hook with return-delta permissions, or a per-swap dynamic fee), since
 * excluding fees would then be a guess.
 */
export async function readPricedHops(
  client: PublicClient,
  contracts: Readonly<{ stateView: Address; staticsHook: Address | null }>,
  hops: readonly ImpactHop[]
): Promise<PricedHop[] | null> {
  for (const hop of hops) {
    const statics =
      contracts.staticsHook !== null && hop.hooks === getAddress(contracts.staticsHook);
    if (statics || hop.hooks === zeroAddress) continue;
    const permissions = BigInt(hop.hooks);
    if (permissions & (BEFORE_SWAP_RETURNS_DELTA_FLAG | AFTER_SWAP_RETURNS_DELTA_FLAG)) return null;
    if (hop.fee === DYNAMIC_FEE_FLAG && permissions & BEFORE_SWAP_FLAG) return null;
  }
  return Promise.all(
    hops.map(async (hop) => {
      const statics =
        contracts.staticsHook !== null && hop.hooks === getAddress(contracts.staticsHook);
      const [slot0, rate] = await Promise.all([
        client.readContract({
          address: contracts.stateView,
          abi: stateViewAbi,
          functionName: "getSlot0",
          args: [hop.poolId],
        }),
        statics
          ? client.readContract({
              address: contracts.staticsHook!,
              abi: staticsHookAbi,
              functionName: "poolFeeRate",
              args: [hop.poolId],
            })
          : null,
      ]);
      return {
        zeroForOne: hop.zeroForOne,
        sqrtPriceX96: slot0[0],
        swapFeePips: v4SwapFee(slot0[2], slot0[3], hop.zeroForOne),
        inputFeePips: BigInt(rate?.inputFeePips ?? 0),
        outputFeePips: BigInt(rate?.outputFeePips ?? 0),
      };
    })
  );
}

import type { Address, Hex } from "viem";
import { quoteWithdrawalAmounts } from "@/lib/phase-one/liquidity";

/** One asset an account holds or is owed. Amounts of different assets are never added together. */
export type AccountAsset = Readonly<{
  address: Address;
  symbol: string;
  decimals: number | null;
}>;
export type AccountHolding = Readonly<{ asset: AccountAsset; amount: bigint }>;

export type AccountLiquidity = Readonly<{
  poolId: Hex;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  token0: AccountAsset;
  token1: AccountAsset;
  /** The pool's current price; undefined while it is being read. */
  state?: Readonly<{ sqrtPriceX96: bigint; tick: number }>;
}>;

export type AccountStatus = "attention" | "active" | "empty";
export type AccountAttention = "out-of-range" | "stale-allocation" | "unresolved";

export type AccountSummary = Readonly<{
  positionId: bigint;
  status: AccountStatus;
  attention: readonly AccountAttention[];
  /** Staked STATICS first, then liquidity principal per token, in pool order. */
  holdings: readonly AccountHolding[];
  /** False while a pool price is still loading, so holdings are not yet complete. */
  holdingsComplete: boolean;
  staked: bigint;
  allocated: bigint;
  liquidityCount: number;
  outOfRange: number;
  rewardsReady: boolean;
}>;

/**
 * A liquidity position's principal at the current price, and whether that price is inside its
 * range (v4 counts the lower tick as in range and the upper tick as out of range).
 */
export function liquidityHoldings(entry: AccountLiquidity) {
  if (!entry.state || entry.liquidity <= 0n) return null;
  const { amount0, amount1 } = quoteWithdrawalAmounts(
    entry.state.sqrtPriceX96,
    entry.tickLower,
    entry.tickUpper,
    entry.liquidity
  );
  return {
    amount0,
    amount1,
    inRange: entry.state.tick >= entry.tickLower && entry.state.tick < entry.tickUpper,
  };
}

export function summarizeAccount(input: {
  positionId: bigint;
  stakedBalance: bigint;
  activeLegCount: bigint;
  unresolvedObligationCount: bigint;
  stakingAsset: AccountAsset;
  liquidity: readonly AccountLiquidity[];
  liquidityCount?: number;
  liquidityComplete?: boolean;
  allocated?: bigint;
  staleAllocation?: bigint;
  rewardsReady?: boolean;
}): AccountSummary {
  const totals = new Map<string, AccountHolding>();
  const add = (asset: AccountAsset, amount: bigint) => {
    if (amount <= 0n) return;
    const key = asset.address.toLowerCase();
    const previous = totals.get(key);
    totals.set(key, {
      asset: previous && previous.asset.decimals !== null ? previous.asset : asset,
      amount: amount + (previous?.amount ?? 0n),
    });
  };
  add(input.stakingAsset, input.stakedBalance);
  let outOfRange = 0,
    complete = input.liquidityComplete ?? true;
  for (const entry of input.liquidity) {
    const held = liquidityHoldings(entry);
    if (!held) {
      if (entry.liquidity > 0n) complete = false;
      continue;
    }
    if (!held.inRange) outOfRange++;
    add(entry.token0, held.amount0);
    add(entry.token1, held.amount1);
  }
  const attention: AccountAttention[] = [];
  if (outOfRange > 0) attention.push("out-of-range");
  if ((input.staleAllocation ?? 0n) > 0n) attention.push("stale-allocation");
  if (input.unresolvedObligationCount > 0n) attention.push("unresolved");
  const empty =
    input.stakedBalance === 0n &&
    input.activeLegCount === 0n &&
    input.unresolvedObligationCount === 0n;
  return {
    positionId: input.positionId,
    status: empty ? "empty" : attention.length ? "attention" : "active",
    attention,
    holdings: [...totals.values()],
    holdingsComplete: complete,
    staked: input.stakedBalance,
    allocated: input.allocated ?? 0n,
    liquidityCount:
      input.liquidityCount ?? input.liquidity.filter((entry) => entry.liquidity > 0n).length,
    outOfRange,
    rewardsReady: Boolean(input.rewardsReady),
  };
}

export type AccountFilter = "all" | AccountStatus;
export type AccountSort = "newest" | "oldest" | "stake";

export function sortAccounts(
  accounts: readonly AccountSummary[],
  sort: AccountSort
): AccountSummary[] {
  return [...accounts].sort((a, b) => {
    if (sort === "stake" && a.staked !== b.staked) return a.staked > b.staked ? -1 : 1;
    const older = a.positionId < b.positionId ? -1 : a.positionId > b.positionId ? 1 : 0;
    return sort === "oldest" ? older : -older;
  });
}

import { describe, expect, it } from "vitest";
import { parseEther, type Address, type Hex } from "viem";
import {
  liquidityHoldings,
  sortAccounts,
  summarizeAccount,
  type AccountAsset,
} from "@/lib/positions/accounts";
import { cleanNickname, parseNicknames } from "@/lib/positions/nicknames";

const asset = (n: string, symbol: string): AccountAsset => ({
  address: `0x${n.repeat(40)}` as Address,
  symbol,
  decimals: 18,
});
const statics = asset("1", "STATICS"),
  weth = asset("2", "WETH");
const pool = `0x${"a".repeat(64)}` as Hex;
const Q96 = 2n ** 96n;
const base = {
  positionId: 1n,
  stakedBalance: parseEther("100"),
  activeLegCount: 0n,
  unresolvedObligationCount: 0n,
  stakingAsset: statics,
  liquidity: [],
};
const leg = (tick: number, sqrtPriceX96 = Q96) => ({
  poolId: pool,
  tickLower: -600,
  tickUpper: 600,
  liquidity: parseEther("10"),
  token0: statics,
  token1: weth,
  state: { sqrtPriceX96, tick },
});

describe("account summaries", () => {
  it("values liquidity at the current price and counts the lower tick as in range", () => {
    const held = liquidityHoldings(leg(-600))!;
    expect(held.inRange).toBe(true);
    expect(held.amount0).toBeGreaterThan(0n);
    expect(held.amount1).toBeGreaterThan(0n);
    expect(liquidityHoldings(leg(600))!.inRange).toBe(false);
    expect(liquidityHoldings({ ...leg(0), state: undefined })).toBeNull();
  });
  it("adds the same asset across stake and liquidity, never across assets", () => {
    const summary = summarizeAccount({ ...base, activeLegCount: 1n, liquidity: [leg(0)] });
    expect(summary.holdings.map((holding) => holding.asset.symbol)).toEqual(["STATICS", "WETH"]);
    expect(summary.holdings[0].amount).toBeGreaterThan(parseEther("100"));
    expect(summary.status).toBe("active");
    expect(summary.liquidityCount).toBe(1);
  });
  it("flags out-of-range liquidity, stale allocations and unresolved legs", () => {
    expect(
      summarizeAccount({ ...base, activeLegCount: 1n, liquidity: [leg(900, Q96 * 2n)] }).attention
    ).toEqual(["out-of-range"]);
    expect(summarizeAccount({ ...base, staleAllocation: 1n }).attention).toEqual([
      "stale-allocation",
    ]);
    expect(
      summarizeAccount({ ...base, stakedBalance: 0n, unresolvedObligationCount: 1n }).status
    ).toBe("attention");
  });
  it("is empty only when nothing is staked, held or owed, and incomplete while prices load", () => {
    expect(summarizeAccount({ ...base, stakedBalance: 0n }).status).toBe("empty");
    const loading = summarizeAccount({
      ...base,
      activeLegCount: 1n,
      liquidity: [{ ...leg(0), state: undefined }],
    });
    expect(loading.holdingsComplete).toBe(false);
    expect(loading.status).toBe("active");
  });
  it("keeps missing liquidity incomplete and flags obligations alongside active legs", () => {
    const summary = summarizeAccount({
      ...base,
      activeLegCount: 2n,
      unresolvedObligationCount: 1n,
      liquidityComplete: false,
      liquidityCount: 1,
    });
    expect(summary.holdingsComplete).toBe(false);
    expect(summary.liquidityCount).toBe(1);
    expect(summary.attention).toEqual(["unresolved"]);
    expect(summary.status).toBe("attention");
  });
  it("retains known decimals when an unlisted pool has missing metadata", () => {
    const summary = summarizeAccount({
      ...base,
      activeLegCount: 1n,
      liquidity: [{ ...leg(0), token0: { ...statics, decimals: null } }],
    });
    expect(summary.holdings[0].asset.decimals).toBe(18);
    expect(summary.holdings[0].amount).toBeGreaterThan(base.stakedBalance);
  });
  it("sorts by number either way or by stake", () => {
    const accounts = [1n, 3n, 2n].map((id) =>
      summarizeAccount({ ...base, positionId: id, stakedBalance: parseEther(String(10n - id)) })
    );
    expect(sortAccounts(accounts, "newest").map((a) => a.positionId)).toEqual([3n, 2n, 1n]);
    expect(sortAccounts(accounts, "oldest").map((a) => a.positionId)).toEqual([1n, 2n, 3n]);
    expect(sortAccounts(accounts, "stake").map((a) => a.positionId)).toEqual([1n, 2n, 3n]);
  });
});

describe("account nicknames", () => {
  it("keeps only numbered, non-empty names and survives bad storage", () => {
    expect(parseNicknames('{"1":"Savings","x":"no","2":" ","3":4}')).toEqual({ "1": "Savings" });
    expect(parseNicknames("not json")).toEqual({});
    expect(parseNicknames("[]")).toEqual({});
  });
  it("trims, collapses spaces and caps the length", () => {
    expect(cleanNickname("  Rainy   day  ")).toBe("Rainy day");
    expect(cleanNickname("x".repeat(40))).toHaveLength(32);
  });
});

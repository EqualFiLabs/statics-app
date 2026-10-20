import { describe, expect, it } from "vitest";
import { weeklyPoolIncentives, INCENTIVE_WEEK as WEEK } from "../src/dex-incentives";
import type { DexSnapshot } from "../src/dex-snapshot";
import { pool } from "./dex-fixtures";

const now = 1000000n;
const unit = 10n ** 18n;
function funded() {
  const p = pool();
  p.legs = [{ positionId: "1", tickLower: -10, tickUpper: 10, liquidity: "100" }];
  p.streams = [
    {
      slot: 1,
      asset: p.token0.address,
      start: String(now),
      finish: String(now + WEEK),
      last: String(now),
      budget: String(700n * unit),
      emitted: "0",
    },
  ];
  const allocation: DexSnapshot["allocations"][number] = {
    poolId: p.poolId,
    weight: "100",
    eligible: true,
    incentiveStreamCount: 1,
    allocatorStreams: [
      {
        asset: p.token0,
        lastUpdate: String(now),
        periodFinish: String(now + WEEK),
        periodBudget: String(300n * unit),
        periodEmitted: "0",
        funded: true,
        invalidated: false,
        terminated: false,
      },
    ],
  };
  return { p, allocation };
}
describe("funded incentives over the next seven days", () => {
  it("keeps actual funded LP and allocator budgets separate and leaves the snapshot unchanged", () => {
    const { p, allocation } = funded(),
      before = structuredClone(p);
    const result = weeklyPoolIncentives(p, allocation, now);
    expect(result.lp.get(p.token0.address)).toBe(700n * unit);
    expect(result.allocator.get(p.token0.address)).toBe(300n * unit);
    expect(p).toEqual(before);
  });
  it("subtracts quiet-pool accrual and caps both sides at their end, not a seven-day run rate", () => {
    const { p, allocation } = funded();
    const result = weeklyPoolIncentives(p, allocation, now + WEEK / 7n);
    expect(result.lp.get(p.token0.address)).toBe(600n * unit);
    expect(result.allocator.get(p.token0.address)).toBe(300n * unit - (300n * unit) / 7n);
  });
  it("limits longer schedules to seven days", () => {
    const { p, allocation } = funded();
    p.streams[0]!.finish = String(now + 2n * WEEK);
    allocation.allocatorStreams![0]!.periodFinish = String(now + 2n * WEEK);
    const result = weeklyPoolIncentives(p, allocation, now);
    expect(result.lp.get(p.token0.address)).toBe(350n * unit);
    expect(result.allocator.get(p.token0.address)).toBe(150n * unit);
  });
  it("shows funded but paused streams as zero even past their stored finish", () => {
    const { p, allocation } = funded();
    p.tick = 10; // Exclusive upper bound: no managed LP is in range.
    allocation.weight = "0";
    const result = weeklyPoolIncentives(p, allocation, now + 2n * WEEK);
    expect(result.lp.get(p.token0.address)).toBe(0n);
    expect(result.allocator.get(p.token0.address)).toBe(0n);
    expect(result.lpPaused).toBe(true);
    expect(result.allocatorPaused).toBe(true);
  });
  it("omits ended and stopped streams", () => {
    const { p, allocation } = funded();
    expect(weeklyPoolIncentives(p, allocation, now + WEEK).lp.size).toBe(0);
    expect(weeklyPoolIncentives(p, allocation, now + WEEK).allocator.size).toBe(0);
    p.stopped = true;
    expect(weeklyPoolIncentives(p, allocation, now).lp.size).toBe(0);
    expect(weeklyPoolIncentives(p, allocation, now).allocator.size).toBe(0);
  });
  it.each(["invalidated", "terminated"] as const)(
    "omits %s allocator rewards without removing LP rewards",
    (flag) => {
      const { p, allocation } = funded();
      allocation.allocatorStreams![0]![flag] = true;
      const result = weeklyPoolIncentives(p, allocation, now);
      expect(result.allocator.size).toBe(0);
      expect(result.lp.get(p.token0.address)).toBe(700n * unit);
    }
  );
  it("excludes ineligible allocations and protocol slot zero; combines repeated assets only", () => {
    const { p, allocation } = funded();
    allocation.eligible = false;
    p.streams.push({ ...p.streams[0]!, slot: 0 });
    p.streams.push({ ...p.streams[0]!, slot: 2 });
    p.streams.push({ ...p.streams[0]!, slot: 3, asset: p.token1.address });
    const result = weeklyPoolIncentives(p, allocation, now);
    expect(result.allocator.size).toBe(0);
    expect([...result.lp.values()]).toEqual([1400n * unit, 700n * unit]);
  });
});

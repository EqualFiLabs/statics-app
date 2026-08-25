import { describe, expect, it } from "vitest";

import { swapDeadlineBase } from "@/lib/trade/canonical-market";

/**
 * Regression cover for a UniversalRouter revert with TransactionDeadlinePassed
 * (0x5bf6f916) on a local fork: the deadline was anchored to the last mined
 * block, but the swap executes in the next one.
 */
describe("swap deadline base", () => {
  it("uses wall clock when the latest block is stale", () => {
    // Anvil mines only on activity. After a quiet period the latest block can
    // be far behind, while the block this transaction lands in jumps to real
    // time -- which is what made every swap after 20 idle minutes revert.
    const latest = 1_787_681_161n; // 18:06:01
    const now = 1_787_682_706n; // 18:31:46
    expect(swapDeadlineBase(latest, null, now)).toBe(now);
  });

  it("uses the chain when a fork has been advanced past wall clock", () => {
    // Advancing time is how the Genesis Epoch gets tested, and it puts the
    // chain ahead of the machine running the browser.
    const latest = 1_790_000_000n;
    const now = 1_787_682_706n;
    expect(swapDeadlineBase(latest, null, now)).toBe(latest);
  });

  it("prefers the pending block when the node exposes one", () => {
    const latest = 1_787_681_161n;
    const pending = 1_787_684_000n;
    const now = 1_787_682_706n;
    expect(swapDeadlineBase(latest, pending, now)).toBe(pending);
  });

  it("ignores a pending block that trails the chain", () => {
    const latest = 1_790_000_000n;
    expect(swapDeadlineBase(latest, 1_787_684_000n, 1_787_682_706n)).toBe(latest);
  });

  it("is never earlier than any clock it was given", () => {
    const clocks: [bigint, bigint | null, bigint][] = [
      [5n, 9n, 7n],
      [9n, 5n, 7n],
      [7n, null, 9n],
      [1n, 1n, 1n],
    ];
    for (const [latest, pending, now] of clocks) {
      const base = swapDeadlineBase(latest, pending, now);
      expect(base).toBeGreaterThanOrEqual(latest);
      expect(base).toBeGreaterThanOrEqual(now);
      if (pending !== null) expect(base).toBeGreaterThanOrEqual(pending);
    }
  });
});

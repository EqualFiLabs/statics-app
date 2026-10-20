import { describe, expect, it, vi } from "vitest";
import { zeroHash } from "viem";
import {
  allocationEligibility,
  allocationVersion,
  allocatorSchedule,
} from "../src/allocation-directory";
vi.mock("ponder:api", () => ({ db: {} }));
vi.mock("ponder:schema", () => ({
  allocationDirectoryPool: {},
  allocationDirectoryState: {},
  gaugeReserveState: {},
}));
import {
  allocationDirectoryQuery,
  directoryCursorScope,
  decodeDirectoryCursor,
  encodeDirectoryCursor,
} from "../src/api/allocation-pools";
const poolId = `0x${"a".repeat(64)}` as const;
describe("allocation eligibility and schedules", () => {
  it("does not treat quarantine as allocation ineligibility", () => {
    expect(
      allocationEligibility(
        { gaugeInitialized: true, gaugeStopped: false, decommissioned: false, quarantined: true },
        false,
        false
      ).eligible
    ).toBe(true);
  });
  it("restriction removal changes versions without reviving old allocations", () => {
    expect(allocationVersion(poolId, 1n, 0n)).not.toBe(allocationVersion(poolId, 0n, 0n));
  });
  it("lists every independent ineligibility reason", () => {
    expect(
      allocationEligibility(
        { gaugeInitialized: false, gaugeStopped: true, decommissioned: true },
        true,
        true
      ).reasons
    ).toHaveLength(5);
  });
  const stream = {
    eligibilityVersion: poolId,
    periodBudget: 20n,
    periodEmitted: 5n,
    lastUpdate: 10n,
    periodFinish: 40n,
    terminated: false,
  };
  it("preserves fractional rates and pauses zero-weight funded streams", () => {
    expect(allocatorSchedule(stream, poolId, 0n)).toMatchObject({
      funded: true,
      paused: true,
      rateNumerator: 15n,
      rateDenominator: 30n,
      ratePerSecond: 0n,
    });
    expect(allocatorSchedule({ ...stream, periodBudget: 100n }, poolId, 1n)).toMatchObject({
      rateNumerator: 95n,
      rateDenominator: 30n,
      ratePerSecond: 3n,
    });
  });
  it("excludes invalidated, terminated, exhausted and malformed-duration streams", () => {
    expect(allocatorSchedule(stream, zeroHash, 1n).funded).toBe(false);
    expect(allocatorSchedule({ ...stream, terminated: true }, poolId, 1n).funded).toBe(false);
    expect(allocatorSchedule({ ...stream, periodBudget: 5n }, poolId, 1n).funded).toBe(false);
    expect(allocatorSchedule({ ...stream, lastUpdate: 50n }, poolId, 1n).funded).toBe(false);
  });
});
describe("directory query and cursors", () => {
  it("normalizes literal search and preserves false/all eligibility semantics", () => {
    expect(
      allocationDirectoryQuery(new URLSearchParams("search=%25_ETH&eligible=false"))
    ).toMatchObject({ search: "%_eth", eligible: false, limit: 25 });
    expect(allocationDirectoryQuery(new URLSearchParams("eligible=all"))?.eligible).toBe(false);
  });
  it.each([
    "limit=0",
    "limit=101",
    "limit=1.5",
    "eligible=no",
    "hasIncentives=all",
    "sort=usd",
    "direction=up",
  ])("rejects %s", (query) =>
    expect(allocationDirectoryQuery(new URLSearchParams(query))).toBeNull()
  );
  it("binds cursors to deployment, filters, order and revision", () => {
    const query = allocationDirectoryQuery(new URLSearchParams())!,
      scope = directoryCursorScope("a", query);
    const cursor = encodeDirectoryCursor({
      version: 1,
      scope,
      revision: "3",
      value: "1000000000000000000000000000",
      poolId,
    });
    expect(decodeDirectoryCursor(cursor, scope)?.revision).toBe("3");
    expect(decodeDirectoryCursor(cursor, directoryCursorScope("b", query))).toBeNull();
    expect(
      decodeDirectoryCursor(cursor, directoryCursorScope("a", { ...query, direction: "asc" }))
    ).toBeNull();
    expect(decodeDirectoryCursor("", scope)).toBeNull();
  });
});

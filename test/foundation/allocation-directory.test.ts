import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AllocationDirectoryChangedError,
  loadAllocationDirectory,
  parseAllocationDirectory,
} from "@/lib/indexer/phase-one";
const { fetchIndexer } = vi.hoisted(() => ({ fetchIndexer: vi.fn() }));
vi.mock("@/lib/indexer/statics", () => ({
  fetchIndexer,
  configuredIndexerUrlForDeployment: () => "http://localhost:42071",
}));
const hash = `0x${"a".repeat(64)}`,
  a = "0x0000000000000000000000000000000000000001",
  b = "0x0000000000000000000000000000000000000002";
const metadata = (address: string) => ({ address, symbol: null, name: null, decimals: null });
function fixture() {
  return {
    deploymentId: "selected",
    directoryRevision: "1",
    indexedAtBlock: "100",
    indexedAtTimestamp: "1000",
    total: 1,
    nextCursor: null,
    reserve: {
      activated: true,
      periodBudget: "100",
      periodStart: "0",
      periodFinish: "999",
      totalAllocatedWeight: "50",
      observedAtBlock: "100",
      observedAtTimestamp: "1000",
      periodExpired: true,
    },
    items: [
      {
        poolId: hash,
        poolKey: { currency0: a, currency1: b, hooks: a, fee: 3000, tickSpacing: 60 },
        token0: metadata(a),
        token1: metadata(b),
        creator: a,
        eligibility: { eligible: true, reasons: [] },
        weight: "50",
        stale: false,
        gaugeInitialized: true,
        gaugeStopped: false,
        decommissioned: false,
        decommissionStarted: false,
        decommissionFinalized: false,
        quarantined: true,
        restrictionFlags: { token0: false, token1: false },
        currentVersion: hash,
        storedVersion: hash,
        incentiveStreamCount: 1,
        createdAtBlock: "10",
        updatedAtBlock: "100",
        weightObservedAtBlock: "100",
        observedAtTimestamp: "1000",
        allocatorStreams: [
          {
            slot: 1,
            asset: metadata(b),
            allocatorShareBps: 5000,
            eligibilityVersion: hash,
            fundingRestrictionSequence: "0",
            periodStart: "900",
            periodFinish: "1030",
            lastUpdate: "1000",
            periodBudget: "20",
            periodEmitted: "5",
            terminated: false,
            observedAtBlock: "100",
            observedAtTimestamp: "1000",
            funded: true,
            paused: false,
            invalidated: false,
            rateNumerator: "15",
            rateDenominator: "30",
            nominalRatePerSecond: "0",
            ratePerSecond: "0",
          },
        ],
      },
    ],
  };
}
beforeEach(() => fetchIndexer.mockReset());
describe("strict allocation directory parser", () => {
  it("retains nullable metadata, tiny rates, expired reserve observations and eligible quarantined pools", () => {
    const value = parseAllocationDirectory(fixture(), "selected");
    expect(value.items[0].allocatorStreams[0]).toMatchObject({
      rateNumerator: 15n,
      rateDenominator: 30n,
      ratePerSecond: 0n,
    });
    expect(value.items[0].token0.decimals).toBeNull();
    expect(value.reserve?.periodExpired).toBe(true);
    expect(value.items[0].eligibility.eligible).toBe(true);
  });
  it("accepts a paused funded stream without misclassifying it as no incentives", () => {
    const value = fixture();
    value.items[0].weight = "0";
    value.items[0].allocatorStreams[0].paused = true;
    expect(parseAllocationDirectory(value, "selected").items[0].incentiveStreamCount).toBe(1);
  });
  it.each([
    (v: ReturnType<typeof fixture>) => {
      v.deploymentId = "wrong";
    },
    (v: ReturnType<typeof fixture>) => {
      v.items[0].poolId = "0x12";
    },
    (v: ReturnType<typeof fixture>) => {
      v.items[0].weight = "-1";
    },
    (v: ReturnType<typeof fixture>) => {
      v.items[0].stale = true;
    },
    (v: ReturnType<typeof fixture>) => {
      v.items[0].gaugeStopped = true;
    },
    (v: ReturnType<typeof fixture>) => {
      v.items[0].incentiveStreamCount = 0;
    },
    (v: ReturnType<typeof fixture>) => {
      v.items[0].allocatorStreams[0].periodEmitted = "21";
    },
    (v: ReturnType<typeof fixture>) => {
      v.items[0].allocatorStreams[0].rateNumerator = "16";
    },
    (v: ReturnType<typeof fixture>) => {
      v.items[0].allocatorStreams[0].slot = 0;
    },
    (v: ReturnType<typeof fixture>) => {
      v.items[0].allocatorStreams.push(v.items[0].allocatorStreams[0]);
    },
    (v: ReturnType<typeof fixture>) => {
      v.items.push(v.items[0]);
      v.total = 2;
    },
    (v: ReturnType<typeof fixture>) => {
      v.indexedAtBlock = "99";
    },
    (v: ReturnType<typeof fixture>) => {
      v.reserve.periodExpired = false;
    },
  ])("rejects malformed or cross-field inconsistent data %#", (mutate) => {
    const value = fixture();
    mutate(value);
    expect(() => parseAllocationDirectory(value, "selected")).toThrow();
  });
  it("supports an explicitly empty unavailable snapshot", () => {
    expect(
      parseAllocationDirectory(
        {
          deploymentId: "selected",
          directoryRevision: "0",
          indexedAtBlock: null,
          indexedAtTimestamp: null,
          items: [],
          total: 0,
          nextCursor: null,
          reserve: null,
        },
        "selected"
      ).indexedAtBlock
    ).toBeNull();
  });
});
describe("allocation directory loader", () => {
  it("encodes filters and uses the deployment endpoint without chain reads", async () => {
    fetchIndexer.mockResolvedValue(new Response(JSON.stringify(fixture())));
    await loadAllocationDirectory({
      deploymentId: "selected",
      filters: {
        search: "A&B",
        eligible: "all",
        hasIncentives: true,
        sort: "incentives",
        limit: 25,
      },
    });
    expect(fetchIndexer).toHaveBeenCalledWith(
      "http://localhost:42071/phase-one/allocation-pools?search=A%26B&eligible=all&hasIncentives=true&sort=incentives&limit=25",
      "no-store"
    );
  });
  it("exposes a recognizable restart error", async () => {
    fetchIndexer.mockResolvedValue(
      new Response(JSON.stringify({ code: "DIRECTORY_CHANGED" }), { status: 409 })
    );
    await expect(loadAllocationDirectory({ deploymentId: "selected" })).rejects.toBeInstanceOf(
      AllocationDirectoryChangedError
    );
  });
  it("does not reinterpret other errors as an empty directory", async () => {
    fetchIndexer.mockResolvedValue(new Response("", { status: 503 }));
    await expect(loadAllocationDirectory({ deploymentId: "selected" })).rejects.toThrow("503");
  });
});

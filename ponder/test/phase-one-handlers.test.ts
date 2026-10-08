import { beforeEach, describe, expect, it, vi } from "vitest";
const { handlers } = vi.hoisted(() => ({
  handlers: new Map<string, (input: unknown) => Promise<void>>(),
}));
vi.mock("ponder:registry", () => ({
  ponder: {
    on: (name: string, handler: (input: unknown) => Promise<void>) => handlers.set(name, handler),
  },
}));
vi.mock("ponder:schema", () =>
  Object.fromEntries(
    [
      "allocationToken",
      "allocatorStream",
      "allocationDirectoryPool",
      "allocationDirectoryState",
      "activeGenesisCredit",
      "activeLoan",
      "genesisNft",
      "genesisRewardClaim",
      "harvestedFee",
      "marketCandle",
      "marketSwap",
      "gaugePeriod",
      "gaugePoolState",
      "gaugeReserveState",
      "managedGaugePosition",
      "phaseOneActivity",
      "phaseOneMarketObservation",
      "phaseOneMarketSwap",
      "poolRewardSlot",
      "positionGaugeState",
      "positionNft",
      "publicPool",
      "rewardRestriction",
      "v4Position",
    ].map((name) => [name, name])
  )
);
process.env.PONDER_DEPLOYMENT_ID = "genesis";
process.env.PONDER_PHASE_ONE_DEPLOYMENT_ID = "phase-one";
process.env.PONDER_STATICS_DIAMOND_ADDRESS = `0x${"1".repeat(40)}`;
await import("../src/index");
type Row = Record<string, unknown> & { key: string };
const rows = new Map<string, Row>();
const readContract = vi.fn();
const db = {
  find: async (table: string, identity: { key: string }) => rows.get(`${table}:${identity.key}`),
  sql: {
    select: () => ({
      from: (table: string) => ({
        where: async () =>
          [...rows.entries()].filter(([key]) => key.startsWith(`${table}:`)).map(([, row]) => row),
      }),
    }),
  },
  insert: (table: string) => ({
    values: (row: Row) => ({
      then: (resolve: () => void, reject: (error: Error) => void) => {
        const key = `${table}:${row.key}`;
        if (rows.has(key)) return reject(new Error("duplicate primary key"));
        rows.set(key, row);
        resolve();
      },
      onConflictDoUpdate: async (update: Row | ((row: Row) => Row)) => {
        const key = `${table}:${row.key}`,
          previous = rows.get(key);
        rows.set(
          key,
          previous
            ? { ...previous, ...(typeof update === "function" ? update(previous) : update) }
            : row
        );
      },
    }),
  }),
  update: (table: string, identity: { key: string }) => ({
    set: async (update: Record<string, unknown>) => {
      const key = `${table}:${identity.key}`;
      rows.set(key, { ...rows.get(key)!, ...update });
    },
  }),
};
const poolId = `0x${"a".repeat(64)}`;
const base = {
  args: { positionId: 1n, poolId },
  log: { address: process.env.PONDER_STATICS_DIAMOND_ADDRESS },
  transaction: { hash: `0x${"b".repeat(64)}`, input: "0x1234" },
  block: { number: 100n, timestamp: 1000n },
};
const run = (name: string, event: unknown) =>
  handlers.get(`PhaseOneStatics:${name}`)!({
    event,
    context: { db, client: { readContract }, chain: { id: 4663 } },
  });
beforeEach(() => {
  rows.clear();
  readContract.mockReset();
  readContract.mockImplementation(
    async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
      if (functionName === "gaugePositionAllocations")
        return [2000, 5n, [{ poolId, amount: 5n, eligibilityVersion: poolId }], 5n];
      if (functionName === "poolRewardConfig")
        return { slotCount: 0, allocatorShareBps: [0, 0, 0, 0, 0] };
      if (functionName === "gaugePoolWeight")
        return {
          weight: 5n,
          storedVersion: poolId,
          currentVersion: poolId,
          restrictionSequence: 0n,
          indexCursorX160: 0n,
          pendingReward: 0n,
          stale: false,
        };
      if (functionName === "gaugeReserve")
        return {
          activated: true,
          releaseBps: 100,
          pendingReleaseBps: 0,
          pendingReleaseAt: 0,
          deferredMaturityAt: 0,
          scheduleStart: 0,
          lastCheckpoint: 1000,
          periodStart: 0,
          periodFinish: 2000,
          currentPeriod: 1n,
          allocationCooldown: 0,
          available: 0n,
          deferred: 0n,
          committed: 0n,
          periodBudget: 10n,
          periodAccounted: 0n,
          totalAllocatedWeight: 5n,
          globalIndexX160: 0n,
          unsettledRoutingLiability: 0n,
        };
      if (functionName === "gaugePool") return { initialized: true, stopped: true };
      if (functionName === "rewardRestricted") return false;
      if (functionName === "rewardRestrictionNonce") return 1n;
      throw new Error(`Unexpected read ${functionName} ${args}`);
    }
  );
});
describe("actual Phase 1 event handlers", () => {
  it("stores ending state for multiple allocation changes and wrapped wallet calls", async () => {
    await run("PositionGaugeAllocationsSet", base);
    await run("PositionGaugeAllocationsSet", {
      ...base,
      transaction: { ...base.transaction, input: "0x" },
    });
    expect(rows.get("positionGaugeState:phase-one:1")?.amountsJson).toBe('["5"]');
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ blockNumber: 100n }));
  });
  it("upserts a previously exited managed leg when the position and pool are reused", async () => {
    const provided = {
      ...base,
      args: {
        ...base.args,
        posmTokenId: 10n,
        manager: process.env.PONDER_STATICS_DIAMOND_ADDRESS,
        tickLower: -60,
        tickUpper: 60,
        liquidity: 100n,
      },
    };
    await run("ManagedLiquidityProvided", provided);
    await run("ManagedLiquidityExited", base);
    await run("ManagedLiquidityAttached", {
      ...provided,
      args: { ...provided.args, posmTokenId: 11n },
    });
    expect(rows.get(`managedGaugePosition:phase-one:1:${poolId}`)).toMatchObject({
      active: true,
      posmTokenId: 11n,
      liquidity: 100n,
    });
  });
});

describe("allocation directory snapshot handlers", () => {
  it.each([
    "PositionGaugeAllocationsSet",
    "PositionGaugeAllocationsClearedByStakeLoss",
    "PositionGaugeAllocationCooldownExtended",
  ])("refreshes the old/new union and reserve for %s", async (eventName) => {
    const prior = `0x${"c".repeat(64)}`;
    rows.set("positionGaugeState:phase-one:1", {
      key: "phase-one:1",
      poolIdsJson: JSON.stringify([prior, poolId]),
    });
    await run(eventName, base);
    const requested = readContract.mock.calls
      .filter(([r]) => r.functionName === "gaugePoolWeight")
      .map(([r]) => r.args[0]);
    expect(requested).toEqual([prior, poolId]);
    expect(rows.get("gaugeReserveState:phase-one")?.totalAllocatedWeight).toBe(5n);
    expect(rows.get(`gaugePoolState:phase-one:${prior}`)?.weight).toBe(5n);
    expect(readContract.mock.calls.every(([r]) => r.blockNumber === 100n)).toBe(true);
    expect(readContract.mock.calls.some(([r]) => r.functionName === "getTransaction")).toBe(false);
  });
  it.each([
    "PoolGaugeStopped",
    "GeneralPoolDecommissionStarted",
    "GeneralPoolDecommissionFinalized",
  ])("tracks lifecycle flags for %s", async (eventName) => {
    const a = "0x0000000000000000000000000000000000000001",
      b = "0x0000000000000000000000000000000000000002";
    rows.set(`publicPool:phase-one:${poolId}`, {
      key: `phase-one:${poolId}`,
      deploymentId: "phase-one",
      poolId,
      creator: a,
      currency0: a,
      currency1: b,
      hook: a,
      lpFee: 3000,
      tickSpacing: 60,
      gaugeInitialized: true,
      gaugeStopped: false,
      decommissioned: false,
      decommissionStarted: false,
      decommissionFinalized: false,
      quarantined: false,
      createdAtBlock: 1n,
    });
    for (const asset of [a, b])
      rows.set(`allocationToken:4663:${asset}`, {
        key: `4663:${asset}`,
        address: asset,
        symbol: null,
        name: null,
        decimals: null,
      });
    await run(eventName, base);
    expect(rows.get(`publicPool:phase-one:${poolId}`)).toMatchObject({
      gaugeStopped: true,
      decommissioned: eventName !== "PoolGaugeStopped",
      decommissionStarted: eventName !== "PoolGaugeStopped",
      decommissionFinalized: eventName === "GeneralPoolDecommissionFinalized",
    });
    const directory = JSON.parse(
      String(rows.get(`allocationDirectoryPool:phase-one:${poolId}`)?.detailsJson)
    );
    expect(directory.eligibility.eligible).toBe(false);
    expect(rows.get(`gaugePoolState:phase-one:${poolId}`)).toBeDefined();
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "gaugePool", blockNumber: 100n })
    );
  });
  it("records the ending restriction nonce even for removal and refreshes reserve without pool fan-out", async () => {
    await run("RewardRestrictionRemoved", {
      ...base,
      args: { asset: process.env.PONDER_STATICS_DIAMOND_ADDRESS },
    });
    expect([...rows.values()].find((r) => r.nonce === 1n)).toMatchObject({
      restricted: false,
      nonce: 1n,
    });
    expect(readContract.mock.calls.some(([r]) => r.functionName === "gaugePoolWeight")).toBe(false);
  });
});

function seedDirectoryPool() {
  const a = "0x0000000000000000000000000000000000000001",
    b = "0x0000000000000000000000000000000000000002";
  rows.set(`publicPool:phase-one:${poolId}`, {
    key: `phase-one:${poolId}`,
    deploymentId: "phase-one",
    poolId,
    creator: a,
    currency0: a,
    currency1: b,
    hook: a,
    lpFee: 3000,
    tickSpacing: 60,
    gaugeInitialized: true,
    gaugeStopped: false,
    decommissioned: false,
    decommissionStarted: false,
    decommissionFinalized: false,
    quarantined: false,
    createdAtBlock: 1n,
  });
  for (const asset of [a, b])
    rows.set(`allocationToken:4663:${asset}`, {
      key: `4663:${asset}`,
      address: asset,
      symbol: null,
      name: null,
      decimals: null,
    });
  return { a, b };
}
describe("allocator funding and restriction observations", () => {
  it("stores separate allocator schedules, preserves fractional rates and invalidates uncheckpointed streams on stop", async () => {
    const { a, b } = seedDirectoryPool();
    const { allocationVersion } = await import("../src/allocation-directory");
    const version = allocationVersion(poolId as `0x${string}`, 0n, 0n),
      previous = readContract.getMockImplementation()!;
    let budget = 15n,
      start = 900;
    readContract.mockImplementation(async (request) => {
      if (request.functionName === "poolRewardConfig")
        return { slotCount: 2, allocatorShareBps: [0, 5000, 0, 0, 0] };
      if (request.functionName === "gaugePoolWeight")
        return { ...(await previous(request)), storedVersion: version, currentVersion: version };
      if (request.functionName === "gaugeAllocatorReward")
        return {
          asset: b,
          eligibilityVersion: version,
          fundingRestrictionSequence: 0n,
          periodStart: start,
          periodFinish: 1100,
          lastUpdate: 1000,
          periodBudget: budget,
          periodEmitted: 5n,
          terminated: false,
        };
      return previous(request);
    });
    const event = {
      ...base,
      args: { ...base.args, slot: 1, asset: b, allocatorAmount: 10n, periodFinish: 1100 },
    };
    await run("PoolAllocatorRewardFunded", event);
    budget = 30n;
    start = 1000;
    await run("PoolAllocatorRewardFunded", event);
    expect(rows.get(`allocatorStream:phase-one:${poolId}:1`)).toMatchObject({
      periodBudget: 30n,
      periodEmitted: 5n,
      lastUpdate: 1000n,
      periodStart: 1000n,
      periodFinish: 1100n,
      observedAtBlock: 100n,
    });
    let directory = JSON.parse(
      String(rows.get(`allocationDirectoryPool:phase-one:${poolId}`)?.detailsJson)
    );
    expect(directory.allocatorStreams[0]).toMatchObject({
      rateNumerator: "25",
      rateDenominator: "100",
      ratePerSecond: "0",
      allocatorShareBps: 5000,
    });
    await run("PoolGaugeStopped", base);
    directory = JSON.parse(
      String(rows.get(`allocationDirectoryPool:phase-one:${poolId}`)?.detailsJson)
    );
    expect(directory.allocatorStreams[0]).toMatchObject({
      invalidated: true,
      funded: false,
      terminated: false,
    });
    expect(directory.incentiveStreamCount).toBe(0);
    expect(rows.get(`allocationToken:4663:${a}`)).toBeDefined();
  });
  it("keeps removed restrictions allocatable while marking old weight and incentives stale without pool RPC fan-out", async () => {
    const { a } = seedDirectoryPool(),
      { allocationVersion } = await import("../src/allocation-directory");
    const version = allocationVersion(poolId as `0x${string}`, 0n, 0n);
    rows.set(`gaugePoolState:phase-one:${poolId}`, {
      key: `phase-one:${poolId}`,
      weight: 5n,
      storedVersion: version,
      updatedAtBlock: 90n,
    });
    await run("RewardRestrictionRemoved", { ...base, args: { asset: a } });
    const directory = JSON.parse(
      String(rows.get(`allocationDirectoryPool:phase-one:${poolId}`)?.detailsJson)
    );
    expect(directory).toMatchObject({ stale: true, eligibility: { eligible: true }, weight: "5" });
    expect(directory.currentVersion).not.toBe(version);
    expect(
      readContract.mock.calls.some(([request]) => request.functionName === "gaugePoolWeight")
    ).toBe(false);
    expect(rows.get("gaugeReserveState:phase-one")?.totalAllocatedWeight).toBe(5n);
  });
});

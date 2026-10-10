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
      "positionStatement",
      "positionStatementMovement",
      "positionStatementHistory",
      "positionStatementBlock",
      "positionStatementConfig",
      "positionStatementRevision",
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
process.env.PONDER_PUBLIC_HOOK_ADDRESS = `0x${"9".repeat(40)}`;
process.env.PONDER_STATICS_DIAMOND_ADDRESS = `0x${"1".repeat(40)}`;
await import("../src/index");
type Row = Record<string, unknown> & { key: string };
const rows = new Map<string, Row>();
const readContract = vi.fn();
const db = {
  delete: async (table: string, identity: { key: string }) =>
    rows.delete(`${table}:${identity.key}`),
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
      then: (resolve: (value: Row) => void, reject: (error: Error) => void) => {
        const key = `${table}:${row.key}`;
        if (rows.has(key)) return reject(new Error("duplicate primary key"));
        rows.set(key, row);
        resolve(row);
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
      if (!rows.has(key)) throw new Error("record not found");
      rows.set(key, { ...rows.get(key)!, ...update });
    },
  }),
};
const poolId = `0x${"a".repeat(64)}`;
const base = {
  args: { positionId: 1n, poolId },
  log: { address: process.env.PONDER_STATICS_DIAMOND_ADDRESS, logIndex: 0 },
  transaction: { hash: `0x${"b".repeat(64)}`, from: `0x${"1".repeat(40)}`, input: "0x1234" },
  block: { number: 100n, timestamp: 1000n, hash: `0x${"c".repeat(64)}` },
};
let logIndex = 0;
const run = (name: string, event: unknown) =>
  handlers.get(`PhaseOneStatics:${name}`)!({
    event: { ...(event as object), log: { ...base.log, logIndex: logIndex++ } },
    context: { db, client: { readContract }, chain: { id: 4663 } },
  });
beforeEach(() => {
  rows.clear();
  logIndex = 0;
  readContract.mockReset();
  readContract.mockImplementation(
    async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
      if (functionName === "symbol" || functionName === "name") return "Token";
      if (functionName === "decimals") return 18;
      if (functionName === "stakingToken") return `0x${"1".repeat(40)}`;
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
    rows.set(`publicPool:phase-one:${poolId}`, {
      key: `phase-one:${poolId}`,
      currency0: `0x${"1".repeat(40)}`,
      currency1: `0x${"2".repeat(40)}`,
    });
    const provided = {
      ...base,
      args: {
        ...base.args,
        posmTokenId: 10n,
        manager: process.env.PONDER_STATICS_DIAMOND_ADDRESS,
        tickLower: -60,
        tickUpper: 60,
        liquidity: 100n,
        movement: {
          liquidityBefore: 0n,
          liquidityAfter: 100n,
          payer: `0x${"1".repeat(40)}`,
          receiver: `0x${"1".repeat(40)}`,
          paid0: 0n,
          paid1: 0n,
          received0: 0n,
          received1: 0n,
        },
      },
    };
    await run("ManagedLiquidityProvided", provided);
    await run("ManagedLiquidityExited", {
      ...provided,
      args: {
        ...provided.args,
        movement: { ...provided.args.movement, liquidityBefore: 100n, liquidityAfter: 0n },
      },
    });
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

describe("Position NFT statement handlers", () => {
  const first = `0x${"1".repeat(40)}`,
    second = `0x${"2".repeat(40)}`,
    asset = `0x${"3".repeat(40)}`;
  const entries = () =>
    [...rows.entries()]
      .filter(([key]) => key.startsWith("positionStatement:"))
      .map(([, row]) => row);
  const movements = () =>
    [...rows.entries()]
      .filter(([key]) => key.startsWith("positionStatementMovement:"))
      .map(([, row]) => row);
  it("updates live position state and rejects unexplained missing current records", async () => {
    const event = {
      ...base,
      args: { tokenId: 1n, stateNonce: 2n, activeLegCount: 1n, unresolvedObligationCount: 1n },
    };
    await expect(run("PositionStateChanged", event)).rejects.toThrow("record not found");
    await run("Transfer", {
      ...base,
      args: { tokenId: 1n, from: `0x${"0".repeat(40)}`, to: first },
    });
    await run("PositionStateChanged", event);
    expect(rows.get("positionNft:phase-one:1")).toMatchObject({
      activeLegCount: 1n,
      unresolvedObligationCount: 1n,
    });
  });
  it("preserves a transfer during safe-mint before PositionCreated is emitted", async () => {
    await run("Transfer", {
      ...base,
      args: { tokenId: 1n, from: `0x${"0".repeat(40)}`, to: first },
    });
    await run("Transfer", { ...base, args: { tokenId: 1n, from: first, to: second } });
    await run("PositionCreated", { ...base, args: { positionId: 1n, owner: first } });
    expect(rows.get("positionNft:phase-one:1")?.owner).toBe(second);
    expect(rows.get("positionStatementHistory:phase-one:1")?.owner).toBe(second);
    expect(entries()[1]).toMatchObject({ ownerBefore: null, ownerAfter: second });
    expect(JSON.parse(entries()[1].payloadJson as string).owner).toBe(first);
  });
  it("keeps NFT lifetime ownership and closure independently of current ownership", async () => {
    await run("Transfer", {
      ...base,
      args: { tokenId: 1n, from: `0x${"0".repeat(40)}`, to: first },
    });
    await run("PositionCreated", { ...base, args: { positionId: 1n, owner: first } });
    await run("Transfer", { ...base, args: { tokenId: 1n, from: first, to: second } });
    await run("Transfer", { ...base, args: { tokenId: 1n, from: second, to: first } });
    await run("Transfer", {
      ...base,
      args: { tokenId: 1n, from: first, to: `0x${"0".repeat(40)}` },
    });
    await run("PositionStateChanged", {
      ...base,
      args: { tokenId: 1n, stateNonce: 2n, activeLegCount: 0n, unresolvedObligationCount: 0n },
    });
    await run("PositionClosed", { ...base, args: { positionId: 1n } });
    expect(rows.has("positionNft:phase-one:1")).toBe(false);
    expect(entries().map((r) => r.eventName)).toEqual([
      "PositionCreated",
      "Transfer",
      "Transfer",
      "PositionClosed",
    ]);
    expect(entries()[0]).toMatchObject({ ownerBefore: null, ownerAfter: first });
    expect(entries()[1]).toMatchObject({ ownerBefore: first, ownerAfter: second });
    expect(entries()[3]).toMatchObject({ ownerBefore: first, ownerAfter: null });
    expect(rows.get("positionStatementHistory:phase-one:1")).toMatchObject({
      owner: null,
      lastOwner: first,
      openingObserved: true,
    });
  });
  it("records wallet rewards once and preserves distinct batch logs and retained entitlements", async () => {
    for (const [name, amount] of [
      ["RewardClaimed", 1n],
      ["RewardClaimed", 2n],
    ] as const)
      await run(name, {
        ...base,
        args: { positionId: 1n, receiver: second, asset, debited: amount, received: amount },
      });
    await run("PositionRewardSettled", { ...base, args: { positionId: 1n, asset, amount: 3n } });
    await run("PositionRewardEligibilityActivated", {
      ...base,
      args: {
        positionId: 1n,
        asset,
        stake: 100n,
        weight: 100n,
        eligibleAt: 1,
        activationIndexRay: 0n,
      },
    });
    expect(entries()).toHaveLength(4);
    expect(
      movements()
        .filter((r) => r.space === "wallet")
        .map((r) => r.amount)
    ).toEqual([1n, 2n]);
    expect(
      movements()
        .filter((r) => r.space === "entitlement")
        .map((r) => r.amount)
    ).toEqual([3n]);
    expect(handlers.has("PhaseOneStatics:AggregatedRewardPaid")).toBe(false);
    expect(entries()[0].transactionSender).toBe(first);
    expect(movements()[1].actor).toBe(second);
    expect(rows.get("positionStatementHistory:phase-one:1")?.openingObserved).toBe(false);
  });
  it("separates internally recycled rebalance proceeds from wallet funding/refunds", async () => {
    rows.set(`publicPool:phase-one:${poolId}`, {
      key: `phase-one:${poolId}`,
      currency0: first,
      currency1: second,
    });
    rows.set(`managedGaugePosition:phase-one:1:${poolId}`, { key: `phase-one:1:${poolId}` });
    await run("ManagedLiquidityRebalanced", {
      ...base,
      args: {
        positionId: 1n,
        poolId,
        oldPosmTokenId: 8n,
        newPosmTokenId: 9n,
        manager: first,
        tickLower: -60,
        tickUpper: 60,
        movement: {
          liquidityBefore: 1n,
          liquidityAfter: 2n,
          payer: first,
          receiver: second,
          paid0: 1n,
          received0: 2n,
          paid1: 0n,
          received1: 0n,
        },
        settlement: {
          withdrawn0: 10n,
          withdrawn1: 0n,
          mintSpent0: 9n,
          mintReceived0: 0n,
          mintSpent1: 0n,
          mintReceived1: 0n,
        },
      },
    });
    expect(
      movements()
        .filter((r) => r.space === "wallet")
        .map((r) => [r.amount, r.actor])
    ).toEqual([
      [1n, first],
      [2n, second],
    ]);
    expect(
      movements()
        .filter((r) => r.space === "internal")
        .map((r) => r.amount)
    ).toEqual([10n, 9n]);
    expect(entries()[0]).toMatchObject({ posmTokenId: 8n, newPosmTokenId: 9n });
  });
  it("records exact intermediate allocation arrays rather than block-ending snapshots", async () => {
    await run("PositionGaugeAllocationsSet", {
      ...base,
      args: {
        positionId: 1n,
        nextAllocationAt: 100,
        totalAllocated: 2n,
        poolIds: [poolId],
        amounts: [2n],
      },
    });
    await run("PositionGaugeAllocationsSet", {
      ...base,
      args: {
        positionId: 1n,
        nextAllocationAt: 100,
        totalAllocated: 5n,
        poolIds: [poolId],
        amounts: [5n],
      },
    });
    expect(entries().map((r) => JSON.parse(r.payloadJson as string).amounts)).toEqual([
      ["2"],
      ["5"],
    ]);
    expect(rows.get("positionGaugeState:phase-one:1")?.amountsJson).toBe('["5"]');
  });
  it("records fees including successful zero-output collection without synthetic transfers", async () => {
    rows.set(`publicPool:phase-one:${poolId}`, {
      key: `phase-one:${poolId}`,
      currency0: first,
      currency1: second,
    });
    for (const amount0 of [0n, 1n])
      await run("ManagedLiquidityFeesCollected", {
        ...base,
        args: { positionId: 1n, poolId, posmTokenId: 8n, receiver: second, amount0, amount1: 0n },
      });
    expect(entries()).toHaveLength(2);
    expect(movements()).toHaveLength(1);
    expect(movements()[0]).toMatchObject({ purpose: "trading-fees", amount: 1n, actor: second });
  });
});

it("updates default hook rates without overwriting overrides or another deployment", async () => {
  for (const [id, deploymentId, overridden] of [
    ["default", "phase-one", false],
    ["override", "phase-one", true],
    ["other", "other-deployment", false],
  ] as const)
    rows.set(`publicPool:${id}`, {
      key: id,
      deploymentId,
      feeRateOverridden: overridden,
      inputFeeBps: 5,
      outputFeeBps: 5,
      updatedAtBlock: 99n,
    });
  const handler = handlers.get("PublicHook:DefaultFeeRateSet")!;
  await handler({
    event: { ...base, args: { inputFeeBps: 10, outputFeeBps: 15 } },
    context: { db, client: { readContract }, chain: { id: 4663 } },
  });
  expect(rows.get("publicPool:default")).toMatchObject({
    inputFeeBps: 10,
    outputFeeBps: 15,
    updatedAtBlock: 100n,
  });
  expect(rows.get("publicPool:override")).toMatchObject({
    inputFeeBps: 5,
    outputFeeBps: 5,
    updatedAtBlock: 99n,
  });
  expect(rows.get("publicPool:other")).toMatchObject({
    inputFeeBps: 5,
    outputFeeBps: 5,
    updatedAtBlock: 99n,
  });
  expect(readContract).not.toHaveBeenCalled();
  await handler({
    event: {
      ...base,
      args: { inputFeeBps: 0, outputFeeBps: 0 },
      block: { ...base.block, number: 101n },
    },
    context: { db, client: { readContract }, chain: { id: 4663 } },
  });
  expect(rows.get("publicPool:default")).toMatchObject({
    inputFeeBps: 0,
    outputFeeBps: 0,
    updatedAtBlock: 101n,
  });
});

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
  handlers.get(`PhaseOneStatics:${name}`)!({ event, context: { db, client: { readContract } } });
beforeEach(() => {
  rows.clear();
  readContract.mockReset();
});
describe("actual Phase 1 event handlers", () => {
  it("stores ending state for multiple allocation changes and wrapped wallet calls", async () => {
    readContract.mockResolvedValue([
      2000,
      5n,
      [{ poolId, amount: 5n, eligibilityVersion: poolId }],
      5n,
    ]);
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

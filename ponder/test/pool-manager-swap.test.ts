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
      "dexHistory",
      "dexPool",
      "dexRange",
      "dexState",
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
process.env.PONDER_POOL_MANAGER_ADDRESS = `0x${"4".repeat(40)}`;
process.env.PONDER_CANONICAL_POOL_ID = `0x${"a".repeat(64)}`;
await import("../src/index");

type Row = Record<string, unknown> & { key: string };
const rows = new Map<string, Row>();
const db = {
  find: async (table: string, identity: { key: string }) => rows.get(`${table}:${identity.key}`),
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
};
const poolId = `0x${"a".repeat(64)}`;
let logIndex = 0;
const swap = (amount0: bigint, amount1: bigint) =>
  handlers.get("PoolManager:Swap")!({
    event: {
      args: {
        id: poolId,
        sender: `0x${"5".repeat(40)}`,
        amount0,
        amount1,
        sqrtPriceX96: 2n ** 96n,
        liquidity: 1_000n,
        tick: 0,
        fee: 3_000,
      },
      log: { address: process.env.PONDER_POOL_MANAGER_ADDRESS, logIndex: logIndex++ },
      transaction: { hash: `0x${"b".repeat(64)}`, from: `0x${"5".repeat(40)}` },
      block: { number: 100n, timestamp: 120n, hash: `0x${"c".repeat(64)}` },
    },
    context: { db, chain: { id: 4663 } },
  });

beforeEach(() => {
  rows.clear();
  logIndex = 0;
});

describe("canonical PoolManager swaps", () => {
  it("counts direction from the swapper's v4 balance delta", async () => {
    // Zero-for-one: the swapper pays token0 (negative) and receives token1.
    await swap(-100n, 99n);
    // One-for-zero: the swapper pays token1 (negative) and receives token0.
    await swap(98n, -100n);
    await swap(97n, -100n);

    const candle = rows.get(`marketCandle:genesis:${poolId}:120`);
    expect(candle).toMatchObject({
      zeroForOneCount: 1,
      oneForZeroCount: 2,
      swapCount: 3,
      volume0: 295n,
      volume1: 299n,
    });
  });
});

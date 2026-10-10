import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("ponder:schema", () => ({
  dexPool: "pools",
  dexRange: "ranges",
  dexHistory: "history",
  dexState: "state",
}));
vi.mock("../src/allocation-snapshots", () => ({
  readTokenMetadata: vi.fn(async (_c, _e, address) => ({
    address,
    symbol: "TOKEN",
    name: "Token",
    decimals: 18,
  })),
}));
import { dexIndexer, type DexEvent } from "../src/dex-indexer";
const rows = new Map<string, Record<string, unknown>>();
const db = {
  find: async (t: string, i: { key: string }) => rows.get(`${t}:${i.key}`),
  insert: (t: string) => ({
    values: (r: Record<string, unknown>) => ({
      then: (resolve: (r: unknown) => void) => {
        rows.set(`${t}:${r.key}`, r);
        resolve(r);
      },
      onConflictDoUpdate: async (
        u: Record<string, unknown> | ((r: Record<string, unknown>) => Record<string, unknown>)
      ) => {
        const old = rows.get(`${t}:${r.key}`);
        rows.set(`${t}:${r.key}`, old ? { ...old, ...(typeof u === "function" ? u(old) : u) } : r);
      },
    }),
  }),
  update: (t: string, i: { key: string }) => ({
    set: async (u: Record<string, unknown>) => {
      const k = `${t}:${i.key}`;
      if (!rows.has(k)) throw Error("missing");
      rows.set(k, { ...rows.get(k), ...u });
    },
  }),
};
const context = { db, chain: { id: 4663 } } as unknown as Parameters<
  ReturnType<typeof dexIndexer>["swap"]
>[0];
const id = `0x${"a".repeat(64)}` as const,
  hash = `0x${"b".repeat(64)}` as const,
  address = `0x${"1".repeat(40)}` as const;
let index = 0;
const event = (args: Record<string, unknown>, timestamp = 100n): DexEvent => ({
  args,
  transaction: { hash, from: address },
  log: { logIndex: index++ },
  block: { number: 1n, hash, timestamp },
});
const init = () =>
  event({
    id,
    poolId: id,
    currency0: address,
    currency1: `0x${"2".repeat(40)}`,
    fee: 3000,
    lpFee: 3000,
    tickSpacing: 60,
    hooks: address,
    sqrtPriceX96: 1n << 96n,
    tick: 0,
  });
const domain = () => dexIndexer("selected", "genesis");
const pool = () => JSON.parse(String(rows.get(`pools:selected:${id}`)?.details));
beforeEach(() => {
  rows.clear();
  index = 0;
});
describe("DEX event indexing", () => {
  it("ignores unrelated pools and retains direct/POL range identities", async () => {
    const d = domain();
    await d.modify(context, event({ id, liquidityDelta: 1n }));
    expect(rows.size).toBe(0);
    await d.initialize(context, init(), "genesis");
    await d.modify(
      context,
      event({
        id,
        sender: address,
        tickLower: -60,
        tickUpper: 60,
        salt: hash,
        liquidityDelta: 100n,
      })
    );
    await d.modify(
      context,
      event({
        id,
        sender: address,
        tickLower: -60,
        tickUpper: 60,
        salt: hash,
        liquidityDelta: -100n,
      })
    );
    expect([...rows.keys()].filter((k) => k.startsWith("ranges:"))).toHaveLength(1);
    expect([...rows.values()].filter((r) => r.kind === "range")).toHaveLength(2);
    expect(pool()).toMatchObject({
      source: "genesis",
      liquidityComplete: true,
      sourceDeploymentId: "genesis",
    });
  });
  it("pairs repeated same-block swaps without duplicating market tape trades", async () => {
    const d = domain();
    await d.diamond("ProtocolPoolCreated", context, init());
    for (let n = 0; n < 2; n++) {
      await d.swap(
        context,
        event({
          id,
          sender: address,
          amount0: -99n,
          amount1: 101n,
          sqrtPriceX96: 1n << 96n,
          tick: n,
        })
      );
      await d.diamond(
        "MarketSwapRecorded",
        context,
        event({
          poolId: id,
          poolDelta: (-99n << 128n) | 101n,
          staticsFeesPacked: (2n << 128n) | 1n,
          nativeLpFee: 3000,
          flags: n ? 4 : 0,
        })
      );
    }
    const trades = [...rows.values()]
      .filter((r) => r.kind === "swap")
      .map((r) => JSON.parse(String(r.details)));
    expect(trades).toHaveLength(2);
    expect(trades[0]).toMatchObject({
      amountIn: "100",
      amountOut: "99",
      complete: true,
      internal: false,
      transactionSender: address,
    });
    expect(trades[1].internal).toBe(true);
  });
  it("fails closed on inconsistent source association", async () => {
    const d = domain();
    await d.diamond("ProtocolPoolCreated", context, init());
    await expect(d.diamond("MarketSwapRecorded", context, event({ poolId: id }))).rejects.toThrow(
      /matching/
    );
  });
  it("models managed topology, funding and stop without interpreting treasury sweep as accrual", async () => {
    const d = domain();
    await d.diamond("ProtocolPoolCreated", context, init());
    await d.diamond(
      "ManagedLiquidityAttached",
      context,
      event({ poolId: id, positionId: 1n, tickLower: -60, tickUpper: 60, liquidity: 100n })
    );
    await d.diamond(
      "PoolRewardFunded",
      context,
      event({ poolId: id, asset: address, slot: 1, lpAmount: 100n, periodFinish: 200n })
    );
    await d.diamond("PoolGaugeStopped", context, event({ poolId: id }, 150n));
    expect(pool().stopped).toBe(true);
    expect(pool().streams[0].emitted).toBe("50");
    await d.diamond(
      "ProtocolGaugeRewardRecycled",
      context,
      event({ poolId: id, amount: 100n }, 250n)
    );
    expect(pool().streams[0].emitted).toBe("50");
  });
});

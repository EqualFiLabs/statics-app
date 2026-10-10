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
  vi.unstubAllEnvs();
});
describe("DEX event indexing", () => {
  it("anchors inherited prices at the fork snapshot without reading historical swaps", async () => {
    vi.stubEnv("PONDER_POOL_MANAGER_START_BLOCK", "1000");
    vi.stubEnv("PONDER_STATE_VIEW_ADDRESS", address);
    const client = {
      getBlock: vi.fn(async () => ({ timestamp: 2000n })),
      readContract: vi.fn(async () => [1n << 97n, 10, 0, 15000]),
    };
    const c = { ...context, client } as unknown as typeof context;
    await domain().initialize(c, init(), "genesis");
    expect(client.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getSlot0", blockNumber: 1000n, args: [id] })
    );
    expect(pool()).toMatchObject({
      historyStart: "2000",
      priceHistoryStart: "2000",
      priceTime: "2000",
      tick: 10,
    });
    expect([...rows.values()].filter((r) => r.kind === "swap")).toHaveLength(0);
  });
  it("waits for the first fork swap when no snapshot reader is configured", async () => {
    vi.stubEnv("PONDER_POOL_MANAGER_START_BLOCK", "1000");
    const c = {
      ...context,
      client: { getBlock: async () => ({ timestamp: 2000n }) },
    } as unknown as typeof context;
    const d = domain();
    await d.initialize(c, init(), "genesis");
    expect(pool().sqrtPriceX96).toBe("0");
    await d.swap(
      c,
      event(
        { id, sender: address, amount0: -1n, amount1: 0n, sqrtPriceX96: 1n << 96n, tick: 0 },
        2050n
      )
    );
    expect(pool()).toMatchObject({ priceHistoryStart: "2050", priceTime: "2050", cumulative: "0" });
    expect([...rows.values()].filter((r) => r.kind === "swap")).toHaveLength(1);
  });
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
  it("settles valid public swaps with a zero output", async () => {
    const d = domain();
    await d.diamond("ProtocolPoolCreated", context, init());
    await d.swap(
      context,
      event({ id, sender: address, amount0: -1n, amount1: 0n, sqrtPriceX96: 1n << 96n, tick: 0 })
    );
    await d.diamond(
      "MarketSwapRecorded",
      context,
      event({
        poolId: id,
        poolDelta: -1n << 128n,
        staticsFeesPacked: 0n,
        nativeLpFee: 3000,
        flags: 0,
      })
    );
    const trade = JSON.parse(String([...rows.values()].find((r) => r.kind === "swap")?.details));
    expect(trade).toMatchObject({ amountIn: "1", amountOut: "0", complete: true });
  });
  it("records reserve/directory observations for reorg validation without duplicate keys", async () => {
    const d = domain(),
      e = event({});
    await d.observe(context, e);
    await d.observe(context, e);
    expect([...rows.values()].filter((r) => r.kind === "observation")).toHaveLength(1);
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

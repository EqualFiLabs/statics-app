import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../ponder.schema";
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("ponder:api", () => ({ db: { execute } }));
vi.mock("ponder:schema", () => schema);
import { dexMarketRoutes } from "../src/api/dex-market";
import { pool, range, points } from "./dex-fixtures";
const client = new PGlite(),
  database = drizzle(client);
let now = 0;
const app = dexMarketRoutes("selected", () => now);
const checkpoint = (time: number) =>
  String(time).padStart(10, "0") +
  "4663".padStart(16, "0") +
  "100".padStart(16, "0") +
  "0".repeat(33);
beforeAll(async () => {
  for (const table of [
    schema.dexPool,
    schema.dexRange,
    schema.dexHistory,
    schema.dexState,
    schema.allocationToken,
    schema.gaugeReserveState,
    schema.allocationDirectoryPool,
  ]) {
    const c = getTableConfig(table);
    await client.exec(
      `CREATE TABLE "${c.name}" (${c.columns.map((c) => `"${c.name}" ${c.getSQLType()}`).join(",")})`
    );
  }
  await client.exec(
    "CREATE TABLE _ponder_checkpoint (chain_name text,latest_checkpoint text); CREATE TABLE _ponder_meta (key text,value jsonb);"
  );
  execute.mockImplementation((q) => database.execute(q));
  process.env.PONDER_PRICING_QUOTE_WETH = pool().token1.address;
  process.env.PONDER_PRICING_MIN_LIQUIDITY_WETH = "0";
});
afterAll(() => client.close());
beforeEach(async () => {
  now += 400000;
  await client.exec(
    "TRUNCATE dex_pool,dex_range,dex_history,dex_state,allocation_token,gauge_reserve_state,allocation_directory_pool,_ponder_checkpoint,_ponder_meta"
  );
  await client.query("INSERT INTO _ponder_checkpoint VALUES ('active',$1)", [checkpoint(200000)]);
  await client.query("INSERT INTO _ponder_meta VALUES ('app',$1)", [
    JSON.stringify({ build_id: "test" }),
  ]);
  for (const n of [1, 2, 3]) {
    const p = pool(n),
      r = range(p),
      point = points(p)[0]!;
    await database.insert(schema.dexPool).values({
      key: String(n),
      deploymentId: "selected",
      poolId: p.poolId as `0x${string}`,
      details: JSON.stringify(p),
      updatedAtBlock: 1n,
    });
    await database.insert(schema.dexRange).values({
      key: String(n),
      deploymentId: "selected",
      poolId: p.poolId as `0x${string}`,
      details: JSON.stringify(r),
      updatedAtBlock: 1n,
    });
    await database.insert(schema.dexHistory).values({
      key: String(n),
      deploymentId: "selected",
      poolId: p.poolId as `0x${string}`,
      kind: "pool",
      details: JSON.stringify({ ...p, ...point }),
      blockNumber: 1n,
      blockHash: `0x${"01".repeat(32)}`,
      timestamp: 0n,
      logIndex: n,
    });
  }
});
describe("DEX endpoints with real SQL and bounded snapshots", () => {
  it("invalidates pages when a reserve/directory-only event is reorganized", async () => {
    await database.insert(schema.dexHistory).values({
      key: "directory-event",
      deploymentId: "selected",
      poolId: `0x${"00".repeat(32)}`,
      kind: "observation",
      details: "{}",
      blockNumber: 2n,
      blockHash: `0x${"02".repeat(32)}`,
      timestamp: 1n,
      logIndex: 1,
    });
    const first = await (await app.request("/phase-one/market/pools?limit=1")).json();
    await client.query("DELETE FROM dex_history WHERE key=$1", ["directory-event"]);
    const response = await app.request(
      `/phase-one/market/pools?limit=1&cursor=${first.nextCursor}`
    );
    expect(response.status).toBe(409);
  });
  it("serves all six endpoints without RPC calls and honors quote fallback and day ranges", async () => {
    for (const section of ["summary", "pools", "tokens", "volume", "emissions", "trades"]) {
      const response = await app.request(`/phase-one/market/${section}?days=3`);
      const body = await response.json();
      expect(response.status, JSON.stringify(body)).toBe(200);
      expect(body.quote.kind).toBe("weth");
      expect(body.indexedAtBlock).toBe("100");
      if (section === "volume") expect(body.days).toHaveLength(3);
    }
  });
  it("holds pages stable during new trades and rejects expiry, mismatches and replay", async () => {
    const first = await (await app.request("/phase-one/market/pools?limit=1")).json();
    expect(first.total).toBe(3);
    expect(first.nextCursor).not.toBeNull();
    await client.query("UPDATE _ponder_checkpoint SET latest_checkpoint=$1", [checkpoint(200010)]);
    const response = await app.request(
      `/phase-one/market/pools?limit=1&cursor=${first.nextCursor}`
    );
    const second = await response.json();
    expect(response.status).toBe(200);
    expect(second.indexedAtTimestamp).toBe(first.indexedAtTimestamp);
    expect(second.items[0].poolId).not.toBe(first.items[0].poolId);
    expect(
      (
        await app.request(
          `/phase-one/market/pools?limit=1&direction=asc&cursor=${first.nextCursor}`
        )
      ).status
    ).toBe(400);
    await client.exec("UPDATE _ponder_meta SET value='{}'");
    expect(
      (await app.request(`/phase-one/market/pools?limit=1&cursor=${first.nextCursor}`)).status
    ).toBe(409);
    now += 300001;
    expect(
      (await app.request(`/phase-one/market/pools?limit=1&cursor=${second.nextCursor}`)).status
    ).toBe(409);
  });
  it("rejects malformed limits, filters and quote choices before querying", async () => {
    for (const query of [
      "days=0",
      "days=91",
      "limit=101",
      "direction=foo",
      "sort=no",
      "quote=no",
      "cursor=",
    ]) {
      execute.mockClear();
      expect((await app.request(`/phase-one/market/pools?${query}`)).status).toBe(400);
      expect(execute).not.toHaveBeenCalled();
    }
    expect((await app.request("/phase-one/market/trades?limit=51")).status).toBe(400);
  });
  it("returns literal search counts and deterministic numeric pages", async () => {
    const result = await (
      await app.request("/phase-one/market/pools?sort=created&direction=asc&search=0001")
    ).json();
    expect(result.total).toBeGreaterThan(0);
    expect(result.items[0].poolId).toBe(pool(1).poolId);
  });
});

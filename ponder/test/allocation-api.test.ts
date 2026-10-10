import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../ponder.schema";
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("ponder:api", () => ({ db: { execute } }));
vi.mock("ponder:schema", () => schema);
import { allocationPoolRoutes } from "../src/api/allocation-pools";
const client = new PGlite(),
  database = drizzle(client),
  app = allocationPoolRoutes("selected");
const poolId = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as const;
beforeAll(async () => {
  for (const table of [
    schema.allocationDirectoryPool,
    schema.allocationDirectoryState,
    schema.gaugeReserveState,
  ]) {
    const config = getTableConfig(table);
    await client.exec(
      `CREATE TABLE "${config.name}" (${config.columns.map((c) => `"${c.name}" ${c.getSQLType()}`).join(",")})`
    );
  }
  execute.mockImplementation((query) => database.execute(query));
});
afterAll(() => client.close());
beforeEach(async () => {
  await client.exec(
    "TRUNCATE allocation_directory_pool, allocation_directory_state, gauge_reserve_state"
  );
  await database.insert(schema.allocationDirectoryState).values({
    key: "selected",
    deploymentId: "selected",
    revision: 1n,
    indexedAtBlock: 100n,
    indexedAtTimestamp: 1000n,
  });
  for (const [n, weight, eligible, incentives] of [
    [1, 9n, true, 0],
    [2, 100n, true, 2],
    [3, 100n, true, 1],
    [4, 10000n, false, 4],
  ] as const) {
    await database.insert(schema.allocationDirectoryPool).values({
      key: `selected:${poolId(n)}`,
      deploymentId: "selected",
      poolId: poolId(n),
      eligible,
      weight,
      incentiveStreamCount: incentives,
      createdAtBlock: BigInt(n),
      searchText: n === 1 ? "weth %_stock" : "wbtc stock",
      detailsJson: JSON.stringify({ poolId: poolId(n), weight: weight.toString() }),
    });
  }
  await database.insert(schema.allocationDirectoryPool).values({
    key: "foreign",
    deploymentId: "foreign",
    poolId: poolId(5),
    eligible: true,
    weight: 99999n,
    incentiveStreamCount: 4,
    createdAtBlock: 5n,
    searchText: "wbtc",
    detailsJson: "{}",
  });
});
describe("allocation endpoint with PostgreSQL query execution", () => {
  it("sorts numerically and follows deterministic cursors with a full filtered count", async () => {
    const first = await app.request("/phase-one/allocation-pools?limit=1"),
      a = await first.json();
    expect(first.status).toBe(200);
    expect(a.total).toBe(3);
    expect(a.items[0]).toMatchObject({ poolId: poolId(3), weight: "100" });
    const b = await (
      await app.request(`/phase-one/allocation-pools?limit=1&cursor=${a.nextCursor}`)
    ).json();
    expect(b.items[0].poolId).toBe(poolId(2));
    expect(b.total).toBe(3);
    const c = await (
      await app.request(`/phase-one/allocation-pools?limit=1&cursor=${b.nextCursor}`)
    ).json();
    expect(c.items[0].poolId).toBe(poolId(1));
    expect(c.nextCursor).toBeNull();
  });
  it("supports ascending, creation and incentive sorts, paused incentive counts and ineligible inclusion", async () => {
    const body = async (query: string) =>
      (await app.request(`/phase-one/allocation-pools?${query}`)).json();
    expect((await body("direction=asc")).items[0].poolId).toBe(poolId(1));
    expect((await body("sort=created")).items[0].poolId).toBe(poolId(3));
    expect((await body("sort=incentives")).items[0].poolId).toBe(poolId(2));
    expect((await body("eligible=all")).total).toBe(4);
    expect((await body("eligible=false")).total).toBe(4);
    expect((await body("hasIncentives=false")).total).toBe(1);
    expect((await body("hasIncentives=true")).total).toBe(2);
  });
  it("searches literally rather than treating percent and underscore as wildcards", async () => {
    const response = await app.request("/phase-one/allocation-pools?search=%25_STOCK");
    expect((await response.json()).items.map((p: { poolId: string }) => p.poolId)).toEqual([
      poolId(1),
    ]);
  });
  it("rejects changed directories and filter/order/deployment mismatches", async () => {
    const first = await (await app.request("/phase-one/allocation-pools?limit=1")).json();
    expect(
      (
        await app.request(
          `/phase-one/allocation-pools?limit=1&direction=asc&cursor=${first.nextCursor}`
        )
      ).status
    ).toBe(400);
    await database.update(schema.allocationDirectoryState).set({ revision: 2n });
    const response = await app.request(
      `/phase-one/allocation-pools?limit=1&cursor=${first.nextCursor}`
    );
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("DIRECTORY_CHANGED");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("returns explicit empty snapshots without leaking another deployment", async () => {
    const response = await allocationPoolRoutes("missing").request("/phase-one/allocation-pools");
    expect(await response.json()).toMatchObject({
      items: [],
      reserve: null,
      total: 0,
      indexedAtBlock: null,
      directoryRevision: "0",
      nextCursor: null,
    });
  });
  it.each(["limit=101", "limit=0", "cursor=", "sort=usd", "eligible=yes"])(
    "rejects invalid query %s before touching the database",
    async (query) => {
      execute.mockClear();
      expect((await app.request(`/phase-one/allocation-pools?${query}`)).status).toBe(400);
      expect(execute).not.toHaveBeenCalled();
    }
  );
});

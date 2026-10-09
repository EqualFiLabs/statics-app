import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../ponder.schema";
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("ponder:api", () => ({ db: { execute } }));
vi.mock("ponder:schema", () => schema);
import { positionStatementRoutes } from "../src/api/position-statement";
const client = new PGlite(),
  database = drizzle(client),
  app = positionStatementRoutes("selected");
const hash = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as const;
const wallet = `0x${"1".repeat(40)}` as const,
  asset = `0x${"2".repeat(40)}` as const;
beforeAll(async () => {
  for (const table of [
    schema.positionStatement,
    schema.positionStatementMovement,
    schema.positionStatementHistory,
    schema.positionStatementBlock,
    schema.allocationToken,
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
    "TRUNCATE position_statement, position_statement_movement, position_statement_history, position_statement_block, allocation_token"
  );
  await database.insert(schema.positionStatementHistory).values({
    key: "selected:30",
    deploymentId: "selected",
    positionId: 30n,
    owner: null,
    lastOwner: wallet,
    firstBlock: 90n,
    openingObserved: true,
  });
  await database.insert(schema.positionStatementBlock).values({
    key: "selected:100",
    deploymentId: "selected",
    blockNumber: 100n,
    blockHash: hash(100),
    blockTimestamp: 1000n,
    digest: hash(777),
  });
  for (const [i, block, category] of [
    [1, 90, "lifecycle"],
    [2, 100, "liquidity"],
    [3, 100, "rewards"],
  ] as const) {
    const key = `selected:${hash(i)}:${i}`;
    await database.insert(schema.positionStatement).values({
      key,
      deploymentId: "selected",
      positionId: 30n,
      eventName: "fixture",
      category,
      transactionHash: hash(i),
      logIndex: i,
      blockNumber: BigInt(block),
      blockHash: hash(block),
      blockTimestamp: BigInt(block * 10),
      transactionSender: wallet,
      ownerBefore: wallet,
      ownerAfter: null,
      poolId: i === 1 ? null : hash(5),
      posmTokenId: i === 1 ? null : 8n,
      newPosmTokenId: null,
      payloadJson: JSON.stringify({ asset: i === 3 ? asset : undefined }),
    });
    if (i === 2)
      await database.insert(schema.positionStatementMovement).values({
        key: `${key}:0`,
        statementKey: key,
        ordinal: 0,
        chainId: 4663,
        asset,
        space: "wallet",
        direction: "credit",
        purpose: "liquidity-output",
        actor: wallet,
        amount: 1n,
      });
  }
});
describe("lifetime statements over PostgreSQL", () => {
  it("keeps closed history, block/log order, nullable metadata and exact tiny amounts", async () => {
    const response = await app.request("/phase-one/positions/30/statement"),
      body = await response.json();
    expect(response.status).toBe(200);
    expect(body.items.map((r: { logIndex: number }) => r.logIndex)).toEqual([3, 2, 1]);
    expect(body.items[1].movements[0]).toMatchObject({
      amount: "1",
      asset: { address: asset, symbol: null, decimals: null },
    });
    expect(body.historyStart.openingObserved).toBe(true);
  });
  it("binds pages to a stable boundary while new blocks arrive", async () => {
    const first = await (await app.request("/phase-one/positions/30/statement?limit=1")).json();
    await database.insert(schema.positionStatementBlock).values({
      key: "selected:101",
      deploymentId: "selected",
      blockNumber: 101n,
      blockHash: hash(101),
      blockTimestamp: 1010n,
      digest: hash(778),
    });
    const next = await (
      await app.request(`/phase-one/positions/30/statement?limit=1&cursor=${first.nextCursor}`)
    ).json();
    expect(next.items[0].logIndex).toBe(2);
    expect(next.observationBoundary).toEqual(first.observationBoundary);
    const ascending = await (
      await app.request("/phase-one/positions/30/statement?direction=asc")
    ).json();
    expect(ascending.items.map((r: { logIndex: number }) => r.logIndex)).toEqual([1, 2, 3]);
  });
  it("filters pool, category, asset and block ranges without live reads", async () => {
    const request = async (q: string) =>
      (await app.request(`/phase-one/positions/30/statement?${q}`)).json();
    expect((await request(`asset=${asset}`)).items).toHaveLength(2);
    expect(
      (await request(`category=liquidity&poolId=${hash(5)}&fromBlock=100&toBlock=100`)).items
    ).toHaveLength(1);
    expect((await request(`asset=0x${"3".repeat(40)}`)).items).toEqual([]);
  });
  it("rejects malformed and mismatched cursors and returns an explicit replay/reorg restart", async () => {
    const first = await (await app.request("/phase-one/positions/30/statement?limit=1")).json();
    for (const query of [
      "cursor=bad",
      `limit=1&direction=asc&cursor=${first.nextCursor}`,
      `limit=2&cursor=${first.nextCursor}`,
      "limit=101",
      "fromBlock=2&toBlock=1",
      "category=unknown",
    ])
      expect((await app.request(`/phase-one/positions/30/statement?${query}`)).status).toBe(400);
    await client.exec("UPDATE position_statement_block SET digest = '" + hash(999) + "'");
    const response = await app.request(
      `/phase-one/positions/30/statement?limit=1&cursor=${first.nextCursor}`
    );
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("STATEMENT_HISTORY_CHANGED");
    await client.exec("TRUNCATE position_statement_block");
    expect(
      (await app.request(`/phase-one/positions/30/statement?limit=1&cursor=${first.nextCursor}`))
        .status
    ).toBe(409);
  });
  it("returns 404 only for unknown NFTs, including out-of-range and deployment-bound inputs", async () => {
    expect((await app.request("/phase-one/positions/99/statement")).status).toBe(404);
    expect((await app.request(`/phase-one/positions/${1n << 256n}/statement`)).status).toBe(400);
  });
});

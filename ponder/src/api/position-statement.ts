import { sql } from "ponder";
import { db } from "ponder:api";
import { Hono } from "hono";
import { isAddress, isHash } from "viem";
import {
  positionStatement as entries,
  positionStatementHistory as history,
  positionStatementBlock as blocks,
  positionStatementMovement as movements,
  allocationToken as tokens,
  publicPool as pools,
  positionStatementConfig as config,
} from "ponder:schema";

const categories = ["lifecycle", "staking", "liquidity", "allocations", "rewards"];
const unsigned = (value: unknown): value is string =>
  typeof value === "string" && /^(0|[1-9]\d*)$/.test(value) && BigInt(value) < 1n << 256n;
export function statementQuery(params: URLSearchParams) {
  const category = params.get("category"),
    poolId = params.get("poolId")?.toLowerCase() ?? null,
    asset = params.get("asset")?.toLowerCase() ?? null,
    fromBlock = params.get("fromBlock"),
    toBlock = params.get("toBlock"),
    direction = params.get("direction") ?? "desc",
    limit = params.get("limit") ?? "25";
  if (
    (category !== null && !categories.includes(category)) ||
    (poolId !== null && !isHash(poolId)) ||
    (asset !== null && !isAddress(asset)) ||
    (fromBlock !== null && !unsigned(fromBlock)) ||
    (toBlock !== null && !unsigned(toBlock)) ||
    (fromBlock !== null && toBlock !== null && BigInt(fromBlock) > BigInt(toBlock)) ||
    !["asc", "desc"].includes(direction) ||
    !unsigned(limit) ||
    Number(limit) < 1 ||
    Number(limit) > 100
  )
    return null;
  return {
    category,
    poolId,
    asset,
    fromBlock,
    toBlock,
    direction: direction as "asc" | "desc",
    limit: Number(limit),
  };
}
type Query = NonNullable<ReturnType<typeof statementQuery>>;
type Boundary = { blockNumber: string; blockHash: string; digest: string; timestamp: string };
type Cursor = {
  version: 1;
  scope: string;
  boundary: Boundary;
  after: { blockNumber: string; logIndex: number };
};
export function statementScope(deploymentId: string, positionId: string, query: Query) {
  return JSON.stringify([deploymentId, positionId, query]);
}
export function encodeStatementCursor(value: Cursor) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
export function decodeStatementCursor(value: string, scope: string): Cursor | null {
  try {
    if (!value || value.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    const c = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor;
    if (
      c.version !== 1 ||
      c.scope !== scope ||
      !unsigned(c.boundary.blockNumber) ||
      !unsigned(c.boundary.timestamp) ||
      !isHash(c.boundary.blockHash) ||
      !isHash(c.boundary.digest) ||
      !unsigned(c.after.blockNumber) ||
      BigInt(c.after.blockNumber) > BigInt(c.boundary.blockNumber) ||
      !Number.isSafeInteger(c.after.logIndex) ||
      c.after.logIndex < 0
    )
      return null;
    return c;
  } catch {
    return null;
  }
}
export function statementPageSql(
  deploymentId: string,
  positionId: string,
  query: Query,
  cursor: Cursor | null
) {
  const order = query.direction === "asc" ? sql`asc` : sql`desc`,
    comparison = query.direction === "asc" ? sql`>` : sql`<`;
  const boundaryFilter = cursor
    ? sql`${blocks.blockNumber} = ${cursor.boundary.blockNumber}::numeric`
    : sql`true`;
  const after = cursor
    ? sql`(${entries.blockNumber}, ${entries.logIndex}) ${comparison} (${cursor.after.blockNumber}::numeric, ${cursor.after.logIndex})`
    : sql`true`;
  // The boundary, history and page share one PostgreSQL MVCC snapshot. No live RPC reads.
  return sql`WITH boundary AS (
    SELECT ${blocks.blockNumber} AS number, ${blocks.blockHash} AS hash, ${blocks.digest} AS digest, ${blocks.blockTimestamp} AS time
    FROM ${blocks} WHERE ${blocks.deploymentId} = ${deploymentId} AND ${boundaryFilter} ORDER BY ${blocks.blockNumber} DESC LIMIT 1
  ), page AS (
    SELECT ${entries.key} AS key, ${entries.positionId} AS position_id, ${entries.eventName} AS event_name, ${entries.category} AS category,
      ${entries.transactionHash} AS tx, ${entries.logIndex} AS log_index, ${entries.blockNumber} AS block_number, ${entries.blockHash} AS block_hash,
      ${entries.blockTimestamp} AS time, ${entries.transactionSender} AS sender, ${entries.ownerBefore} AS owner_before, ${entries.ownerAfter} AS owner_after,
      ${entries.poolId} AS pool_id, ${entries.posmTokenId} AS posm, ${entries.newPosmTokenId} AS new_posm, ${entries.payloadJson} AS payload
    FROM ${entries} WHERE ${entries.deploymentId} = ${deploymentId} AND ${entries.positionId} = ${positionId}::numeric
      AND ${entries.blockNumber} <= (SELECT number FROM boundary)
      AND (${query.category === null} OR ${entries.category} = ${query.category})
      AND (${query.poolId === null} OR lower(${entries.poolId}) = ${query.poolId} OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(coalesce(${entries.payloadJson}::jsonb->'poolIds', '[]'::jsonb)) AS allocation_pool WHERE lower(allocation_pool) = ${query.poolId}))
      AND (${query.fromBlock === null} OR ${entries.blockNumber} >= ${query.fromBlock}::numeric)
      AND (${query.toBlock === null} OR ${entries.blockNumber} <= ${query.toBlock}::numeric)
      AND (${query.asset === null} OR EXISTS (SELECT 1 FROM ${movements} WHERE ${movements.statementKey} = ${entries.key} AND lower(${movements.asset}) = ${query.asset}) OR lower(${entries.payloadJson}::json->>'asset') = ${query.asset})
      AND ${after} ORDER BY ${entries.blockNumber} ${order}, ${entries.logIndex} ${order} LIMIT ${query.limit + 1}
  ) SELECT json_build_object(
    'history', (SELECT json_build_object('blockNumber', ${history.firstBlock}::text, 'openingObserved', ${history.openingObserved}) FROM ${history} WHERE ${history.key} = ${`${deploymentId}:${positionId}`}),
    'boundary', (SELECT json_build_object('blockNumber', number::text, 'blockHash', hash, 'digest', digest, 'timestamp', time::text) FROM boundary),
    'items', coalesce((SELECT json_agg(json_build_object(
      'key', page.key, 'positionId', position_id::text, 'eventName', event_name, 'category', category, 'transactionHash', tx, 'logIndex', log_index,
      'blockNumber', block_number::text, 'blockHash', block_hash, 'timestamp', time::text, 'transactionSender', sender, 'ownerBefore', owner_before, 'ownerAfter', owner_after,
      'poolId', pool_id, 'posmTokenId', posm::text, 'newPosmTokenId', new_posm::text, 'payload', payload::json,
      'poolCurrencies', CASE WHEN category = 'liquidity' THEN (SELECT json_build_array(${pools.currency0}, ${pools.currency1}) FROM ${pools} WHERE ${pools.deploymentId} = ${deploymentId} AND lower(${pools.poolId}) = lower(pool_id)) ELSE NULL END,
      'stakingAsset', CASE WHEN event_name IN ('Staked','Unstaked') THEN (SELECT ${config.stakingAsset} FROM ${config} WHERE ${config.key} = ${deploymentId}) ELSE NULL END,
      'movements', coalesce((SELECT json_agg(json_build_object(
        'ordinal', ${movements.ordinal}, 'asset', json_build_object('address', ${movements.asset}, 'symbol', ${tokens.symbol}, 'name', ${tokens.name}, 'decimals', ${tokens.decimals}),
        'space', ${movements.space}, 'direction', ${movements.direction}, 'purpose', ${movements.purpose}, 'actor', ${movements.actor}, 'amount', ${movements.amount}::text
      ) ORDER BY ${movements.ordinal}) FROM ${movements} LEFT JOIN ${tokens} ON ${tokens.chainId} = ${movements.chainId} AND lower(${tokens.address}) = lower(${movements.asset}) WHERE ${movements.statementKey} = page.key), '[]'::json)
    ) ORDER BY block_number ${order}, log_index ${order}) FROM page), '[]'::json)
  ) AS payload`;
}
type Snapshot = {
  history: { blockNumber: string; openingObserved: boolean } | null;
  boundary: Boundary | null;
  items: { blockNumber: string; logIndex: number }[];
};
export function positionStatementRoutes(deploymentId: string) {
  const app = new Hono();
  app.get("/phase-one/positions/:positionId/statement", async (context) => {
    const positionId = context.req.param("positionId"),
      params = new URL(context.req.url).searchParams,
      query = statementQuery(params);
    if (!unsigned(positionId) || !query)
      return context.json({ error: "Invalid position statement query." }, 400);
    const scope = statementScope(deploymentId, positionId, query),
      rawCursor = params.get("cursor"),
      cursor = rawCursor === null ? null : decodeStatementCursor(rawCursor, scope);
    if (rawCursor !== null && !cursor)
      return context.json({ error: "Invalid or mismatched statement cursor." }, 400);
    const result = await db.execute(statementPageSql(deploymentId, positionId, query, cursor));
    const snapshot = (result.rows[0] as { payload: Snapshot }).payload;
    if (
      cursor &&
      (!snapshot.boundary ||
        cursor.boundary.blockNumber !== snapshot.boundary.blockNumber ||
        cursor.boundary.blockHash !== snapshot.boundary.blockHash ||
        cursor.boundary.digest !== snapshot.boundary.digest ||
        cursor.boundary.timestamp !== snapshot.boundary.timestamp)
    ) {
      context.header("Cache-Control", "no-store");
      return context.json(
        {
          code: "STATEMENT_HISTORY_CHANGED",
          error: "Statement history changed. Restart from the first page.",
        },
        409
      );
    }
    if (!snapshot.history) return context.json({ error: "Unknown Position NFT." }, 404);
    const items = snapshot.items.slice(0, query.limit),
      last = items.at(-1);
    const nextCursor =
      snapshot.items.length > query.limit && last && snapshot.boundary
        ? encodeStatementCursor({
            version: 1,
            scope,
            boundary: snapshot.boundary,
            after: { blockNumber: last.blockNumber, logIndex: last.logIndex },
          })
        : null;
    context.header("Cache-Control", "public, max-age=5, stale-while-revalidate=15");
    return context.json({
      deploymentId,
      positionId,
      historyStart: snapshot.history,
      observationBoundary: snapshot.boundary,
      items,
      nextCursor,
    });
  });
  return app;
}

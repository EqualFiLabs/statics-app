import { sql } from "ponder";
import { db } from "ponder:api";
import { Hono } from "hono";
import { isHash } from "viem";
import {
  allocationDirectoryPool as pools,
  allocationDirectoryState as state,
  gaugeReserveState as reserve,
} from "ponder:schema";

export type AllocationDirectoryQuery = {
  search: string;
  eligible: boolean;
  hasIncentives: boolean | null;
  sort: "weight" | "incentives" | "created";
  direction: "asc" | "desc";
  limit: number;
};
type Cursor = { version: 1; scope: string; revision: string; value: string; poolId: string };
export function allocationDirectoryQuery(params: URLSearchParams): AllocationDirectoryQuery | null {
  const eligible = params.get("eligible") ?? "true",
    incentives = params.get("hasIncentives"),
    sort = params.get("sort") ?? "weight",
    direction = params.get("direction") ?? "desc",
    limit = params.get("limit") ?? "25";
  const search = (params.get("search") ?? "").trim().toLowerCase();
  if (
    !["true", "false", "all"].includes(eligible) ||
    (incentives !== null && !["true", "false"].includes(incentives)) ||
    !["weight", "incentives", "created"].includes(sort) ||
    !["asc", "desc"].includes(direction) ||
    !/^\d+$/.test(limit) ||
    Number(limit) < 1 ||
    Number(limit) > 100 ||
    search.length > 256
  )
    return null;
  return {
    search,
    eligible: eligible === "true",
    hasIncentives: incentives === null ? null : incentives === "true",
    sort: sort as AllocationDirectoryQuery["sort"],
    direction: direction as AllocationDirectoryQuery["direction"],
    limit: Number(limit),
  };
}
export function directoryCursorScope(deploymentId: string, query: AllocationDirectoryQuery) {
  return JSON.stringify([
    deploymentId,
    query.search,
    query.eligible,
    query.hasIncentives,
    query.sort,
    query.direction,
    query.limit,
  ]);
}
export function encodeDirectoryCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}
export function decodeDirectoryCursor(value: string, scope: string): Cursor | null {
  try {
    if (!value || value.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor;
    if (
      cursor.version !== 1 ||
      cursor.scope !== scope ||
      typeof cursor.revision !== "string" ||
      !/^\d+$/.test(cursor.revision) ||
      typeof cursor.value !== "string" ||
      !/^\d+$/.test(cursor.value) ||
      !isHash(cursor.poolId)
    )
      return null;
    return cursor;
  } catch {
    return null;
  }
}
export function directoryPageSql(
  deploymentId: string,
  query: AllocationDirectoryQuery,
  cursor: Cursor | null
) {
  const sortColumn =
    query.sort === "weight"
      ? pools.weight
      : query.sort === "incentives"
        ? pools.incentiveStreamCount
        : pools.createdAtBlock;
  const order = query.direction === "asc" ? sql`asc` : sql`desc`;
  const comparison = query.direction === "asc" ? sql`>` : sql`<`;
  const after = cursor
    ? sql`(sort_value ${comparison} ${cursor.value}::numeric OR (sort_value = ${cursor.value}::numeric AND pool_id ${comparison} ${cursor.poolId}))`
    : sql`true`;
  // A single SQL statement gives the page, total, reserve and revision one MVCC snapshot.
  return sql`WITH filtered AS (
    SELECT ${pools.poolId} AS pool_id, ${sortColumn} AS sort_value, ${pools.detailsJson} AS details_json
    FROM ${pools} WHERE ${pools.deploymentId} = ${deploymentId}
    AND (${!query.eligible} OR ${pools.eligible})
    AND (${query.search === ""} OR position(${query.search} in ${pools.searchText}) > 0)
    AND (${query.hasIncentives === null} OR (${pools.incentiveStreamCount} > 0) = ${query.hasIncentives ?? false})
  ), page AS (SELECT * FROM filtered WHERE ${after} ORDER BY sort_value ${order}, pool_id ${order} LIMIT ${query.limit + 1})
  SELECT json_build_object(
    'revision', coalesce((SELECT ${state.revision}::text FROM ${state} WHERE ${state.deploymentId} = ${deploymentId}), '0'),
    'indexedAtBlock', (SELECT ${state.indexedAtBlock}::text FROM ${state} WHERE ${state.deploymentId} = ${deploymentId}),
    'indexedAtTimestamp', (SELECT ${state.indexedAtTimestamp}::text FROM ${state} WHERE ${state.deploymentId} = ${deploymentId}),
    'total', (SELECT count(*) FROM filtered),
    'entries', coalesce((SELECT json_agg(json_build_object('poolId', pool_id, 'value', sort_value::text, 'item', details_json::json) ORDER BY sort_value ${order}, pool_id ${order}) FROM page), '[]'::json),
    'reserve', (SELECT json_build_object(
      'activated', ${reserve.activated}, 'periodBudget', ${reserve.periodBudget}::text,
      'periodStart', ${reserve.periodStart}::text, 'periodFinish', ${reserve.periodFinish}::text,
      'totalAllocatedWeight', ${reserve.totalAllocatedWeight}::text,
      'observedAtBlock', ${reserve.updatedAtBlock}::text, 'observedAtTimestamp', ${reserve.updatedAtTimestamp}::text,
      'periodExpired', ${reserve.periodFinish} > 0 AND ${reserve.periodFinish} <= coalesce((SELECT ${state.indexedAtTimestamp} FROM ${state} WHERE ${state.deploymentId} = ${deploymentId}), ${reserve.updatedAtTimestamp})
    ) FROM ${reserve} WHERE ${reserve.deploymentId} = ${deploymentId})
  ) AS payload`;
}
type Snapshot = {
  revision: string;
  indexedAtBlock: string | null;
  indexedAtTimestamp: string | null;
  total: number;
  reserve: unknown;
  entries: { poolId: string; value: string; item: unknown }[];
};
export function allocationPoolRoutes(deploymentId: string) {
  const app = new Hono();
  app.get("/phase-one/allocation-pools", async (context) => {
    const params = new URL(context.req.url).searchParams,
      query = allocationDirectoryQuery(params);
    if (!query) return context.json({ error: "Invalid allocation directory query." }, 400);
    const scope = directoryCursorScope(deploymentId, query),
      rawCursor = params.get("cursor");
    const cursor = rawCursor === null ? null : decodeDirectoryCursor(rawCursor, scope);
    if (rawCursor !== null && !cursor)
      return context.json({ error: "Invalid or mismatched allocation directory cursor." }, 400);
    const result = await db.execute(directoryPageSql(deploymentId, query, cursor));
    const snapshot = (result.rows[0] as { payload: Snapshot }).payload;
    if (cursor && cursor.revision !== snapshot.revision) {
      context.header("Cache-Control", "no-store");
      return context.json(
        {
          code: "DIRECTORY_CHANGED",
          error: "The allocation directory changed. Restart from the first page.",
        },
        409
      );
    }
    const entries = snapshot.entries.slice(0, query.limit),
      last = entries.at(-1);
    const nextCursor =
      snapshot.entries.length > query.limit && last
        ? encodeDirectoryCursor({
            version: 1,
            scope,
            revision: snapshot.revision,
            value: last.value,
            poolId: last.poolId,
          })
        : null;
    context.header("Cache-Control", "public, max-age=5, stale-while-revalidate=15");
    return context.json({
      deploymentId,
      indexedAtBlock: snapshot.indexedAtBlock,
      indexedAtTimestamp: snapshot.indexedAtTimestamp,
      directoryRevision: snapshot.revision,
      reserve: snapshot.reserve,
      items: entries.map((e) => e.item),
      nextCursor,
      total: snapshot.total,
    });
  });
  return app;
}

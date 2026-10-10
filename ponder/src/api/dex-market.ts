import { createHash } from "node:crypto";
import { db } from "ponder:api";
import { Hono } from "hono";
import { buildMarket, pricingConfig, type BuiltMarket } from "../dex-market";
import { marketSnapshotSql, marketAnchorSql, type DexSnapshot } from "../dex-snapshot";
import { wire } from "../dex-domain";
import { poolDepth } from "../dex-depth";
const TTL = 300_000,
  MAX_BYTES = 50 * 1024 * 1024;
type Stored = {
  id: string;
  expires: number;
  size: number;
  data: BuiltMarket;
  snapshot: DexSnapshot;
  config: string;
};
export function marketQuery(params: URLSearchParams) {
  const quote = params.get("quote") ?? "usdg",
    sort = params.get("sort") ?? "volume",
    direction = params.get("direction") ?? "desc",
    search = (params.get("search") ?? "").trim().toLowerCase();
  const integer = (key: string, defaultValue: number, max: number) => {
    const x = params.get(key) ?? String(defaultValue);
    return /^\d+$/.test(x) && Number(x) >= 1 && Number(x) <= max ? Number(x) : null;
  };
  const limit = integer("limit", 25, 100),
    days = integer("days", 30, 90);
  if (
    !["usdg", "weth"].includes(quote) ||
    !["volume", "valueLocked", "fees", "yield", "created"].includes(sort) ||
    !["asc", "desc"].includes(direction) ||
    search.length > 256 ||
    limit === null ||
    days === null
  )
    return null;
  return { quote: quote as "usdg" | "weth", sort, direction, search, limit, days };
}
type Query = NonNullable<ReturnType<typeof marketQuery>>;
const scope = (deployment: string, q: Query) =>
  JSON.stringify([deployment, q.quote, q.sort, q.direction, q.search, q.limit]);
export function marketPoolPage(data: BuiltMarket, q: Query, offset: number) {
  const field =
    q.sort === "volume"
      ? "volume24h"
      : q.sort === "fees"
        ? "lpFees24h"
        : q.sort === "yield"
          ? "estimatedYieldBps"
          : q.sort === "created"
            ? "createdAtBlock"
            : "valueLocked";
  const rows = data.pools
    .filter((p) =>
      [
        p.poolId,
        p.token0.address,
        p.token1.address,
        p.token0.symbol,
        p.token1.symbol,
        p.token0.name,
        p.token1.name,
      ].some((x) => x?.toLowerCase().includes(q.search))
    )
    .sort((a, b) => {
      const va = a[field],
        vb = b[field];
      if (va === null && vb !== null) return 1;
      if (vb === null && va !== null) return -1;
      if (va !== null && vb !== null && BigInt(va) !== BigInt(vb))
        return (BigInt(va) < BigInt(vb) ? -1 : 1) * (q.direction === "asc" ? 1 : -1);
      return a.poolId.localeCompare(b.poolId);
    });
  return {
    items: rows.slice(offset, offset + q.limit),
    total: rows.length,
    next: offset + q.limit < rows.length ? offset + q.limit : null,
  };
}
export function dexMarketRoutes(deployment: string, clock: () => number = Date.now) {
  const app = new Hono(),
    cache = new Map<string, Stored>();
  const send = (_context: unknown, body: unknown) =>
    new Response(wire(body), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=5" },
    });
  const trim = () => {
    for (const [id, s] of cache) if (s.expires <= clock()) cache.delete(id);
  };
  async function current(quote: "usdg" | "weth") {
    trim();
    const config = pricingConfig(quote),
      configKey = wire(config);
    const recently = [...cache.values()].find(
      (s) => s.config === configKey && s.expires - clock() > TTL - 15_000
    );
    if (recently && (await valid(recently))) return recently;
    const result = await db.execute(marketSnapshotSql(deployment));
    const snapshot = (result.rows[0] as { payload: DexSnapshot }).payload;
    const data = buildMarket(
      snapshot,
      deployment,
      config,
      process.env.PONDER_STATICS_TOKEN_ADDRESS ?? null
    );
    const id = createHash("sha256")
      .update(
        wire([
          deployment,
          config,
          snapshot.generation,
          snapshot.revision,
          snapshot.checkpoint,
          clock(),
        ])
      )
      .digest("hex");
    const size = Buffer.byteLength(wire(data)) + Buffer.byteLength(wire(snapshot));
    if (size > MAX_BYTES) throw new Error("Market snapshot exceeds the configured memory bound");
    // Keep active traversals immutable; bounded eviction produces an explicit restart.
    while (
      cache.size >= 16 ||
      [...cache.values()].reduce((n, s) => n + s.size, 0) + size > MAX_BYTES
    ) {
      const first = cache.keys().next().value;
      if (!first) break;
      cache.delete(first);
    }
    const stored = { id, expires: clock() + TTL, size, data, snapshot, config: configKey };
    cache.set(id, stored);
    return stored;
  }
  async function valid(s: Stored) {
    const result = await db.execute(marketAnchorSql(deployment, s.snapshot.anchor));
    const row = result.rows[0] as { hash: string | null; generation: string; revision: string };
    return (
      row.generation === s.snapshot.generation &&
      BigInt(row.revision) >= BigInt(s.snapshot.revision) &&
      row.hash === (s.snapshot.anchor?.blockHash ?? null)
    );
  }
  app.get("/phase-one/market/:section", async (c) => {
    const section = c.req.param("section");
    if (!["summary", "pools", "tokens", "volume", "emissions", "trades", "depth"].includes(section))
      return c.notFound();
    const params = new URL(c.req.url).searchParams,
      q = marketQuery(params);
    if (!q) return c.json({ error: "Invalid market query." }, 400);
    const pool = params.get("pool");
    if (section === "depth" && !/^0x[0-9a-fA-F]{64}$/.test(pool ?? ""))
      return c.json({ error: "Depth requires a pool ID." }, 400);
    if (section === "trades" && params.has("limit") && q.limit > 50)
      return c.json({ error: "Trade limit must be 1–50." }, 400);
    const raw = params.get("cursor");
    let offset = 0,
      stored: Stored | undefined;
    if (raw !== null) {
      try {
        if (section !== "pools" || raw.length > 4096 || !raw || !/^[\w-]+$/.test(raw))
          throw Error();
        const p = JSON.parse(Buffer.from(raw, "base64url").toString());
        if (
          p.version !== 1 ||
          p.scope !== scope(deployment, q) ||
          typeof p.id !== "string" ||
          !/^[a-f0-9]{64}$/.test(p.id) ||
          !Number.isSafeInteger(p.offset) ||
          p.offset < 1
        )
          throw Error();
        offset = p.offset;
        stored = cache.get(p.id);
      } catch {
        return c.json({ error: "Malformed or mismatched market cursor." }, 400);
      }
      if (
        !stored ||
        stored.expires <= clock() ||
        stored.config !== wire(pricingConfig(q.quote)) ||
        !(await valid(stored))
      ) {
        c.header("Cache-Control", "no-store");
        return c.json(
          {
            code: "MARKET_SNAPSHOT_CHANGED",
            error: "Market snapshot expired or was replayed. Restart from the first page.",
          },
          409
        );
      }
    }
    try {
      stored ??= await current(q.quote);
      const data = stored.data;
      if (section === "pools") {
        const page = marketPoolPage(data, q, offset);
        if (offset > page.total) return c.json({ error: "Invalid market page offset." }, 400);
        return send(c, {
          ...data.observed,
          items: page.items,
          total: page.total,
          nextCursor:
            page.next === null
              ? null
              : Buffer.from(
                  JSON.stringify({
                    version: 1,
                    scope: scope(deployment, q),
                    id: stored.id,
                    offset: page.next,
                  })
                ).toString("base64url"),
          snapshot: { id: stored.id, expiresAt: stored.expires },
        });
      }
      if (section === "depth") {
        const depth = poolDepth(stored.snapshot, pool!);
        if (!depth) return c.json({ error: "Unknown or uninitialized pool." }, 404);
        const { deploymentId, indexedAtBlock, indexedAtTimestamp } = data.observed;
        return send(c, { deploymentId, indexedAtBlock, indexedAtTimestamp, ...depth });
      }
      if (section === "volume")
        return send(c, { ...data.volume, days: data.volume.days.slice(-q.days) });
      if (section === "trades")
        return send(c, {
          ...data.trades,
          items: data.trades.items.slice(0, params.has("limit") ? q.limit : 8),
        });
      return send(c, data[section as "summary" | "tokens" | "emissions"]);
    } catch (error) {
      console.error(
        "DEX market unavailable:",
        error instanceof Error ? error.message : "Invalid indexed state"
      );
      c.header("Cache-Control", "no-store");
      return c.json(
        {
          code: "MARKET_UNAVAILABLE",
          error: "Market indexing or quote configuration is incomplete.",
        },
        503
      );
    }
  });
  return app;
}

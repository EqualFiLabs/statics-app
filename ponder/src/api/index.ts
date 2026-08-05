import { and, asc, eq, gt, lt } from "ponder";
import { db } from "ponder:api";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAddress, isAddress } from "viem";

import { activeLoan, v4Position } from "ponder:schema";
import { decodeCursor, encodeCursor, readLimit } from "./pagination";

const app = new Hono();
app.use("*", cors({ origin: process.env.PONDER_ALLOWED_ORIGIN || "*" }));

app.get("/loans/recoverable", async (context) => {
  const asOfValue = context.req.query("asOf");
  const limit = readLimit(context.req.query("limit"));
  const cursor = decodeCursor(context.req.query("cursor"));
  if (!asOfValue || !/^\d+$/.test(asOfValue) || limit === 0) {
    return context.json({ error: "Invalid asOf or limit." }, 400);
  }
  if (context.req.query("cursor") && cursor === null) {
    return context.json({ error: "Invalid cursor." }, 400);
  }
  const asOf = BigInt(asOfValue);
  const rows = await db
    .select({ id: activeLoan.id })
    .from(activeLoan)
    .where(
      and(
        lt(activeLoan.recoverableAt, asOf),
        cursor === null ? undefined : gt(activeLoan.id, cursor)
      )
    )
    .orderBy(asc(activeLoan.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return context.json({
    items: page.map((row) => ({ id: row.id.toString() })),
    nextCursor: rows.length > limit && page.length ? encodeCursor(page.at(-1)!.id) : null,
  });
});

app.get("/wallets/:owner/v4-positions", async (context) => {
  const rawOwner = context.req.param("owner");
  const limit = readLimit(context.req.query("limit"));
  const cursor = decodeCursor(context.req.query("cursor"));
  if (!isAddress(rawOwner) || limit === 0)
    return context.json({ error: "Invalid owner or limit." }, 400);
  if (context.req.query("cursor") && cursor === null)
    return context.json({ error: "Invalid cursor." }, 400);
  const owner = getAddress(rawOwner);
  const rows = await db
    .select({ id: v4Position.id })
    .from(v4Position)
    .where(
      and(eq(v4Position.owner, owner), cursor === null ? undefined : gt(v4Position.id, cursor))
    )
    .orderBy(asc(v4Position.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return context.json({
    items: page.map((row) => ({ id: row.id.toString() })),
    nextCursor: rows.length > limit && page.length ? encodeCursor(page.at(-1)!.id) : null,
  });
});

export default app;

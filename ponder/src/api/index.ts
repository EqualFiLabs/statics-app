import { and, asc, count, desc, eq, gt, gte, lt, lte, max, min, sum } from "ponder";
import { db } from "ponder:api";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAddress, isAddress } from "viem";

import {
  activeGenesisCredit,
  activeLoan,
  genesisNft,
  genesisRewardClaim,
  harvestedFee,
  marketCandle,
  marketSwap,
  v4Position,
} from "ponder:schema";
import { decodeCursor, encodeCursor, readLimit } from "./pagination";
import { recoverableGenesisCreditPage } from "./genesis-credits";
import { nextAvailableGenesisId } from "../genesis";
import { aggregateMarketCandles, readMarketResolution } from "../market";

const app = new Hono();
app.use("*", cors({ origin: process.env.PONDER_ALLOWED_ORIGIN || "*" }));
const deploymentId = process.env.PONDER_DEPLOYMENT_ID?.trim() || "unconfigured";

const MAX_MARKET_RANGE_SECONDS = 31n * 24n * 60n * 60n;

function readUnsignedTimestamp(value: string | undefined): bigint | null | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) return null;
  return BigInt(value);
}

function readMarketTradeLimit(value: string | undefined): number {
  if (value === undefined) return 200;
  if (!/^\d+$/.test(value)) return 0;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= 500 ? limit : 0;
}

function marketRange(fromValue: string | undefined, toValue: string | undefined) {
  const from = readUnsignedTimestamp(fromValue);
  const to = readUnsignedTimestamp(toValue);
  if (from === null || to === null || (from !== undefined && to !== undefined && to < from)) {
    return null;
  }
  return { from, to } as const;
}

function marketRangeWhere(from: bigint | undefined, to: bigint | undefined) {
  return and(
    eq(marketSwap.deploymentId, deploymentId),
    from === undefined ? undefined : gte(marketSwap.blockTimestamp, from),
    to === undefined ? undefined : lte(marketSwap.blockTimestamp, to)
  );
}

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
  const rows = await db
    .select({ id: activeLoan.id })
    .from(activeLoan)
    .where(
      and(
        eq(activeLoan.deploymentId, deploymentId),
        lt(activeLoan.recoverableAt, BigInt(asOfValue)),
        cursor === null ? undefined : gt(activeLoan.id, cursor)
      )
    )
    .orderBy(asc(activeLoan.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return context.json({
    deploymentId,
    items: page.map((row) => ({ id: row.id.toString() })),
    nextCursor: rows.length > limit && page.length ? encodeCursor(page.at(-1)!.id) : null,
  });
});

app.get("/genesis/credits/recoverable", async (context) => {
  const asOfValue = context.req.query("asOf");
  const limit = readLimit(context.req.query("limit"));
  const cursor = decodeCursor(context.req.query("cursor"));
  if (!asOfValue || !/^\d+$/.test(asOfValue) || limit === 0) {
    return context.json({ error: "Invalid asOf or limit." }, 400);
  }
  if (context.req.query("cursor") !== undefined && cursor === null) {
    return context.json({ error: "Invalid cursor." }, 400);
  }
  const rows = await db
    .select({
      genesisId: activeGenesisCredit.genesisId,
      deploymentId: activeGenesisCredit.deploymentId,
      owner: activeGenesisCredit.owner,
      principal: activeGenesisCredit.principal,
      maturity: activeGenesisCredit.maturity,
      recoverableAt: activeGenesisCredit.recoverableAt,
    })
    .from(activeGenesisCredit)
    .where(
      and(
        eq(activeGenesisCredit.deploymentId, deploymentId),
        lt(activeGenesisCredit.recoverableAt, BigInt(asOfValue)),
        cursor === null ? undefined : gt(activeGenesisCredit.genesisId, cursor)
      )
    )
    .orderBy(asc(activeGenesisCredit.genesisId))
    .limit(limit + 1);
  const result = recoverableGenesisCreditPage(rows, deploymentId, BigInt(asOfValue), limit);
  return context.json({
    deploymentId,
    items: result.items.map((row) => ({
      genesisId: row.genesisId.toString(),
      owner: row.owner,
      principal: row.principal.toString(),
      maturity: row.maturity.toString(),
      recoverableAt: row.recoverableAt.toString(),
    })),
    nextCursor:
      result.hasNextPage && result.items.length
        ? encodeCursor(result.items.at(-1)!.genesisId)
        : null,
  });
});

app.get("/wallets/:owner/v4-positions", async (context) => {
  const rawOwner = context.req.param("owner");
  const limit = readLimit(context.req.query("limit"));
  const cursor = decodeCursor(context.req.query("cursor"));
  if (!isAddress(rawOwner) || limit === 0) {
    return context.json({ error: "Invalid owner or limit." }, 400);
  }
  if (context.req.query("cursor") && cursor === null) {
    return context.json({ error: "Invalid cursor." }, 400);
  }
  const rows = await db
    .select({ id: v4Position.id })
    .from(v4Position)
    .where(
      and(
        eq(v4Position.deploymentId, deploymentId),
        eq(v4Position.owner, getAddress(rawOwner)),
        cursor === null ? undefined : gt(v4Position.id, cursor)
      )
    )
    .orderBy(asc(v4Position.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return context.json({
    deploymentId,
    items: page.map((row) => ({ id: row.id.toString() })),
    nextCursor: rows.length > limit && page.length ? encodeCursor(page.at(-1)!.id) : null,
  });
});

app.get("/wallets/:owner/genesis", async (context) => {
  const rawOwner = context.req.param("owner");
  const limit = readLimit(context.req.query("limit"));
  const cursor = decodeCursor(context.req.query("cursor"));
  if (!isAddress(rawOwner) || limit === 0) {
    return context.json({ error: "Invalid owner or limit." }, 400);
  }
  if (context.req.query("cursor") && cursor === null) {
    return context.json({ error: "Invalid cursor." }, 400);
  }
  const rows = await db
    .select({
      id: genesisNft.id,
      tier: genesisNft.tier,
      multiplierBps: genesisNft.multiplierBps,
      linkedPositionId: genesisNft.linkedPositionId,
      registered: genesisNft.registered,
      effectiveWeight: genesisNft.effectiveWeight,
      updatedAtBlock: genesisNft.updatedAtBlock,
    })
    .from(genesisNft)
    .where(
      and(
        eq(genesisNft.deploymentId, deploymentId),
        eq(genesisNft.owner, getAddress(rawOwner)),
        cursor === null ? undefined : gt(genesisNft.id, cursor)
      )
    )
    .orderBy(asc(genesisNft.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  // Wallet ownership is public chain state. A very short private cache keeps
  // route changes from refetching the same snapshot while the checkpoint and
  // frontend reconciliation preserve freshness after writes.
  context.header("Cache-Control", "private, max-age=2, stale-while-revalidate=5");
  return context.json({
    deploymentId,
    items: page.map((row) => ({
      id: row.id.toString(),
      tier: row.tier,
      multiplierBps: row.multiplierBps,
      linkedPositionId: row.linkedPositionId.toString(),
      registered: row.registered,
      effectiveWeight: row.effectiveWeight.toString(),
      updatedAtBlock: row.updatedAtBlock.toString(),
    })),
    nextCursor: rows.length > limit && page.length ? encodeCursor(page.at(-1)!.id) : null,
  });
});

app.get("/genesis/next-available", async (context) => {
  const rows = await db
    .select({ id: genesisNft.id })
    .from(genesisNft)
    .where(eq(genesisNft.deploymentId, deploymentId));
  const next = nextAvailableGenesisId(rows.map((row) => row.id));
  // This endpoint is safe to share briefly because the purchase path verifies
  // the returned ID against Vault inventory before submitting a transaction.
  context.header("Cache-Control", "public, max-age=1, stale-while-revalidate=2");
  return context.json({
    deploymentId,
    tokenId: next?.toString() ?? null,
  });
});

app.get("/wallets/:owner/genesis-rewards", async (context) => {
  const rawOwner = context.req.param("owner");
  if (!isAddress(rawOwner)) return context.json({ error: "Invalid owner." }, 400);
  const rows = await db
    .select({
      genesisId: genesisRewardClaim.genesisId,
      asset: genesisRewardClaim.asset,
      amount: genesisRewardClaim.amount,
      previousOwnerClaim: genesisRewardClaim.previousOwnerClaim,
      blockNumber: genesisRewardClaim.blockNumber,
    })
    .from(genesisRewardClaim)
    .where(
      and(
        eq(genesisRewardClaim.deploymentId, deploymentId),
        eq(genesisRewardClaim.owner, getAddress(rawOwner))
      )
    )
    .orderBy(asc(genesisRewardClaim.blockNumber))
    .limit(100);
  return context.json({
    deploymentId,
    items: rows.map((row) => ({
      genesisId: row.genesisId?.toString() ?? null,
      asset: row.asset,
      amount: row.amount.toString(),
      previousOwnerClaim: row.previousOwnerClaim,
      blockNumber: row.blockNumber.toString(),
    })),
  });
});

app.get("/market/fees", async (context) => {
  const rows = await db
    .select({
      distributor: harvestedFee.distributor,
      asset: harvestedFee.asset,
      amount: harvestedFee.amount,
      cumulativeAmount: harvestedFee.cumulativeAmount,
      blockNumber: harvestedFee.blockNumber,
    })
    .from(harvestedFee)
    .where(eq(harvestedFee.deploymentId, deploymentId))
    .orderBy(asc(harvestedFee.blockNumber))
    .limit(100);
  return context.json({
    deploymentId,
    items: rows.map((row) => ({
      distributor: row.distributor,
      asset: row.asset,
      amount: row.amount.toString(),
      cumulativeAmount: row.cumulativeAmount.toString(),
      blockNumber: row.blockNumber.toString(),
    })),
  });
});

app.get("/market/swaps", async (context) => {
  const limit = readLimit(context.req.query("limit"));
  if (limit === 0) return context.json({ error: "Invalid limit." }, 400);
  const rows = await db
    .select({
      poolId: marketSwap.poolId,
      sender: marketSwap.sender,
      amount0: marketSwap.amount0,
      amount1: marketSwap.amount1,
      sqrtPriceX96: marketSwap.sqrtPriceX96,
      liquidity: marketSwap.liquidity,
      tick: marketSwap.tick,
      fee: marketSwap.fee,
      transactionHash: marketSwap.transactionHash,
      blockNumber: marketSwap.blockNumber,
      blockTimestamp: marketSwap.blockTimestamp,
    })
    .from(marketSwap)
    .where(eq(marketSwap.deploymentId, deploymentId))
    .orderBy(desc(marketSwap.blockNumber))
    .limit(limit);
  return context.json({
    deploymentId,
    items: rows.map((row) => ({
      poolId: row.poolId,
      sender: row.sender,
      amount0: row.amount0.toString(),
      amount1: row.amount1.toString(),
      sqrtPriceX96: row.sqrtPriceX96.toString(),
      liquidity: row.liquidity.toString(),
      tick: row.tick,
      fee: row.fee,
      transactionHash: row.transactionHash,
      blockNumber: row.blockNumber.toString(),
      blockTimestamp: row.blockTimestamp.toString(),
    })),
  });
});

app.get("/market/trades", async (context) => {
  const limit = readMarketTradeLimit(context.req.query("limit"));
  const range = marketRange(context.req.query("from"), context.req.query("to"));
  const amount0Sign = context.req.query("amount0Sign");
  if (
    limit === 0 ||
    range === null ||
    (amount0Sign !== undefined && amount0Sign !== "positive" && amount0Sign !== "negative")
  ) {
    return context.json({ error: "Invalid trade query." }, 400);
  }
  const rows = await db
    .select({
      poolId: marketSwap.poolId,
      amount0: marketSwap.amount0,
      amount1: marketSwap.amount1,
      volume0: marketSwap.volume0,
      volume1: marketSwap.volume1,
      price1Per0Wad: marketSwap.price1Per0Wad,
      transactionHash: marketSwap.transactionHash,
      blockNumber: marketSwap.blockNumber,
      blockTimestamp: marketSwap.blockTimestamp,
      logIndex: marketSwap.logIndex,
    })
    .from(marketSwap)
    .where(
      and(
        marketRangeWhere(range.from, range.to),
        amount0Sign === "positive"
          ? gt(marketSwap.amount0, 0n)
          : amount0Sign === "negative"
            ? lt(marketSwap.amount0, 0n)
            : undefined
      )
    )
    .orderBy(
      desc(marketSwap.blockTimestamp),
      desc(marketSwap.blockNumber),
      desc(marketSwap.logIndex)
    )
    .limit(limit);
  context.header("Cache-Control", "public, max-age=5, stale-while-revalidate=15");
  return context.json({
    deploymentId,
    items: rows.map((row) => ({
      poolId: row.poolId,
      amount0: row.amount0.toString(),
      amount1: row.amount1.toString(),
      volume0: row.volume0.toString(),
      volume1: row.volume1.toString(),
      price1Per0Wad: row.price1Per0Wad.toString(),
      transactionHash: row.transactionHash,
      blockNumber: row.blockNumber.toString(),
      blockTimestamp: row.blockTimestamp.toString(),
      logIndex: row.logIndex,
    })),
  });
});

app.get("/market/activity", async (context) => {
  const range = marketRange(context.req.query("from"), context.req.query("to"));
  if (
    range === null ||
    range.from === undefined ||
    range.to === undefined ||
    range.to - range.from > MAX_MARKET_RANGE_SECONDS
  ) {
    return context.json({ error: "Invalid market activity range." }, 400);
  }
  const where = marketRangeWhere(range.from, range.to);
  const [aggregateRows, firstRows, lastRows, zeroForOneRows, oneForZeroRows] = await Promise.all([
    db
      .select({
        volume0: sum(marketSwap.volume0),
        volume1: sum(marketSwap.volume1),
        lowPrice1Per0Wad: min(marketSwap.price1Per0Wad),
        highPrice1Per0Wad: max(marketSwap.price1Per0Wad),
        swapCount: count(),
      })
      .from(marketSwap)
      .where(where),
    db
      .select({ price1Per0Wad: marketSwap.price1Per0Wad })
      .from(marketSwap)
      .where(where)
      .orderBy(
        asc(marketSwap.blockTimestamp),
        asc(marketSwap.blockNumber),
        asc(marketSwap.logIndex)
      )
      .limit(1),
    db
      .select({
        price1Per0Wad: marketSwap.price1Per0Wad,
        blockNumber: marketSwap.blockNumber,
        blockTimestamp: marketSwap.blockTimestamp,
        logIndex: marketSwap.logIndex,
      })
      .from(marketSwap)
      .where(where)
      .orderBy(
        desc(marketSwap.blockTimestamp),
        desc(marketSwap.blockNumber),
        desc(marketSwap.logIndex)
      )
      .limit(1),
    db
      .select({ swapCount: count() })
      .from(marketSwap)
      .where(and(where, gt(marketSwap.amount0, 0n))),
    db
      .select({ swapCount: count() })
      .from(marketSwap)
      .where(and(where, lt(marketSwap.amount0, 0n))),
  ]);
  const aggregate = aggregateRows[0];
  const first = firstRows[0];
  const last = lastRows[0];
  context.header("Cache-Control", "public, max-age=5, stale-while-revalidate=15");
  return context.json({
    deploymentId,
    from: range.from.toString(),
    to: range.to.toString(),
    volume0: String(aggregate?.volume0 ?? 0),
    volume1: String(aggregate?.volume1 ?? 0),
    swapCount: Number(aggregate?.swapCount ?? 0),
    zeroForOneCount: Number(zeroForOneRows[0]?.swapCount ?? 0),
    oneForZeroCount: Number(oneForZeroRows[0]?.swapCount ?? 0),
    openPrice1Per0Wad: first?.price1Per0Wad.toString() ?? null,
    highPrice1Per0Wad: aggregate?.highPrice1Per0Wad?.toString() ?? null,
    lowPrice1Per0Wad: aggregate?.lowPrice1Per0Wad?.toString() ?? null,
    closePrice1Per0Wad: last?.price1Per0Wad.toString() ?? null,
    lastBlock: last?.blockNumber.toString() ?? null,
    lastTimestamp: last?.blockTimestamp.toString() ?? null,
    lastLogIndex: last?.logIndex ?? null,
  });
});

const MAX_CANDLE_RANGE_SECONDS = 31n * 24n * 60n * 60n;

app.get("/market/candles", async (context) => {
  const fromValue = context.req.query("from");
  const toValue = context.req.query("to");
  const resolution = readMarketResolution(context.req.query("resolution"));
  if (
    !fromValue ||
    !toValue ||
    !/^\d+$/.test(fromValue) ||
    !/^\d+$/.test(toValue) ||
    resolution === null
  ) {
    return context.json({ error: "Invalid candle range or resolution." }, 400);
  }
  const from = BigInt(fromValue);
  const to = BigInt(toValue);
  if (to < from || to - from > MAX_CANDLE_RANGE_SECONDS) {
    return context.json({ error: "Candle range must be ordered and no longer than 31 days." }, 400);
  }
  const rows = await db
    .select({
      bucketTimestamp: marketCandle.bucketTimestamp,
      openSqrtPriceX96: marketCandle.openSqrtPriceX96,
      highSqrtPriceX96: marketCandle.highSqrtPriceX96,
      lowSqrtPriceX96: marketCandle.lowSqrtPriceX96,
      closeSqrtPriceX96: marketCandle.closeSqrtPriceX96,
      volume0: marketCandle.volume0,
      volume1: marketCandle.volume1,
      zeroForOneCount: marketCandle.zeroForOneCount,
      oneForZeroCount: marketCandle.oneForZeroCount,
      swapCount: marketCandle.swapCount,
      firstBlock: marketCandle.firstBlock,
      lastBlock: marketCandle.lastBlock,
    })
    .from(marketCandle)
    .where(
      and(
        eq(marketCandle.deploymentId, deploymentId),
        gte(marketCandle.bucketTimestamp, from),
        lte(marketCandle.bucketTimestamp, to)
      )
    )
    .orderBy(asc(marketCandle.bucketTimestamp))
    .limit(44_641);
  const items = aggregateMarketCandles(rows, resolution);
  context.header("Cache-Control", "public, max-age=5, stale-while-revalidate=30");
  return context.json({
    deploymentId,
    resolution,
    items: items.map((row) => ({
      timestamp: row.bucketTimestamp.toString(),
      openSqrtPriceX96: row.openSqrtPriceX96.toString(),
      highSqrtPriceX96: row.highSqrtPriceX96.toString(),
      lowSqrtPriceX96: row.lowSqrtPriceX96.toString(),
      closeSqrtPriceX96: row.closeSqrtPriceX96.toString(),
      volume0: row.volume0.toString(),
      volume1: row.volume1.toString(),
      zeroForOneCount: row.zeroForOneCount,
      oneForZeroCount: row.oneForZeroCount,
      swapCount: row.swapCount,
      firstBlock: row.firstBlock.toString(),
      lastBlock: row.lastBlock.toString(),
    })),
  });
});

export default app;

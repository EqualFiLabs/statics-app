import { and, asc, desc, eq, gt, lt } from "ponder";
import { db } from "ponder:api";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAddress, isAddress } from "viem";

import {
  activeLoan,
  genesisNft,
  genesisRewardClaim,
  harvestedFee,
  marketSwap,
  v4Position,
} from "ponder:schema";
import { decodeCursor, encodeCursor, readLimit } from "./pagination";

const app = new Hono();
app.use("*", cors({ origin: process.env.PONDER_ALLOWED_ORIGIN || "*" }));
const deploymentId = process.env.PONDER_DEPLOYMENT_ID?.trim() || "unconfigured";

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

app.get("/genesis/inventory", async (context) => {
  const vault = process.env.PONDER_GENESIS_VAULT_ADDRESS;
  const limit = readLimit(context.req.query("limit"));
  const cursor = decodeCursor(context.req.query("cursor"));
  if (!vault || !isAddress(vault) || limit === 0) {
    return context.json({ error: "Genesis Vault inventory is not configured." }, 503);
  }
  if (context.req.query("cursor") && cursor === null) {
    return context.json({ error: "Invalid cursor." }, 400);
  }
  const rows = await db
    .select({ id: genesisNft.id, updatedAtBlock: genesisNft.updatedAtBlock })
    .from(genesisNft)
    .where(
      and(
        eq(genesisNft.deploymentId, deploymentId),
        eq(genesisNft.owner, getAddress(vault)),
        cursor === null ? undefined : gt(genesisNft.id, cursor)
      )
    )
    .orderBy(asc(genesisNft.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return context.json({
    deploymentId,
    items: page.map((row) => ({
      id: row.id.toString(),
      updatedAtBlock: row.updatedAtBlock.toString(),
    })),
    nextCursor: rows.length > limit && page.length ? encodeCursor(page.at(-1)!.id) : null,
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

export default app;

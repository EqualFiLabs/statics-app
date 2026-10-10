import type { ponder } from "ponder:registry";
import { dexPool, dexRange, dexHistory, dexState } from "ponder:schema";
import { getAddress, zeroAddress, type Hex } from "viem";
import { readTokenMetadata } from "./allocation-snapshots";
import { configuredCanonicalPool, configuredAddress } from "./source-config";
import {
  changeRange,
  advanceStreams,
  fundLp,
  settleTrade,
  updatePrice,
  wire,
  type MarketPool,
  type MarketRange,
  type MarketTrade,
} from "./dex-domain";

type Context = Parameters<Parameters<typeof ponder.on>[1]>[0]["context"];
export type DexEvent = {
  args: Record<string, unknown>;
  transaction: { hash: Hex; from: Hex };
  log: { logIndex: number };
  block: { number: bigint; hash: Hex; timestamp: bigint };
};
type PoolState = MarketPool & { pending: string[] };
export function dexIndexer(deploymentId: string, genesisDeploymentId: string) {
  const key = (poolId: string) => `${deploymentId}:${poolId.toLowerCase()}`;
  const eventKey = (e: DexEvent, suffix = "") =>
    `${deploymentId}:${e.transaction.hash}:${e.log.logIndex}${suffix}`;
  async function touch(context: Context, event: DexEvent) {
    await context.db
      .insert(dexState)
      .values({
        key: deploymentId,
        deploymentId,
        revision: 1n,
        blockHash: event.block.hash,
        blockNumber: event.block.number,
        timestamp: event.block.timestamp,
      })
      .onConflictDoUpdate((row) => ({
        revision: row.revision + 1n,
        blockHash: event.block.hash,
        blockNumber: event.block.number,
        timestamp: event.block.timestamp,
      }));
  }
  async function history(
    context: Context,
    event: DexEvent,
    poolId: Hex,
    kind: string,
    details: unknown,
    suffix = ""
  ) {
    await context.db.insert(dexHistory).values({
      key: eventKey(event, suffix),
      deploymentId,
      poolId,
      kind,
      details: wire(details),
      blockNumber: event.block.number,
      blockHash: event.block.hash,
      timestamp: event.block.timestamp,
      logIndex: event.log.logIndex,
    });
  }
  async function read(context: Context, poolId: string): Promise<PoolState | null> {
    const row = await context.db.find(dexPool, { key: key(poolId) });
    return row ? (JSON.parse(row.details) as PoolState) : null;
  }
  async function save(context: Context, event: DexEvent, pool: PoolState) {
    await context.db
      .insert(dexPool)
      .values({
        key: key(pool.poolId),
        deploymentId,
        poolId: pool.poolId as Hex,
        details: wire(pool),
        updatedAtBlock: event.block.number,
      })
      .onConflictDoUpdate({ details: wire(pool), updatedAtBlock: event.block.number });
    await touch(context, event);
  }
  async function advance(context: Context, event: DexEvent, pool: PoolState) {
    const segments = advanceStreams(pool, event.block.timestamp);
    if (segments.length)
      await history(context, event, pool.poolId as Hex, "accrual", segments, ":accrual");
  }
  async function initialize(context: Context, event: DexEvent, source: "genesis" | "phase-one") {
    const a = event.args,
      poolId = String(a.poolId ?? a.id) as Hex;
    const prior = await read(context, poolId);
    if (prior) return;
    const metadata = async (asset: unknown) => {
      const row = await readTokenMetadata(context, event, getAddress(String(asset)));
      return { address: row.address, symbol: row.symbol, name: row.name, decimals: row.decimals };
    };
    const startBlock =
      source === "genesis" ? process.env.PONDER_POOL_MANAGER_START_BLOCK : undefined;
    const startTime = startBlock
      ? (await context.client.getBlock({ blockNumber: BigInt(startBlock) })).timestamp
      : event.block.timestamp;
    const pool: PoolState = {
      poolId,
      source,
      sourceDeploymentId: source === "genesis" ? genesisDeploymentId : deploymentId,
      token0: await metadata(a.currency0),
      token1: await metadata(a.currency1),
      creator: a.creator ? String(a.creator) : null,
      hook: String(a.hooks ?? process.env.PONDER_PUBLIC_HOOK_ADDRESS ?? zeroAddress),
      lpFee: Number(a.lpFee ?? a.fee),
      tickSpacing: Number(a.tickSpacing),
      createdAtBlock: String(event.block.number),
      createdAtTimestamp: String(event.block.timestamp),
      initialized: true,
      liquidityComplete: true,
      historyStart: String(startTime),
      sqrtPriceX96: String(a.sqrtPriceX96),
      tick: Number(a.tick),
      cumulative: "0",
      priceTime: String(event.block.timestamp),
      decommissioned: false,
      stopped: false,
      quarantined: false,
      legs: [],
      streams: [],
      pending: [],
    };
    await history(context, event, poolId, "pool", pool);
    await save(context, event, pool);
  }
  async function modify(context: Context, event: DexEvent) {
    const a = event.args,
      poolId = String(a.id) as Hex,
      pool = await read(context, poolId);
    if (!pool) return;
    const identity: MarketRange = {
      poolId,
      sender: String(a.sender).toLowerCase(),
      tickLower: Number(a.tickLower),
      tickUpper: Number(a.tickUpper),
      salt: String(a.salt),
      liquidity: "0",
    };
    const rangeKey = `${key(poolId)}:${identity.sender}:${identity.tickLower}:${identity.tickUpper}:${identity.salt}`;
    const prior = await context.db.find(dexRange, { key: rangeKey });
    const next = changeRange(
      prior ? (JSON.parse(prior.details) as MarketRange) : null,
      identity,
      BigInt(String(a.liquidityDelta))
    );
    // Retain zero rows as historical identities; API inventory omits their zero balance.
    await context.db
      .insert(dexRange)
      .values({
        key: rangeKey,
        deploymentId,
        poolId,
        details: wire(next),
        updatedAtBlock: event.block.number,
      })
      .onConflictDoUpdate({ details: wire(next), updatedAtBlock: event.block.number });
    await history(context, event, poolId, "range", {
      ...next,
      rangeKey,
      delta: String(a.liquidityDelta),
    });
    await save(context, event, pool);
  }
  async function swap(context: Context, event: DexEvent, priceOnly = false) {
    const a = event.args,
      poolId = String(a.id) as Hex,
      pool = await read(context, poolId);
    if (!pool) return;
    await advance(context, event, pool);
    const amount0 = BigInt(String(a.amount0)),
      amount1 = BigInt(String(a.amount1));
    if (!((amount0 < 0n && amount1 > 0n) || (amount1 < 0n && amount0 > 0n))) return;
    updatePrice(pool, Number(a.tick), BigInt(String(a.sqrtPriceX96)), event.block.timestamp);
    const trade: MarketTrade = {
      poolId,
      sender: String(a.sender),
      transactionSender: event.transaction.from,
      transactionHash: event.transaction.hash,
      coreAmount0: String(amount0),
      coreAmount1: String(amount1),
      fee0: "0",
      fee1: "0",
      amountIn: String(amount0 < 0n ? -amount0 : -amount1),
      amountOut: String(amount0 > 0n ? amount0 : amount1),
      input0: amount0 < 0n,
      internal: false,
      complete: pool.source === "genesis",
      settlement: "core-pool",
      sqrtPriceX96: String(a.sqrtPriceX96),
      tick: Number(a.tick),
      lpFee: pool.lpFee,
    };
    await history(context, event, poolId, priceOnly ? "price" : "swap", {
      ...trade,
      cumulative: pool.cumulative,
      priceTime: pool.priceTime,
    });
    pool.pending = pool.pending.filter((k) =>
      k.startsWith(`${deploymentId}:${event.transaction.hash}:`)
    );
    if (pool.source === "phase-one") pool.pending.push(eventKey(event));
    await save(context, event, pool);
  }
  async function tape(context: Context, event: DexEvent) {
    const poolId = String(event.args.poolId) as Hex,
      pool = await read(context, poolId);
    if (!pool || pool.source !== "phase-one") return;
    const pending = pool.pending.pop();
    if (!pending) throw new Error("MarketTape swap has no matching PoolManager swap");
    const row = await context.db.find(dexHistory, { key: pending });
    if (!row) throw new Error("Missing pending DEX swap");
    const trade = JSON.parse(row.details) as MarketTrade & {
      cumulative: string;
      priceTime: string;
    };
    const packed = BigInt(String(event.args.poolDelta)),
      signed = (n: bigint) => (n >= 1n << 127n ? n - (1n << 128n) : n);
    const delta0 = signed((packed >> 128n) & ((1n << 128n) - 1n)),
      delta1 = signed(packed & ((1n << 128n) - 1n));
    if (BigInt(trade.coreAmount0) !== delta0 || BigInt(trade.coreAmount1) !== delta1)
      throw new Error("Mismatched DEX market source");
    const fees = BigInt(String(event.args.staticsFeesPacked));
    const next = settleTrade(
      trade,
      fees & ((1n << 128n) - 1n),
      fees >> 128n,
      (Number(event.args.flags) & 4) !== 0
    );
    next.lpFee = Number(event.args.nativeLpFee);
    await context.db.update(dexHistory, { key: pending }).set({ details: wire(next) });
    await save(context, event, pool);
  }
  async function diamond(name: string, context: Context, event: DexEvent) {
    if (name === "ProtocolPoolCreated") return initialize(context, event, "phase-one");
    if (name === "MarketSwapRecorded") return tape(context, event);
    const poolId = event.args.poolId ? (String(event.args.poolId) as Hex) : null;
    if (!poolId) return;
    const pool = await read(context, poolId);
    if (!pool) return;
    const relevant = [
      "PoolRewardFunded",
      "ManagedLiquidityProvided",
      "ManagedLiquidityAttached",
      "ManagedLiquidityChanged",
      "ManagedLiquidityRebalanced",
      "ManagedLiquidityExited",
      "PoolGaugeStopped",
      "GeneralPoolDecommissionStarted",
      "GeneralPoolDecommissionFinalized",
      "ProtocolPoolQuarantineSet",
      "ProtocolGaugeRewardCredited",
      "ProtocolGaugeRewardRecycled",
    ];
    if (!relevant.includes(name)) return;
    await advance(context, event, pool);
    const a = event.args;
    if (name === "PoolRewardFunded") {
      await readTokenMetadata(context, event, getAddress(String(a.asset)));
      fundLp(
        pool,
        Number(a.slot),
        String(a.asset),
        BigInt(String(a.lpAmount)),
        event.block.timestamp,
        BigInt(String(a.periodFinish))
      );
    }
    if (name.startsWith("ManagedLiquidity")) {
      const id = String(a.positionId),
        previous = pool.legs.find((l) => l.positionId === id);
      const movement = a.movement as { liquidityAfter: bigint } | undefined;
      if (name === "ManagedLiquidityExited")
        pool.legs = pool.legs.filter((l) => l.positionId !== id);
      else {
        const leg = {
          positionId: id,
          tickLower: Number(a.tickLower ?? previous?.tickLower),
          tickUpper: Number(a.tickUpper ?? previous?.tickUpper),
          liquidity: String(movement?.liquidityAfter ?? a.liquidity),
        };
        if (!Number.isInteger(leg.tickLower) || !Number.isInteger(leg.tickUpper))
          throw new Error("Incomplete managed LP topology");
        pool.legs = [...pool.legs.filter((l) => l.positionId !== id), leg];
      }
    }
    if (name === "PoolGaugeStopped") pool.stopped = true;
    if (name.startsWith("GeneralPoolDecommission")) pool.decommissioned = true;
    if (name === "ProtocolPoolQuarantineSet") pool.quarantined = Boolean(a.quarantined);
    if (name === "ProtocolGaugeRewardCredited" || name === "ProtocolGaugeRewardRecycled")
      await history(
        context,
        event,
        poolId,
        name === "ProtocolGaugeRewardCredited" ? "credit" : "recycle",
        { amount: String(a.amount) },
        ":reward"
      );
    await history(context, event, poolId, "pool", pool);
    await save(context, event, pool);
  }
  const canonical = configuredCanonicalPool(configuredAddress("PONDER_POOL_MANAGER_ADDRESS"));
  return { diamond, modify, swap, initialize, canonical };
}

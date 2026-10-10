import { sql } from "ponder";
import {
  dexPool,
  dexRange,
  dexHistory,
  dexState,
  allocationToken,
  gaugeReserveState,
  allocationDirectoryPool,
} from "ponder:schema";
import type {
  MarketPool,
  MarketRange,
  MarketTrade,
  DexMetadata,
  AccrualSegment,
} from "./dex-domain";
import type { PricePoint } from "./dex-pricing";
export type Metric = {
  poolId: string;
  bucket: string;
  volume0: string;
  volume1: string;
  lp0: string;
  lp1: string;
  fee0: string;
  fee1: string;
  swaps: string;
  wallets: string;
};
export type History = {
  key: string;
  poolId: string;
  kind: string;
  timestamp: string;
  blockNumber: string;
  blockHash: string;
  logIndex: number;
  details:
    | MarketPool
    | (MarketRange & { rangeKey: string; delta: string })
    | AccrualSegment[]
    | { amount: string };
};
export type DexSnapshot = {
  checkpoint: string | null;
  generation: string;
  revision: string;
  anchor: { key: string; blockHash: string } | null;
  pools: MarketPool[];
  ranges: (MarketRange & { rangeKey: string })[];
  prices: PricePoint[];
  metrics: Metric[];
  daily: Metric[];
  history: History[];
  trades: (MarketTrade & { timestamp: string; blockNumber: string; logIndex: number })[];
  tokens: DexMetadata[];
  reserve: null | {
    activated: boolean;
    periodBudget: string;
    periodStart: string;
    periodFinish: string;
    periodAccounted: string;
    totalAllocatedWeight: string;
    updatedAtBlock: string;
    updatedAtTimestamp: string;
  };
  allocations: {
    poolId: string;
    weight: string;
    incentiveStreamCount: number;
    eligible: boolean;
  }[];
  wallets: { current: string; previous: string };
};
export function marketSnapshotSql(deployment: string) {
  // All six endpoints share this MVCC snapshot. Swap history is aggregated in SQL rather than shipped to Node.
  return sql`WITH cp AS (SELECT "latestCheckpoint" AS checkpoint FROM _ponder_checkpoint WHERE "chainName" = 'active'),
  clock AS (SELECT substring(checkpoint,1,10)::numeric AS now FROM cp),
  history AS NOT MATERIALIZED (SELECT ${dexHistory.key} AS key, ${dexHistory.poolId} AS pool_id, ${dexHistory.kind} AS kind,
    ${dexHistory.timestamp} AS time, ${dexHistory.blockNumber} AS block, ${dexHistory.blockHash} AS hash, ${dexHistory.logIndex} AS log,
    ${dexHistory.details}::jsonb AS d FROM ${dexHistory} WHERE ${dexHistory.deploymentId} = ${deployment}),
  trades AS (SELECT * FROM history WHERE kind = 'swap' AND d->>'complete' = 'true' AND d->>'internal' = 'false'),
  windowed AS (SELECT t.*, bucket FROM trades t, clock, (VALUES ('current'),('previous'),('week')) b(bucket)
    WHERE time <= now AND time >= now - CASE bucket WHEN 'week' THEN 604800 WHEN 'previous' THEN 172800 ELSE 86400 END
    AND (bucket <> 'previous' OR time < now - 86400)),
  totals AS (SELECT pool_id, bucket, sum(CASE WHEN (d->>'input0')::boolean THEN abs((d->>'coreAmount0')::numeric) ELSE 0 END) AS volume0,
    sum(CASE WHEN NOT (d->>'input0')::boolean THEN abs((d->>'coreAmount1')::numeric) ELSE 0 END) AS volume1,
    sum(CASE WHEN (d->>'input0')::boolean THEN trunc(abs((d->>'coreAmount0')::numeric)*(d->>'lpFee')::numeric/1000000) ELSE 0 END) AS lp0,
    sum(CASE WHEN NOT (d->>'input0')::boolean THEN trunc(abs((d->>'coreAmount1')::numeric)*(d->>'lpFee')::numeric/1000000) ELSE 0 END) AS lp1,
    sum((d->>'fee0')::numeric) AS fee0, sum((d->>'fee1')::numeric) AS fee1, count(*) AS swaps, count(DISTINCT lower(d->>'transactionSender')) AS wallets
    FROM windowed GROUP BY pool_id,bucket),
  daily AS (SELECT pool_id, floor(time/86400)::text AS bucket,
    sum(CASE WHEN (d->>'input0')::boolean THEN abs((d->>'coreAmount0')::numeric) ELSE 0 END) AS volume0,
    sum(CASE WHEN NOT (d->>'input0')::boolean THEN abs((d->>'coreAmount1')::numeric) ELSE 0 END) AS volume1, count(*) AS swaps
    FROM trades,clock WHERE time >= floor(now/86400)*86400 - 89*86400 AND time <= now GROUP BY pool_id,floor(time/86400)),
  boundaries AS (SELECT now AS time FROM clock UNION SELECT now-1800 FROM clock UNION SELECT now-86400 FROM clock UNION SELECT now-88200 FROM clock
    UNION SELECT floor(now/86400)*86400 - i*86400-1 FROM clock,generate_series(0,89) AS i
    UNION SELECT floor(now/86400)*86400 - i*86400-1801 FROM clock,generate_series(0,89) AS i),
  price_points AS (SELECT DISTINCT h.key, h.pool_id,h.time,h.d FROM ${dexPool} p CROSS JOIN boundaries b
    CROSS JOIN LATERAL (SELECT key,pool_id,time,d FROM history WHERE pool_id = p.pool_id AND kind IN ('pool','swap','price')
      AND time <= b.time AND d ? 'tick' ORDER BY block DESC,log DESC LIMIT 1) h WHERE p.deployment_id = ${deployment}),
  recent AS (SELECT * FROM trades ORDER BY block DESC, log DESC LIMIT 50),
  topology AS ((SELECT * FROM history WHERE kind NOT IN ('swap','price') AND time >= (SELECT now - 90*86400 FROM clock))
    UNION (SELECT DISTINCT ON (pool_id) * FROM history WHERE kind = 'pool' AND time < (SELECT now - 90*86400 FROM clock) ORDER BY pool_id,block DESC,log DESC))
  SELECT json_build_object(
    'checkpoint',(SELECT checkpoint FROM cp),
    'generation',coalesce((SELECT value->>'build_id' FROM _ponder_meta WHERE key = 'app'),'unknown'),
    'revision',coalesce((SELECT ${dexState.revision}::text FROM ${dexState} WHERE ${dexState.deploymentId} = ${deployment}),'0'),
    'anchor',(SELECT json_build_object('key',key,'blockHash',hash) FROM history ORDER BY block DESC,log DESC,key DESC LIMIT 1),
    'pools',coalesce((SELECT json_agg(${dexPool.details}::json) FROM ${dexPool} WHERE ${dexPool.deploymentId} = ${deployment}),'[]'::json),
    'ranges',coalesce((SELECT json_agg(${dexRange.details}::jsonb || jsonb_build_object('rangeKey',${dexRange.key})) FROM ${dexRange} WHERE ${dexRange.deploymentId} = ${deployment}),'[]'::json),
    'prices',coalesce((SELECT json_agg(json_build_object('poolId',pool_id,'timestamp',d->>'priceTime','tick',d->'tick','sqrtPriceX96',d->>'sqrtPriceX96','cumulative',d->>'cumulative')) FROM price_points),'[]'::json),
    'metrics',coalesce((SELECT json_agg(json_build_object('poolId',pool_id,'bucket',bucket,'volume0',volume0::text,'volume1',volume1::text,'lp0',lp0::text,'lp1',lp1::text,'fee0',fee0::text,'fee1',fee1::text,'swaps',swaps::text,'wallets',wallets::text)) FROM totals),'[]'::json),
    'daily',coalesce((SELECT json_agg(json_build_object('poolId',pool_id,'bucket',bucket,'volume0',volume0::text,'volume1',volume1::text,'lp0','0','lp1','0','fee0','0','fee1','0','swaps',swaps::text,'wallets','0')) FROM daily),'[]'::json),
    'history',coalesce((SELECT json_agg(json_build_object('key',key,'poolId',pool_id,'kind',kind,'timestamp',time::text,'blockNumber',block::text,'blockHash',hash,'logIndex',log,'details',d) ORDER BY block,log,key) FROM topology),'[]'::json),
    'trades',coalesce((SELECT json_agg(d || jsonb_build_object('timestamp',time::text,'blockNumber',block::text,'logIndex',log) ORDER BY block DESC,log DESC) FROM recent),'[]'::json),
    'tokens',coalesce((SELECT json_agg(json_build_object('address',${allocationToken.address},'name',${allocationToken.name},'symbol',${allocationToken.symbol},'decimals',${allocationToken.decimals})) FROM ${allocationToken} WHERE ${allocationToken.chainId} = ${Number(process.env.PONDER_CHAIN_ID ?? "4663")}),'[]'::json),
    'reserve',(SELECT json_build_object('activated',${gaugeReserveState.activated},'periodBudget',${gaugeReserveState.periodBudget}::text,'periodStart',${gaugeReserveState.periodStart}::text,'periodFinish',${gaugeReserveState.periodFinish}::text,'periodAccounted',${gaugeReserveState.periodAccounted}::text,'totalAllocatedWeight',${gaugeReserveState.totalAllocatedWeight}::text,'updatedAtBlock',${gaugeReserveState.updatedAtBlock}::text,'updatedAtTimestamp',${gaugeReserveState.updatedAtTimestamp}::text) FROM ${gaugeReserveState} WHERE ${gaugeReserveState.deploymentId} = ${deployment}),
    'allocations',coalesce((SELECT json_agg(json_build_object('poolId',${allocationDirectoryPool.poolId},'weight',${allocationDirectoryPool.weight}::text,'eligible',${allocationDirectoryPool.eligible},'incentiveStreamCount',${allocationDirectoryPool.incentiveStreamCount})) FROM ${allocationDirectoryPool} WHERE ${allocationDirectoryPool.deploymentId} = ${deployment}),'[]'::json),
    'wallets',json_build_object('current',(SELECT count(DISTINCT lower(d->>'transactionSender'))::text FROM windowed WHERE bucket='current'),'previous',(SELECT count(DISTINCT lower(d->>'transactionSender'))::text FROM windowed WHERE bucket='previous'))
  ) AS payload`;
}
export function marketAnchorSql(deployment: string, anchor: DexSnapshot["anchor"]) {
  return sql`SELECT (SELECT ${dexHistory.blockHash} FROM ${dexHistory} WHERE ${dexHistory.deploymentId} = ${deployment} AND ${dexHistory.key} = ${anchor?.key ?? ""}) AS hash,
    coalesce((SELECT value->>'build_id' FROM _ponder_meta WHERE key='app'),'unknown') AS generation,
    coalesce((SELECT ${dexState.revision}::text FROM ${dexState} WHERE ${dexState.deploymentId} = ${deployment}),'0') AS revision`;
}

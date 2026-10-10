import { getAddress, isHash, type Address, type Hex } from "viem";
import { configuredIndexerUrlForDeployment, fetchIndexer } from "@/lib/indexer/statics";

/**
 * The DEX overview's market data (docs/dex-overview-indexer.md). Every value is priced from
 * Statics pools in a quote currency, USDG ("≈ $") or WETH. Values are integers in the quote
 * token's decimals; null means unpriced, never zero.
 */
export type DexQuote = "usdg" | "weth";
export type DexToken = Readonly<{
  address: Address;
  symbol: string | null;
  name?: string | null;
  decimals: number | null;
}>;
type Observed = Readonly<{
  deploymentId: string;
  indexedAtBlock: bigint;
  indexedAtTimestamp: bigint;
  quote: DexToken & Readonly<{ kind: DexQuote }>;
}>;
export type DexTotals = Readonly<{
  volume: bigint | null;
  lpFees: bigint | null;
  protocolFees: bigint | null;
  swaps: bigint;
  wallets: bigint;
  valueLocked: bigint | null;
  coverage: Readonly<
    Record<
      "volume" | "lpFees" | "protocolFees" | "valueLocked",
      Readonly<{ includedPools: number; omittedPools: number; historyComplete: boolean }>
    >
  >;
}>;
export type DexSummary = Observed &
  Readonly<{
    current: DexTotals;
    previous: DexTotals;
    activePools: number;
    unpricedPools: number;
    statics: Readonly<{ price: bigint | null; change24hBps: number | null }>;
  }>;
export type DexPool = Readonly<{
  poolId: Hex;
  token0: DexToken;
  token1: DexToken;
  /** Parts per million, as v4 fees. */
  lpFee: number;
  /** token1 per token0, decimal text already adjusted for decimals. */
  pairPrice: string | null;
  change24hBps: number | null;
  volume24h: bigint | null;
  volume7d: bigint | null;
  lpFees24h: bigint | null;
  protocolFees24h: bigint | null;
  valueLocked: bigint | null;
  amount0: bigint;
  amount1: bigint;
  incentiveStreams: number;
  emissionShareBps: number;
  estimatedYieldBps: number | null;
  priced: boolean;
  source: "genesis" | "phase-one";
  priceFallback: boolean;
  liquidityComplete: boolean;
  historyStart: bigint;
  yieldComponents: Readonly<{
    lpFees: bigint | null;
    gaugeCredits: bigint | null;
    lpBribeAccrual: bigint | null;
    complete: boolean;
    /** Seconds of history the yield is annualised over: one day to seven. */
    windowSeconds: bigint;
    estimated: true;
  }>;
}>;
export type DexPoolPage = Observed &
  Readonly<{ items: readonly DexPool[]; nextCursor: string | null; total: number }>;
export type DexTokenPrice = Readonly<{
  token: DexToken;
  price: bigint | null;
  change24hBps: number | null;
  volume24h: bigint | null;
  route: readonly Hex[];
  priceFallback: boolean;
  priceNumerator: bigint | null;
  priceDenominator: bigint | null;
}>;
export type DexTokens = Observed & Readonly<{ items: readonly DexTokenPrice[] }>;
export type DexVolume = Observed &
  Readonly<{
    days: readonly Readonly<{
      day: string;
      volume: bigint | null;
      swaps: bigint;
      provisional: boolean;
      coverage: Readonly<{ includedPools: number; omittedPools: number; historyComplete: boolean }>;
    }>[];
  }>;
export type DexEmissions = Observed &
  Readonly<{
    period: Readonly<{
      budget: bigint;
      start: bigint;
      finish: bigint;
      emitted: bigint;
      accounted: bigint;
      activated: boolean;
      expired: boolean;
      observedAtBlock: bigint;
      observedAtTimestamp: bigint;
    }> | null;
    pools: readonly Readonly<{
      poolId: Hex;
      token0: DexToken;
      token1: DexToken;
      shareBps: number;
    }>[];
    othersBps: number;
  }>;
export type DexTrade = Readonly<{
  poolId: Hex;
  tokenIn: DexToken;
  tokenOut: DexToken;
  amountIn: bigint;
  amountOut: bigint;
  value: bigint | null;
  sender: Address;
  transactionHash: Hex;
  timestamp: bigint;
  priced: boolean;
  logIndex: number;
  settlement: "wallet" | "core-pool";
}>;
export type DexTrades = Observed & Readonly<{ items: readonly DexTrade[] }>;

const fail = (what: string): never => {
  throw new Error(`The Phase 1 indexer returned invalid ${what}.`);
};
const object = (v: unknown, what: string) =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(what);
const list = (v: unknown, what: string) => (Array.isArray(v) ? v : fail(what));
const uint = (v: unknown, what: string) =>
  typeof v === "string" && /^(0|[1-9]\d*)$/.test(v) && v.length <= 200 ? BigInt(v) : fail(what);
const optionalUint = (v: unknown, what: string) => (v === null ? null : uint(v, what));
const int = (
  v: unknown,
  what: string,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER
) => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : fail(what));
const optionalInt = (v: unknown, what: string) => (v === null ? null : int(v, what));
const boolean = (v: unknown, what: string) => (typeof v === "boolean" ? v : fail(what));
const unique = <T>(items: T[], key: (v: T) => string, what: string) =>
  new Set(items.map(key)).size === items.length ? items : fail(what);
const address = (v: unknown, what: string) =>
  typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v) ? getAddress(v) : fail(what);
const hash = (v: unknown, what: string) =>
  typeof v === "string" && isHash(v) ? (v as Hex) : fail(what);
const text = (v: unknown, what: string) =>
  v === null ? null : typeof v === "string" ? v : fail(what);
const token = (v: unknown): DexToken => {
  const t = object(v, "token");
  return {
    address: address(t.address, "token address"),
    symbol: text(t.symbol, "token symbol"),
    name: t.name === undefined ? null : text(t.name, "token name"),
    decimals: t.decimals === null ? null : int(t.decimals, "token decimals", 0, 255),
  };
};
function observed(
  value: unknown,
  deploymentId: string
): Observed & { body: Record<string, unknown> } {
  const body = object(value, "market response");
  if (body.deploymentId !== deploymentId) fail("deployment");
  const quote = object(body.quote, "quote");
  const kind = quote.kind === "usdg" || quote.kind === "weth" ? quote.kind : fail("quote kind");
  if (quote.decimals === null || quote.symbol === null) fail("quote metadata");
  return {
    body,
    deploymentId,
    indexedAtBlock: uint(body.indexedAtBlock, "indexed block"),
    indexedAtTimestamp: uint(body.indexedAtTimestamp, "indexed time"),
    quote: { ...token(quote), kind },
  };
}
const strip = <T extends { body: unknown }>(value: T): Omit<T, "body"> => {
  const copy: Partial<T> = { ...value };
  delete copy.body;
  return copy as Omit<T, "body">;
};
const totals = (v: unknown): DexTotals => {
  const t = object(v, "totals");
  return {
    volume: optionalUint(t.volume, "volume"),
    lpFees: optionalUint(t.lpFees, "LP fees"),
    protocolFees: optionalUint(t.protocolFees, "protocol fees"),
    swaps: uint(t.swaps, "swaps"),
    wallets: uint(t.wallets, "wallets"),
    valueLocked: optionalUint(t.valueLocked, "value locked"),
    coverage: Object.fromEntries(
      ["volume", "lpFees", "protocolFees", "valueLocked"].map((key) => {
        const c = object(object(t.coverage, "coverage")[key], "metric coverage");
        return [
          key,
          {
            includedPools: int(c.includedPools, "included pools", 0),
            omittedPools: int(c.omittedPools, "omitted pools", 0),
            historyComplete: boolean(c.historyComplete, "history complete"),
          },
        ];
      })
    ) as DexTotals["coverage"],
  };
};

export function parseDexSummary(value: unknown, deploymentId: string): DexSummary {
  const o = observed(value, deploymentId),
    statics = object(o.body.statics, "STATICS price");
  return {
    ...strip(o),
    current: totals(o.body.current),
    previous: totals(o.body.previous),
    activePools: int(o.body.activePools, "active pools", 0),
    unpricedPools: int(o.body.unpricedPools, "unpriced pools", 0),
    statics: {
      price: optionalUint(statics.price, "STATICS price"),
      change24hBps: optionalInt(statics.change24hBps, "STATICS change"),
    },
  };
}

export function parseDexPools(value: unknown, deploymentId: string): DexPoolPage {
  const o = observed(value, deploymentId);
  const items = list(o.body.items, "pools").map((raw): DexPool => {
    const p = object(raw, "pool");
    const priced = p.priced === true ? true : p.priced === false ? false : fail("pool priced");
    const valueLocked = optionalUint(p.valueLocked, "pool value locked");
    if (!priced && valueLocked !== null) fail("unpriced pool value");
    const yieldComponents = object(p.yieldComponents, "yield components");
    const complete = boolean(yieldComponents.complete, "yield coverage");
    // Indexers before trailing-window yields send no window: a yield then implies a full week.
    const windowSeconds =
      yieldComponents.windowSeconds === undefined
        ? complete
          ? 604_800n
          : 0n
        : uint(yieldComponents.windowSeconds, "yield window");
    // A yield needs at least a day of history; a full week is the complete window.
    if (
      yieldComponents.estimated !== true ||
      windowSeconds > 604_800n ||
      (complete && windowSeconds !== 604_800n) ||
      (p.estimatedYieldBps !== null && windowSeconds < 86_400n)
    )
      fail("estimated yield");
    return {
      poolId: hash(p.poolId, "pool ID"),
      token0: token(p.token0),
      token1: token(p.token1),
      lpFee: int(p.lpFee, "LP fee", 0, 1_000_000),
      pairPrice:
        p.pairPrice === null
          ? null
          : typeof p.pairPrice === "string" && /^\d+(\.\d+)?$/.test(p.pairPrice)
            ? p.pairPrice
            : fail("pair price"),
      change24hBps: optionalInt(p.change24hBps, "pool change"),
      volume24h: optionalUint(p.volume24h, "pool volume"),
      volume7d: optionalUint(p.volume7d, "pool weekly volume"),
      lpFees24h: optionalUint(p.lpFees24h, "pool LP fees"),
      protocolFees24h: optionalUint(p.protocolFees24h, "pool protocol fees"),
      valueLocked,
      amount0: uint(p.amount0, "pool amount0"),
      amount1: uint(p.amount1, "pool amount1"),
      incentiveStreams: int(p.incentiveStreams, "incentive streams", 0),
      emissionShareBps: int(p.emissionShareBps, "emission share", 0, 10_000),
      estimatedYieldBps: p.estimatedYieldBps === null ? null : int(p.estimatedYieldBps, "yield", 0),
      priced,
      source: p.source === "genesis" || p.source === "phase-one" ? p.source : fail("market source"),
      priceFallback: boolean(p.priceFallback, "price fallback"),
      liquidityComplete: boolean(p.liquidityComplete, "liquidity coverage"),
      historyStart: uint(p.historyStart, "history start"),
      yieldComponents: {
        lpFees: optionalUint(yieldComponents.lpFees, "weekly LP fees"),
        gaugeCredits: optionalUint(yieldComponents.gaugeCredits, "gauge credits"),
        lpBribeAccrual: optionalUint(yieldComponents.lpBribeAccrual, "LP bribe accrual"),
        complete,
        windowSeconds,
        estimated: true,
      },
    };
  });
  const nextCursor = text(o.body.nextCursor, "cursor");
  return {
    ...strip(o),
    items: unique(items, (p) => p.poolId.toLowerCase(), "duplicate pools"),
    nextCursor,
    total: int(o.body.total, "pool total", items.length),
  };
}

export function parseDexTokens(value: unknown, deploymentId: string): DexTokens {
  const o = observed(value, deploymentId);
  return {
    ...strip(o),
    items: unique(
      list(o.body.items, "tokens").map((raw) => {
        const t = object(raw, "token price");
        const n = optionalUint(t.priceNumerator, "price numerator"),
          d = optionalUint(t.priceDenominator, "price denominator");
        if (
          (n === null) !== (d === null) ||
          (d !== null && d === 0n) ||
          (t.price === null) !== (n === null)
        )
          fail("exact price");
        return {
          token: token(t.token),
          price: optionalUint(t.price, "token price"),
          change24hBps: optionalInt(t.change24hBps, "token change"),
          volume24h: optionalUint(t.volume24h, "token volume"),
          route: unique(
            list(t.route, "route").map((id) => hash(id, "route pool")),
            (id) => id.toLowerCase(),
            "duplicate route pools"
          ),
          priceFallback: boolean(t.priceFallback, "token fallback"),
          priceNumerator: n,
          priceDenominator: d,
        };
      }),
      (t) => t.token.address.toLowerCase(),
      "duplicate tokens"
    ),
  };
}

export function parseDexVolume(value: unknown, deploymentId: string): DexVolume {
  const o = observed(value, deploymentId);
  return {
    ...strip(o),
    days: list(o.body.days, "volume days").map((raw) => {
      const d = object(raw, "volume day");
      const day =
        typeof d.day === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(d.day) &&
        !Number.isNaN(Date.parse(d.day)) &&
        new Date(d.day).toISOString().slice(0, 10) === d.day
          ? d.day
          : fail("day");
      const coverage = object(d.coverage, "day coverage");
      return {
        day,
        volume: optionalUint(d.volume, "day volume"),
        swaps: uint(d.swaps, "day swaps"),
        provisional: boolean(d.provisional, "provisional day"),
        coverage: {
          includedPools: int(coverage.includedPools, "included pools", 0),
          omittedPools: int(coverage.omittedPools, "omitted pools", 0),
          historyComplete: boolean(coverage.historyComplete, "history complete"),
        },
      };
    }),
  };
}

export function parseDexEmissions(value: unknown, deploymentId: string): DexEmissions {
  const o = observed(value, deploymentId);
  const period = o.body.period === null ? null : object(o.body.period, "period");
  const shares = list(o.body.pools, "emission pools").map((raw) => {
    const p = object(raw, "emission pool");
    return {
      poolId: hash(p.poolId, "emission pool ID"),
      token0: token(p.token0),
      token1: token(p.token1),
      shareBps: int(p.shareBps, "emission share", 0, 10000),
    };
  });
  const others = int(o.body.othersBps, "other emissions", 0, 10000);
  unique(shares, (p) => p.poolId.toLowerCase(), "duplicate emission pools");
  if (shares.reduce((sum, p) => sum + p.shareBps, others) !== 10000) fail("emission distribution");
  if (
    period &&
    (uint(period.emitted, "emitted") > uint(period.budget, "budget") ||
      uint(period.finish, "finish") < uint(period.start, "start"))
  )
    fail("period bounds");
  return {
    ...strip(o),
    period: period && {
      budget: uint(period.budget, "budget"),
      start: uint(period.start, "period start"),
      finish: uint(period.finish, "period finish"),
      emitted: uint(period.emitted, "emitted"),
      accounted: uint(period.accounted, "accounted"),
      activated: boolean(period.activated, "reserve activation"),
      expired: boolean(period.expired, "period expiry"),
      observedAtBlock: uint(period.observedAtBlock, "reserve block"),
      observedAtTimestamp: uint(period.observedAtTimestamp, "reserve time"),
    },
    pools: shares,
    othersBps: others,
  };
}

export function parseDexTrades(value: unknown, deploymentId: string): DexTrades {
  const o = observed(value, deploymentId);
  return {
    ...strip(o),
    items: list(o.body.items, "trades").map((raw) => {
      const t = object(raw, "trade");
      if (boolean(t.priced, "trade priced") !== (t.value !== null)) fail("trade valuation");
      return {
        poolId: hash(t.poolId, "trade pool"),
        tokenIn: token(t.tokenIn),
        tokenOut: token(t.tokenOut),
        amountIn: uint(t.amountIn, "amount in"),
        amountOut: uint(t.amountOut, "amount out"),
        value: optionalUint(t.value, "trade value"),
        sender: address(t.sender, "trade sender"),
        transactionHash: hash(t.transactionHash, "trade transaction"),
        timestamp: uint(t.timestamp, "trade time"),
        priced: boolean(t.priced, "trade priced"),
        logIndex: int(t.logIndex, "trade log index", 0),
        settlement:
          t.settlement === "wallet" || t.settlement === "core-pool"
            ? t.settlement
            : fail("trade settlement"),
      };
    }),
  };
}

export class DexMarketRestartError extends Error {
  constructor() {
    super("The market snapshot changed. Reload the pool directory.");
    this.name = "DexMarketRestartError";
  }
}
async function load(deploymentId: string, path: string): Promise<unknown> {
  const base = configuredIndexerUrlForDeployment(deploymentId);
  if (!base) throw new Error("No Phase 1 indexer is configured for this deployment.");
  const response = await fetchIndexer(`${base}${path}`, "no-store");
  if (response.status === 409) {
    const body = await response.json();
    if (body?.code === "MARKET_SNAPSHOT_CHANGED") throw new DexMarketRestartError();
  }
  if (!response.ok) throw new Error(`Phase 1 market request failed (${response.status}).`);
  return response.json();
}
const withQuote = (quote: DexQuote, extra: Record<string, string> = {}) =>
  `?${new URLSearchParams({ quote, ...extra })}`;

export const loadDexSummary = async (deploymentId: string, quote: DexQuote) =>
  parseDexSummary(
    await load(deploymentId, `/phase-one/market/summary${withQuote(quote)}`),
    deploymentId
  );
export const loadDexPools = async (
  deploymentId: string,
  quote: DexQuote,
  filters: Readonly<{
    sort?: string;
    direction?: "asc" | "desc";
    search?: string;
    limit?: number;
    cursor?: string;
  }> = {}
) =>
  parseDexPools(
    await load(
      deploymentId,
      `/phase-one/market/pools${withQuote(
        quote,
        Object.fromEntries(
          Object.entries(filters)
            .filter(([, v]) => v !== undefined && v !== "")
            .map(([k, v]) => [k, String(v)])
        )
      )}`
    ),
    deploymentId
  );
export const loadDexTokens = async (deploymentId: string, quote: DexQuote) =>
  parseDexTokens(
    await load(deploymentId, `/phase-one/market/tokens${withQuote(quote)}`),
    deploymentId
  );
export const loadDexVolume = async (deploymentId: string, quote: DexQuote, days: number) =>
  parseDexVolume(
    await load(deploymentId, `/phase-one/market/volume${withQuote(quote, { days: String(days) })}`),
    deploymentId
  );
export const loadDexEmissions = async (deploymentId: string, quote: DexQuote) =>
  parseDexEmissions(
    await load(deploymentId, `/phase-one/market/emissions${withQuote(quote)}`),
    deploymentId
  );
export const loadDexTrades = async (deploymentId: string, quote: DexQuote, limit = 8) =>
  parseDexTrades(
    await load(
      deploymentId,
      `/phase-one/market/trades${withQuote(quote, { limit: String(limit) })}`
    ),
    deploymentId
  );

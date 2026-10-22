import { loadEthUsd } from "./eth-usd";
import {
  midpoint,
  positiveDecimal,
  USD_SCALE,
  type PriceReference,
  type UsdReferenceSnapshot,
} from "../market/reference-prices";

const RH = "https://api.robinhood.com/rhj/";
const MAX_AGE = 15 * 60_000;
const COOLDOWN = 30_000;
type Entry<T> = { value: T; at: number; retryAt: number; pending?: Promise<T | null> };
type Asset = { address: string; symbol: string; multiplier: bigint };
type Quote = { valueWad: bigint; observedAt: number; halted: boolean };
const entries = new Map<string, Entry<unknown>>();
let knownStocks: string[] = [];
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Invalid reference response");
  return v as Record<string, unknown>;
};
let activeRequests = 0;
const waiting: (() => void)[] = [];
async function limited<T>(work: () => Promise<T>): Promise<T> {
  if (activeRequests >= 4) await new Promise<void>((resolve) => waiting.push(resolve));
  else activeRequests++;
  try {
    return await work();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else activeRequests--;
  }
}
async function json(url: string) {
  return limited(async () => {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error("USD reference provider unavailable");
    return response.json() as Promise<unknown>;
  });
}
async function cached<T>(
  key: string,
  ttl: number,
  now: number,
  fetcher: () => Promise<T>
): Promise<{ value: T; at: number; stale: boolean } | null> {
  let entry = entries.get(key) as Entry<T> | undefined;
  const result = () =>
    entry && now - entry.at < MAX_AGE && entry.value !== undefined
      ? { value: entry.value, at: entry.at, stale: now - entry.at >= ttl }
      : null;
  if (entry && (now - entry.at < ttl || now < entry.retryAt)) return result();
  if (!entry) {
    // Bound cache memory across changing market inventories. Never evict active requests.
    if (entries.size >= 2048) {
      const evict = [...entries].find(([k, v]) => k !== "assets" && !v.pending);
      if (evict) entries.delete(evict[0]);
      else return null;
    }
    entry = { value: undefined as T, at: -Infinity, retryAt: 0 };
    entries.set(key, entry);
  }
  if (!entry.pending) {
    const state = entry;
    state.pending = fetcher()
      .then((value) => {
        state.value = value;
        state.at = now;
        return value;
      })
      .catch(() => null)
      .finally(() => {
        state.retryAt = now + COOLDOWN;
        state.pending = undefined;
      });
  }
  await entry.pending;
  return result();
}
function matches(row: Record<string, unknown>, address: string, chainId: number) {
  return (
    Array.isArray(row.deployments) &&
    row.deployments.some((d) => {
      const deployment = object(d);
      return (
        deployment.chainId === chainId &&
        typeof deployment.contractAddress === "string" &&
        deployment.contractAddress.toLowerCase() === address
      );
    })
  );
}
function parseAssets(payload: unknown): Asset[] {
  const rows = object(payload).assets;
  if (!Array.isArray(rows) || !rows.length || rows.length > 4096)
    throw new Error("Invalid stock registry");
  const assets: Asset[] = [];
  for (const item of rows) {
    const row = object(item);
    if (!Array.isArray(row.deployments)) throw new Error("Invalid stock deployments");
    for (const value of row.deployments) {
      const d = object(value);
      if (d.chainId !== 4663) continue;
      if (
        typeof d.contractAddress !== "string" ||
        !/^0x[\da-f]{40}$/i.test(d.contractAddress) ||
        typeof row.tokenSymbol !== "string" ||
        !/^[A-Za-z0-9.\-]{1,32}$/.test(row.tokenSymbol)
      )
        throw new Error("Invalid stock identity");
      assets.push({
        address: d.contractAddress.toLowerCase(),
        symbol: row.tokenSymbol,
        multiplier: positiveDecimal(row.currentMultiplier),
      });
    }
  }
  if (new Set(assets.map((a) => a.address)).size !== assets.length)
    throw new Error("Duplicate stock identity");
  return assets;
}
export async function loadUsdReferences(
  input: {
    chainId: number;
    tokens: readonly { address: string; decimals: number | null }[];
    weth: string | null;
    usdg: string | null;
  },
  now = Date.now()
): Promise<UsdReferenceSnapshot> {
  const snapshot = {
    asOf: now,
    prices: [] as UsdReferenceSnapshot["prices"][number][],
    restricted: [] as string[],
    allowDerived: false,
  };
  if (input.chainId !== 4663) return snapshot;
  const registry = await cached("assets", 60_000, now, async () =>
    parseAssets(await json(`${RH}assets`))
  );
  if (registry)
    knownStocks = [...new Set([...knownStocks, ...registry.value.map((a) => a.address)])];
  snapshot.restricted = [...knownStocks];
  snapshot.allowDerived = registry !== null;
  const tokens = [...new Map(input.tokens.map((t) => [t.address.toLowerCase(), t])).values()];
  const jobs = tokens
    .filter((t) => t.decimals !== null)
    .map((token) => async () => {
      const address = token.address.toLowerCase();
      const stock = registry?.value.find((a) => a.address === address);
      const source = stock
        ? "robinhood"
        : address === input.weth?.toLowerCase()
          ? "coinbase"
          : address === input.usdg?.toLowerCase()
            ? "kraken"
            : null;
      if (!source) return;
      let q: { value: Quote; at: number; stale: boolean } | null;
      if (source === "coinbase") {
        const eth = await limited(() => loadEthUsd(now));
        q = eth
          ? {
              value: { valueWad: eth.valueWad, observedAt: eth.fetchedAt, halted: false },
              at: eth.fetchedAt,
              stale: eth.stale,
            }
          : null;
      } else
        q = await cached(`quote:${address}`, 30_000, now, async () => {
          if (source === "kraken") {
            const response = object(
              await json("https://api.kraken.com/0/public/Ticker?pair=USDGUSD")
            );
            if (!Array.isArray(response.error) || response.error.length)
              throw new Error("Kraken quote error");
            const ticker = object(object(response.result).USDGUSD);
            if (!Array.isArray(ticker.b) || !Array.isArray(ticker.a))
              throw new Error("Invalid Kraken ticker");
            return { valueWad: midpoint(ticker.b[0], ticker.a[0]), observedAt: now, halted: false };
          }
          const payload = object(await json(`${RH}prices/${encodeURIComponent(stock!.symbol)}`));
          if (!Array.isArray(payload.quotes) || payload.quotes.length !== 1)
            throw new Error("Invalid stock quote");
          const row = object(payload.quotes[0]);
          if (
            !matches(row, address, 4663) ||
            row.tokenSymbol !== stock!.symbol ||
            row.currency !== "USD" ||
            typeof row.isTradingHalt !== "boolean" ||
            typeof row.generatedAt !== "string"
          )
            throw new Error("Stock quote identity mismatch");
          const observedAt = Date.parse(row.generatedAt);
          if (
            !Number.isFinite(observedAt) ||
            observedAt > now + 30_000 ||
            now - observedAt >= MAX_AGE
          )
            throw new Error("Expired stock quote");
          const adjusted = row.tokenBid !== undefined || row.tokenAsk !== undefined;
          // Adjusted fields already include corporate actions. Never apply the multiplier twice.
          const valueWad = adjusted
            ? midpoint(row.tokenBid, row.tokenAsk)
            : (midpoint(row.bid, row.ask) * stock!.multiplier) / USD_SCALE;
          if (valueWad <= 0n) throw new Error("Stock price underflow");
          return { valueWad, observedAt, halted: row.isTradingHalt };
        });
      if (!q) return;
      const expiresAt =
        Math.min(q.at, q.value.observedAt, source === "robinhood" ? registry!.at : q.at) + MAX_AGE;
      if (expiresAt <= now) return;
      const reference: PriceReference = {
        source,
        asset: address,
        observedAt: q.value.observedAt,
        fetchedAt: q.at,
        expiresAt,
        freshUntil: Math.min(
          q.at + (source === "coinbase" ? 60_000 : 30_000),
          q.value.observedAt + (source === "coinbase" ? 60_000 : 30_000),
          source === "robinhood" ? registry!.at + 60_000 : Infinity
        ),
        stale:
          q.stale ||
          now - q.value.observedAt >= (source === "coinbase" ? 60_000 : 30_000) ||
          (source === "robinhood" && registry!.stale),
        halted: q.value.halted,
      };
      snapshot.prices.push({
        address,
        decimals: token.decimals!,
        valueWad: q.value.valueWad,
        reference,
      });
    });
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, jobs.length) }, async () => {
      while (next < jobs.length) await jobs[next++]!();
    })
  );
  snapshot.prices.sort((a, b) => a.address.localeCompare(b.address));
  return Object.freeze({
    ...snapshot,
    prices: Object.freeze(
      snapshot.prices.map((p) => Object.freeze({ ...p, reference: Object.freeze(p.reference) }))
    ),
    restricted: Object.freeze(snapshot.restricted),
  });
}
export function resetUsdReferenceCacheForTest() {
  entries.clear();
  knownStocks = [];
}

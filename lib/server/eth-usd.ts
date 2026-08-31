import { decimalToWad } from "@/lib/market/analytics";

const COINBASE_TICKER = "https://api.exchange.coinbase.com/products/ETH-USD/ticker";
const FRESH_MS = 60_000;
const MAX_STALE_MS = 15 * 60_000;

type Price = Readonly<{ valueWad: bigint; fetchedAt: number; stale: boolean }>;

let lastGood: Price | null = null;
let inFlight: Promise<Price | null> | null = null;

function validPayload(value: unknown): value is { price: string } {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { price?: unknown }).price === "string"
  );
}

async function refresh(now: number): Promise<Price | null> {
  try {
    const response = await fetch(COINBASE_TICKER, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    const payload: unknown = response.ok ? await response.json() : null;
    if (!validPayload(payload)) throw new Error("Coinbase returned an invalid ETH/USD price.");
    const valueWad = decimalToWad(payload.price);
    if (valueWad <= 0n) throw new Error("Coinbase returned a non-positive ETH/USD price.");
    lastGood = { valueWad, fetchedAt: now, stale: false };
    return lastGood;
  } catch {
    return lastGood && now - lastGood.fetchedAt <= MAX_STALE_MS
      ? { ...lastGood, stale: true }
      : null;
  }
}

export async function loadEthUsd(now = Date.now()): Promise<Price | null> {
  if (lastGood && now - lastGood.fetchedAt <= FRESH_MS) return { ...lastGood, stale: false };
  if (!inFlight) {
    inFlight = refresh(now).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export function resetEthUsdCacheForTest(): void {
  lastGood = null;
  inFlight = null;
}

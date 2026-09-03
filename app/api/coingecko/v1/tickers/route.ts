import { loadCoinGeckoTickers } from "@/lib/server/coingecko-market";
import {
  COINGECKO_CACHE,
  coinGeckoJson,
  coinGeckoOptions,
  coinGeckoUnavailable,
} from "@/lib/server/coingecko-route";

export const runtime = "nodejs";

export async function GET() {
  try {
    return coinGeckoJson(await loadCoinGeckoTickers(), COINGECKO_CACHE.ticker);
  } catch {
    return coinGeckoUnavailable();
  }
}

export const OPTIONS = coinGeckoOptions;

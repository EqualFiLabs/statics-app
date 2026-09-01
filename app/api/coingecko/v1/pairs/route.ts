import { loadCoinGeckoPairs } from "@/lib/server/coingecko-market";
import {
  COINGECKO_CACHE,
  coinGeckoJson,
  coinGeckoOptions,
  coinGeckoUnavailable,
} from "@/lib/server/coingecko-route";

export const runtime = "nodejs";

export function GET() {
  try {
    return coinGeckoJson(loadCoinGeckoPairs(), COINGECKO_CACHE.pairs);
  } catch {
    return coinGeckoUnavailable();
  }
}

export const OPTIONS = coinGeckoOptions;

import { loadCoinGeckoStatus } from "@/lib/server/coingecko-market";
import {
  COINGECKO_CACHE,
  coinGeckoJson,
  coinGeckoOptions,
  coinGeckoUnavailable,
} from "@/lib/server/coingecko-route";

export const runtime = "nodejs";

export async function GET() {
  try {
    return coinGeckoJson(await loadCoinGeckoStatus(), COINGECKO_CACHE.status);
  } catch {
    return coinGeckoUnavailable();
  }
}

export const OPTIONS = coinGeckoOptions;

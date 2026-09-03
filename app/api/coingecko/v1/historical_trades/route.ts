import { parseCoinGeckoHistoricalTradeQuery } from "@/lib/market/coingecko-query";
import { coinGeckoSpotMarket, loadCoinGeckoHistoricalTrades } from "@/lib/server/coingecko-market";
import {
  COINGECKO_CACHE,
  coinGeckoBadRequest,
  coinGeckoJson,
  coinGeckoOptions,
  coinGeckoUnavailable,
} from "@/lib/server/coingecko-route";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const parsed = parseCoinGeckoHistoricalTradeQuery(request.url, coinGeckoSpotMarket().tickerId);
  if (!parsed.ok) return coinGeckoBadRequest(parsed.error);
  try {
    return coinGeckoJson(
      await loadCoinGeckoHistoricalTrades(parsed.query),
      COINGECKO_CACHE.history
    );
  } catch {
    return coinGeckoUnavailable();
  }
}

export const OPTIONS = coinGeckoOptions;

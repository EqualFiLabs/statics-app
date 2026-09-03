import { coinGeckoSupplyResult } from "@/lib/market/coingecko";
import { loadCoinGeckoSupply } from "@/lib/server/coingecko-market";
import {
  COINGECKO_CACHE,
  coinGeckoJson,
  coinGeckoOptions,
  coinGeckoUnavailable,
} from "@/lib/server/coingecko-route";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await loadCoinGeckoSupply();
    return coinGeckoJson(
      coinGeckoSupplyResult(snapshot.total, snapshot.decimals),
      COINGECKO_CACHE.supply
    );
  } catch {
    return coinGeckoUnavailable();
  }
}

export const OPTIONS = coinGeckoOptions;

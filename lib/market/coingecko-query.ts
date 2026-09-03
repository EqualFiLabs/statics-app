import type { CoinGeckoTradeSide } from "@/lib/market/coingecko";

export type CoinGeckoHistoricalTradeQuery = Readonly<{
  limit: number;
  from?: string;
  to?: string;
  side?: CoinGeckoTradeSide;
}>;

export function parseCoinGeckoHistoricalTradeQuery(
  requestUrl: string,
  expectedTickerId: string
):
  | Readonly<{ ok: true; query: CoinGeckoHistoricalTradeQuery }>
  | Readonly<{ ok: false; error: string }> {
  const params = new URL(requestUrl).searchParams;
  const tickerId = params.get("ticker_id");
  if (!tickerId || tickerId.toLowerCase() !== expectedTickerId.toLowerCase()) {
    return { ok: false, error: "ticker_id must identify the canonical STATICS/WETH market." };
  }

  const rawLimit = params.get("limit");
  const limit = rawLimit === null ? 200 : /^\d+$/.test(rawLimit) ? Number(rawLimit) : 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    return { ok: false, error: "limit must be an integer from 1 through 500." };
  }

  const rawSide = params.get("type");
  if (rawSide !== null && rawSide !== "buy" && rawSide !== "sell") {
    return { ok: false, error: "type must be buy or sell." };
  }

  const from = params.get("start_time") ?? undefined;
  const to = params.get("end_time") ?? undefined;
  if ((from !== undefined && !/^\d+$/.test(from)) || (to !== undefined && !/^\d+$/.test(to))) {
    return { ok: false, error: "start_time and end_time must be Unix timestamps in seconds." };
  }
  if (from !== undefined && to !== undefined && BigInt(to) < BigInt(from)) {
    return { ok: false, error: "end_time must not precede start_time." };
  }

  return {
    ok: true,
    query: {
      limit,
      ...(from === undefined ? {} : { from }),
      ...(to === undefined ? {} : { to }),
      ...(rawSide === null ? {} : { side: rawSide }),
    },
  };
}

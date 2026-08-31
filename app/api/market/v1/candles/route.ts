import { NextResponse } from "next/server";

import {
  marketApiAuthorization,
  marketIndexerUrl,
  proxyMarketIndexer,
} from "@/lib/server/market-api-route";

const MAX_RANGE_SECONDS = 31 * 24 * 60 * 60;
const RESOLUTIONS = new Set(["1", "5", "15", "60", "240", "1440"]);

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const denied = marketApiAuthorization(request);
  if (denied) return denied;
  const input = new URL(request.url);
  const from = input.searchParams.get("from");
  const to = input.searchParams.get("to");
  const resolution = input.searchParams.get("resolution");
  if (
    !from ||
    !to ||
    !/^\d+$/.test(from) ||
    !/^\d+$/.test(to) ||
    !resolution ||
    !RESOLUTIONS.has(resolution)
  ) {
    return NextResponse.json({ error: "Invalid candle range or resolution." }, { status: 400 });
  }
  const fromNumber = Number(from);
  const toNumber = Number(to);
  if (
    !Number.isSafeInteger(fromNumber) ||
    !Number.isSafeInteger(toNumber) ||
    toNumber < fromNumber ||
    toNumber - fromNumber > MAX_RANGE_SECONDS
  ) {
    return NextResponse.json(
      { error: "Candle range must be ordered and no longer than 31 days." },
      { status: 400 }
    );
  }
  try {
    const url = marketIndexerUrl("market/candles");
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    url.searchParams.set("resolution", resolution);
    return proxyMarketIndexer(url);
  } catch {
    return NextResponse.json({ error: "The market indexer is unavailable." }, { status: 503 });
  }
}

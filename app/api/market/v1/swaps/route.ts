import { NextResponse } from "next/server";

import {
  marketApiAuthorization,
  marketIndexerUrl,
  proxyMarketIndexer,
} from "@/lib/server/market-api-route";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const denied = marketApiAuthorization(request);
  if (denied) return denied;
  const rawLimit = new URL(request.url).searchParams.get("limit") ?? "50";
  if (!/^\d+$/.test(rawLimit)) {
    return NextResponse.json({ error: "Invalid swap limit." }, { status: 400 });
  }
  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return NextResponse.json({ error: "Swap limit must be between 1 and 100." }, { status: 400 });
  }
  try {
    const url = marketIndexerUrl("market/swaps");
    url.searchParams.set("limit", String(limit));
    return proxyMarketIndexer(url);
  } catch {
    return NextResponse.json({ error: "The market indexer is unavailable." }, { status: 503 });
  }
}

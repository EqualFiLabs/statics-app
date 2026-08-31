import { NextResponse } from "next/server";

import { marketApiAuthorization } from "@/lib/server/market-api-route";
import { loadMarketOverview } from "@/lib/server/market-overview";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const denied = marketApiAuthorization(request);
  if (denied) return denied;
  try {
    const overview = await loadMarketOverview();
    return NextResponse.json(overview, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch {
    return NextResponse.json({ error: "Market analytics are unavailable." }, { status: 503 });
  }
}

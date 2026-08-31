import { NextResponse } from "next/server";

import { loadMarketOverview } from "@/lib/server/market-overview";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const overview = await loadMarketOverview();
    return NextResponse.json(overview, {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
    });
  } catch {
    return NextResponse.json({ error: "Market analytics are unavailable." }, { status: 503 });
  }
}

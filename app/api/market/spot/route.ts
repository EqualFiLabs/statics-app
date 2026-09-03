import { NextResponse } from "next/server";

import { loadMarketSpotOverview } from "@/lib/server/market-overview";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await loadMarketSpotOverview(), {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch {
    return NextResponse.json(
      { error: "Market analytics are unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

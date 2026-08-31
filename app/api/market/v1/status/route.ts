import { NextResponse } from "next/server";

import { marketApiAuthorization } from "@/lib/server/market-api-route";
import { loadMarketOverview } from "@/lib/server/market-overview";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const denied = marketApiAuthorization(request);
  if (denied) return denied;
  try {
    const overview = await loadMarketOverview();
    return NextResponse.json(
      {
        ok: true,
        status: overview.status,
        chainId: overview.chainId,
        deploymentId: overview.deploymentId,
        asOfBlock: overview.asOfBlock,
        freshness: overview.freshness,
      },
      { headers: { "Cache-Control": "private, max-age=30" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Market analytics are unavailable." },
      { status: 503 }
    );
  }
}

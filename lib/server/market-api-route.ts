import { NextResponse } from "next/server";

import { authorizeMarketRequest } from "@/lib/server/market-api-auth";
import { staticsMainnetIndexerUrl } from "@/lib/server/statics-indexer-url";

export function marketApiAuthorization(request: Request): NextResponse | null {
  const result = authorizeMarketRequest(request);
  if (result.ok) return null;
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (result.retryAfter) headers["Retry-After"] = String(result.retryAfter);
  const message =
    result.status === 401
      ? "A valid market API bearer key is required."
      : result.status === 429
        ? "The market API rate limit was exceeded."
        : "The market API is not configured.";
  return NextResponse.json({ error: message }, { status: result.status, headers });
}

export function marketIndexerUrl(path: "market/candles" | "market/swaps"): URL {
  return staticsMainnetIndexerUrl(path);
}

export async function proxyMarketIndexer(url: URL): Promise<NextResponse> {
  try {
    const upstream = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    const payload: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok || !payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json(
        { error: "The market indexer request failed." },
        { status: upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502 }
      );
    }
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=30" },
    });
  } catch {
    return NextResponse.json({ error: "The market indexer is unavailable." }, { status: 503 });
  }
}

import { NextResponse } from "next/server";

export const COINGECKO_CACHE = {
  supply: "public, max-age=60, s-maxage=300, stale-while-revalidate=1800",
  ticker: "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
  pairs: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
} as const;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type, X-Requested-With",
} as const;

export function coinGeckoJson(body: unknown, cacheControl: string, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, "Cache-Control": cacheControl },
  });
}

export function coinGeckoUnavailable(): NextResponse {
  return coinGeckoJson({ error: "Market data are temporarily unavailable." }, "no-store", 503);
}

export function coinGeckoOptions(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

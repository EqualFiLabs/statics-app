import { NextResponse } from "next/server";

import { callUniswapApi } from "@/lib/server/uniswap";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const quote = isRecord(body) ? body.quote : null;
  if (!isRecord(quote)) {
    return NextResponse.json({ error: "Uniswap swap quote must be an object." }, { status: 400 });
  }
  const serialized = JSON.stringify(quote);
  if (serialized.length > 500_000 || Object.keys(quote).length === 0) {
    return NextResponse.json({ error: "Uniswap swap quote is invalid." }, { status: 400 });
  }
  const result = await callUniswapApi("/swap", {
    quote,
    refreshGasPrice: true,
    simulateTransaction: true,
    safetyMode: "SAFE",
    urgency: "normal",
  });
  return NextResponse.json(result.payload, { status: result.status });
}

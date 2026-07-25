import { NextResponse } from "next/server";

import { callAcross } from "@/lib/server/across";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const chainId = Number(new URL(request.url).searchParams.get("chainId"));
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    return NextResponse.json({ error: "A valid chainId is required." }, { status: 400 });
  }
  const result = await callAcross("/swap/tokens", { chainId: String(chainId) });
  return NextResponse.json(result.payload, { status: result.status });
}

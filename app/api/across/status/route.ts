import { NextResponse } from "next/server";

import { callAcross } from "@/lib/server/across";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const depositTxnRef = params.get("depositTxnRef")?.trim();
  if (
    !depositTxnRef ||
    depositTxnRef.length > 128 ||
    !/^(0x[0-9a-fA-F]+|[1-9A-HJ-NP-Za-km-z]+)$/.test(depositTxnRef)
  ) {
    return NextResponse.json(
      { error: "A valid deposit transaction reference is required." },
      { status: 400 }
    );
  }
  const result = await callAcross("/deposit/status", { depositTxnRef });
  return NextResponse.json(result.payload, { status: result.status });
}

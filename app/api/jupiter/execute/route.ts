import { NextResponse } from "next/server";

import { callJupiterExecute } from "@/lib/server/jupiter";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (
    typeof input.signedTransaction !== "string" ||
    input.signedTransaction.length === 0 ||
    input.signedTransaction.length > 250_000 ||
    !/^[A-Za-z0-9+/=_-]+$/.test(input.signedTransaction) ||
    typeof input.requestId !== "string" ||
    input.requestId.length === 0 ||
    input.requestId.length > 256 ||
    (input.lastValidBlockHeight !== undefined &&
      (typeof input.lastValidBlockHeight !== "string" ||
        !/^[1-9][0-9]*$/.test(input.lastValidBlockHeight)))
  ) {
    return NextResponse.json({ error: "Invalid Jupiter execution parameters." }, { status: 400 });
  }
  const result = await callJupiterExecute({
    signedTransaction: input.signedTransaction,
    requestId: input.requestId,
    ...(typeof input.lastValidBlockHeight === "string"
      ? { lastValidBlockHeight: input.lastValidBlockHeight }
      : {}),
  });
  return NextResponse.json(result.payload, { status: result.status });
}

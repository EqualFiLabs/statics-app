import { NextResponse } from "next/server";

import { isSolanaAddress } from "@/lib/portal/solana";
import { callJupiterOrder, DEFAULT_JUPITER_SLIPPAGE_BPS } from "@/lib/server/jupiter";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const slippageBps =
    input.slippageBps === undefined ? DEFAULT_JUPITER_SLIPPAGE_BPS : Number(input.slippageBps);
  if (
    !isSolanaAddress(input.inputMint) ||
    !isSolanaAddress(input.outputMint) ||
    typeof input.amount !== "string" ||
    !/^[1-9][0-9]*$/.test(input.amount) ||
    !isSolanaAddress(input.taker) ||
    !Number.isInteger(slippageBps) ||
    slippageBps < 1 ||
    slippageBps > 500
  ) {
    return NextResponse.json({ error: "Invalid Jupiter swap parameters." }, { status: 400 });
  }
  const result = await callJupiterOrder({
    inputMint: input.inputMint,
    outputMint: input.outputMint,
    amount: input.amount,
    taker: input.taker,
    slippageBps,
  });
  return NextResponse.json(result.payload, { status: result.status });
}

import { NextResponse } from "next/server";
import { isAddress, zeroAddress } from "viem";

import { isUniswapSwapChainId } from "@/lib/portal/uniswap";
import { callUniswapApi } from "@/lib/server/uniswap";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid approval request." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (input.token === zeroAddress) {
    return NextResponse.json({ requestId: null, approval: null, cancel: null });
  }
  if (
    !isUniswapSwapChainId(input.chainId) ||
    typeof input.token !== "string" ||
    !isAddress(input.token) ||
    typeof input.tokenOut !== "string" ||
    !(input.tokenOut === zeroAddress || isAddress(input.tokenOut)) ||
    typeof input.amount !== "string" ||
    !/^[1-9][0-9]*$/.test(input.amount) ||
    typeof input.walletAddress !== "string" ||
    !isAddress(input.walletAddress)
  ) {
    return NextResponse.json({ error: "Invalid approval parameters." }, { status: 400 });
  }
  const result = await callUniswapApi("/check_approval", {
    walletAddress: input.walletAddress,
    token: input.token,
    tokenOut: input.tokenOut,
    amount: input.amount,
    chainId: input.chainId,
    tokenOutChainId: input.chainId,
    urgency: "normal",
    includeGasInfo: true,
  });
  return NextResponse.json(result.payload, { status: result.status });
}

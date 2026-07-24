import { NextResponse } from "next/server";
import { isAddress, zeroAddress } from "viem";

import { isUniswapSwapChainId } from "@/lib/portal/uniswap";
import { callUniswapApi, readUniswapIntegratorFee } from "@/lib/server/uniswap";

export const runtime = "nodejs";

function isToken(value: unknown): value is string {
  return typeof value === "string" && (value === zeroAddress || isAddress(value));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid quote request." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const chainId = input.chainId;
  const amount = input.amount;
  const slippage = input.slippageTolerance === undefined ? 0.5 : Number(input.slippageTolerance);
  if (
    !isUniswapSwapChainId(chainId) ||
    !isToken(input.tokenIn) ||
    !isToken(input.tokenOut) ||
    input.tokenIn.toLowerCase() === input.tokenOut.toLowerCase() ||
    typeof amount !== "string" ||
    !/^[1-9][0-9]*$/.test(amount) ||
    typeof input.swapper !== "string" ||
    !isAddress(input.swapper) ||
    !Number.isFinite(slippage) ||
    slippage < 0.01 ||
    slippage > 5
  ) {
    return NextResponse.json({ error: "Invalid quote parameters." }, { status: 400 });
  }

  let fee: ReturnType<typeof readUniswapIntegratorFee>;
  try {
    fee = readUniswapIntegratorFee();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid Uniswap fee configuration." },
      { status: 503 }
    );
  }

  const result = await callUniswapApi("/quote", {
    type: "EXACT_INPUT",
    tokenInChainId: String(chainId),
    tokenOutChainId: String(chainId),
    tokenIn: input.tokenIn,
    tokenOut: input.tokenOut,
    amount,
    swapper: input.swapper,
    slippageTolerance: slippage,
    routingPreference: "BEST_PRICE",
    urgency: "normal",
    protocols: ["V2", "V3", "V4"],
    ...fee,
  });
  return NextResponse.json(result.payload, { status: result.status });
}

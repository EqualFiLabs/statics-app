import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { isAddress } from "viem";

import { ACROSS_SOLANA_CHAIN_ID, readAcrossDestination } from "@/lib/portal/across";
import { callAcross } from "@/lib/server/across";

export const runtime = "nodejs";

function isSolanaAddress(value: unknown) {
  if (typeof value !== "string") return false;
  try {
    return new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}

function tokensFrom(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { tokens?: unknown }).tokens)
  ) {
    return (payload as { tokens: unknown[] }).tokens;
  }
  return [];
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const originChainId = Number(body.originChainId);
  const destination = readAcrossDestination();
  const originIsSolana = originChainId === ACROSS_SOLANA_CHAIN_ID;
  const inputToken = typeof body.inputToken === "string" ? body.inputToken : "";
  const amount = typeof body.amount === "string" ? body.amount : "";
  const depositor = typeof body.depositor === "string" ? body.depositor : "";
  const recipient = typeof body.recipient === "string" ? body.recipient : "";
  if (
    destination.status !== "configured" ||
    !Number.isSafeInteger(originChainId) ||
    originChainId <= 0 ||
    originChainId === destination.chainId ||
    !inputToken ||
    !/^[1-9][0-9]*$/.test(amount) ||
    !(originIsSolana ? isSolanaAddress(depositor) : isAddress(depositor)) ||
    !isAddress(recipient)
  ) {
    return NextResponse.json(
      {
        error:
          destination.status === "configured"
            ? "Invalid Across quote parameters."
            : "A verified Robinhood USDG deployment is required for bridge quotes.",
      },
      { status: destination.status === "configured" ? 400 : 409 }
    );
  }

  const supportedTokens = await callAcross("/swap/tokens", {
    chainId: String(originChainId),
  });
  if (!supportedTokens.ok) {
    return NextResponse.json(supportedTokens.payload, { status: supportedTokens.status });
  }
  const inputIsSupported = tokensFrom(supportedTokens.payload).some((item) => {
    if (!item || typeof item !== "object") return false;
    const token = item as Record<string, unknown>;
    return (
      Number(token.chainId) === originChainId &&
      typeof token.address === "string" &&
      token.address.toLowerCase() === inputToken.toLowerCase()
    );
  });
  if (!inputIsSupported) {
    return NextResponse.json(
      { error: "Across does not support this origin token." },
      { status: 400 }
    );
  }

  const result = await callAcross("/swap/approval", {
    tradeType: "exactInput",
    originChainId: String(originChainId),
    destinationChainId: String(destination.chainId),
    inputToken,
    outputToken: destination.token,
    amount,
    depositor,
    recipient,
    refundAddress: depositor,
    refundOnOrigin: "true",
  });
  return NextResponse.json(
    result.ok
      ? {
          quote: result.payload,
          destination: {
            chainId: destination.chainId,
            token: destination.token,
            symbol: destination.symbol,
            decimals: destination.decimals,
          },
        }
      : result.payload,
    { status: result.status }
  );
}

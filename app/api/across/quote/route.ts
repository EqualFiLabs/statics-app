import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { isAddress } from "viem";

import { ACROSS_SOLANA_CHAIN_ID, readAcrossDestination } from "@/lib/portal/across";
import { MAX_PORTAL_SLIPPAGE_PERCENT, MIN_PORTAL_SLIPPAGE_PERCENT } from "@/lib/portal/slippage";
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

/**
 * Solana and EVM disagree about what an address is, so the check has to follow
 * the chain rather than the field name. Validating the recipient as EVM would
 * silently reject every bridge whose destination is Solana.
 */
function addressValidForChain(value: string, chainId: number) {
  return chainId === ACROSS_SOLANA_CHAIN_ID ? isSolanaAddress(value) : isAddress(value);
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

type ResolvedToken = { address: string; symbol: string; decimals: number };

/**
 * Confirms Across actually routes a token on a chain, and returns what Across
 * says the token is.
 *
 * The symbol and decimals come back from here rather than from the request, so
 * a caller cannot mislabel the destination asset in the quote it is shown.
 */
function findToken(payload: unknown, chainId: number, address: string): ResolvedToken | null {
  for (const item of tokensFrom(payload)) {
    if (!item || typeof item !== "object") continue;
    const token = item as Record<string, unknown>;
    if (
      Number(token.chainId) !== chainId ||
      typeof token.address !== "string" ||
      token.address.toLowerCase() !== address.toLowerCase() ||
      typeof token.symbol !== "string" ||
      !Number.isInteger(token.decimals)
    ) {
      continue;
    }
    return { address: token.address, symbol: token.symbol, decimals: Number(token.decimals) };
  }
  return null;
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const originChainId = Number(body.originChainId);
  const inputToken = typeof body.inputToken === "string" ? body.inputToken : "";
  const amount = typeof body.amount === "string" ? body.amount : "";
  const depositor = typeof body.depositor === "string" ? body.depositor : "";
  const recipient = typeof body.recipient === "string" ? body.recipient : "";

  // The Statics deployment stays the default destination, so a caller sending
  // neither field still gets the bridge that existed before this route accepted
  // a destination at all.
  const fallback = readAcrossDestination();
  const destinationChainId =
    body.destinationChainId === undefined
      ? fallback.status === "configured"
        ? fallback.chainId
        : Number.NaN
      : Number(body.destinationChainId);
  const outputToken =
    typeof body.outputToken === "string"
      ? body.outputToken
      : fallback.status === "configured"
        ? fallback.token
        : "";

  const slippage = body.slippage === undefined ? undefined : Number(body.slippage);
  if (
    slippage !== undefined &&
    (!Number.isFinite(slippage) ||
      slippage < MIN_PORTAL_SLIPPAGE_PERCENT ||
      slippage > MAX_PORTAL_SLIPPAGE_PERCENT)
  ) {
    return NextResponse.json({ error: "Invalid slippage tolerance." }, { status: 400 });
  }

  if (
    !Number.isSafeInteger(originChainId) ||
    originChainId <= 0 ||
    !Number.isSafeInteger(destinationChainId) ||
    destinationChainId <= 0 ||
    originChainId === destinationChainId ||
    !inputToken ||
    !outputToken ||
    !/^[1-9][0-9]*$/.test(amount) ||
    !addressValidForChain(depositor, originChainId) ||
    !addressValidForChain(recipient, destinationChainId)
  ) {
    return NextResponse.json({ error: "Invalid Across quote parameters." }, { status: 400 });
  }

  const [originTokens, destinationTokens] = await Promise.all([
    callAcross("/swap/tokens", { chainId: String(originChainId) }),
    callAcross("/swap/tokens", { chainId: String(destinationChainId) }),
  ]);
  if (!originTokens.ok) {
    return NextResponse.json(originTokens.payload, { status: originTokens.status });
  }
  if (!destinationTokens.ok) {
    return NextResponse.json(destinationTokens.payload, { status: destinationTokens.status });
  }

  if (!findToken(originTokens.payload, originChainId, inputToken)) {
    return NextResponse.json(
      { error: "Across does not support this origin token." },
      { status: 400 }
    );
  }
  const resolvedOutput = findToken(destinationTokens.payload, destinationChainId, outputToken);
  if (!resolvedOutput) {
    return NextResponse.json(
      { error: "Across does not support this destination token." },
      { status: 400 }
    );
  }

  const result = await callAcross("/swap/approval", {
    tradeType: "exactInput",
    originChainId: String(originChainId),
    destinationChainId: String(destinationChainId),
    inputToken,
    outputToken: resolvedOutput.address,
    amount,
    depositor,
    recipient,
    refundAddress: depositor,
    refundOnOrigin: "true",
    ...(slippage === undefined ? {} : { slippage: String(slippage) }),
  });
  return NextResponse.json(
    result.ok
      ? {
          quote: result.payload,
          destination: {
            chainId: destinationChainId,
            token: resolvedOutput.address,
            symbol: resolvedOutput.symbol,
            decimals: resolvedOutput.decimals,
          },
        }
      : result.payload,
    { status: result.status }
  );
}

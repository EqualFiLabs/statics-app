import { NextResponse } from "next/server";

import { robinhoodRpcUrl } from "@/lib/server/robinhood-rpc";

export const runtime = "nodejs";

const READ_METHODS = new Set([
  "eth_blobBaseFee",
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_estimateGas",
  "eth_feeHistory",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByHash",
  "eth_getBlockByNumber",
  "eth_getBlockReceipts",
  "eth_getBlockTransactionCountByHash",
  "eth_getBlockTransactionCountByNumber",
  "eth_getCode",
  "eth_getLogs",
  "eth_getProof",
  "eth_getStorageAt",
  "eth_getTransactionByBlockHashAndIndex",
  "eth_getTransactionByBlockNumberAndIndex",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_maxPriorityFeePerGas",
  "eth_syncing",
  "net_version",
  "web3_clientVersion",
]);

function isReadRequest(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    READ_METHODS.has((value as { method?: unknown }).method as string)
  );
}

export async function POST(request: Request, context: { params: Promise<{ chainId: string }> }) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json(
          { error: "Cross-origin RPC access is not allowed." },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
  }
  const { chainId: rawChainId } = await context.params;
  const chainId = Number(rawChainId);
  if (!Number.isSafeInteger(chainId)) {
    return NextResponse.json({ error: "Invalid chain id." }, { status: 400 });
  }

  let upstream: string;
  try {
    upstream = robinhoodRpcUrl(chainId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "RPC proxy is not configured." },
      { status: 503 }
    );
  }

  const body = await request.text();
  if (!body || body.length > 2_000_000) {
    return NextResponse.json({ error: "Invalid or oversized JSON-RPC request." }, { status: 400 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON-RPC request." }, { status: 400 });
  }
  const requests = Array.isArray(payload) ? payload : [payload];
  if (requests.length === 0 || requests.length > 50 || !requests.every(isReadRequest)) {
    return NextResponse.json(
      { error: "Only bounded, read-only JSON-RPC requests are allowed." },
      { status: 403 }
    );
  }

  try {
    const response = await fetch(upstream, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body,
      cache: "no-store",
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json(
      { error: "The Robinhood RPC upstream is unavailable." },
      { status: 502 }
    );
  }
}

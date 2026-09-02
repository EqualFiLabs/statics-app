import { NextResponse } from "next/server";
import { parseTransaction, recoverTransactionAddress, type TransactionSerialized } from "viem";

import { isRobinhoodReadRequest } from "@/lib/server/robinhood-rpc-methods";
import { robinhoodWalletRpcUrl } from "@/lib/server/robinhood-rpc";

export const runtime = "nodejs";

type RpcRequest = Readonly<{
  method?: unknown;
  params?: unknown;
}>;

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function rawTransactionFrom(value: unknown): TransactionSerialized | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const request = value as RpcRequest;
  if (request.method !== "eth_sendRawTransaction" || !Array.isArray(request.params)) return null;
  if (request.params.length !== 1) return null;
  const raw = request.params[0];
  return typeof raw === "string" && /^0x[0-9a-fA-F]+$/.test(raw)
    ? (raw as TransactionSerialized)
    : null;
}

async function validSignedTransaction(
  raw: TransactionSerialized,
  chainId: number
): Promise<boolean> {
  try {
    const transaction = parseTransaction(raw);
    if (transaction.chainId !== chainId) return false;
    await recoverTransactionAddress({ serializedTransaction: raw });
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request, context: { params: Promise<{ chainId: string }> }) {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { error: "Wallet RPC access requires the same application origin." },
      { status: 403 }
    );
  }

  const { chainId: rawChainId } = await context.params;
  const chainId = Number(rawChainId);
  if (!Number.isSafeInteger(chainId)) {
    return NextResponse.json({ error: "Invalid chain id." }, { status: 400 });
  }

  let upstream: string;
  try {
    upstream = robinhoodWalletRpcUrl(chainId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Wallet RPC proxy is not configured." },
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
  if (requests.length === 0 || requests.length > 50) {
    return NextResponse.json({ error: "Invalid JSON-RPC request batch." }, { status: 400 });
  }

  const rawTransaction = requests.length === 1 ? rawTransactionFrom(requests[0]) : null;
  const readOnlyBatch = requests.every(isRobinhoodReadRequest);
  if (!readOnlyBatch && !rawTransaction) {
    return NextResponse.json(
      { error: "Only bounded wallet preparation reads and one signed transaction are allowed." },
      { status: 403 }
    );
  }
  if (rawTransaction && !(await validSignedTransaction(rawTransaction, chainId))) {
    return NextResponse.json(
      { error: "The signed transaction is invalid or targets a different chain." },
      { status: 400 }
    );
  }

  const methods = [
    ...new Set(requests.map((entry) => (entry as { method: string }).method)),
  ].sort();
  const startedAt = Date.now();
  try {
    const response = await fetch(upstream, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body,
      cache: "no-store",
    });
    const retryAfter = response.headers.get("retry-after");
    if (!response.ok) {
      console.warn("Robinhood wallet RPC upstream request failed", {
        batchSize: requests.length,
        chainId,
        durationMs: Date.now() - startedAt,
        methods,
        retryAfter: Boolean(retryAfter),
        status: response.status,
      });
    }
    const headers = new Headers({
      "cache-control": "no-store",
      "content-type": response.headers.get("content-type") ?? "application/json",
    });
    if (retryAfter) headers.set("retry-after", retryAfter);
    return new Response(await response.text(), {
      status: response.status,
      headers,
    });
  } catch {
    console.warn("Robinhood wallet RPC upstream request failed", {
      batchSize: requests.length,
      chainId,
      durationMs: Date.now() - startedAt,
      methods,
      retryAfter: false,
      status: 502,
    });
    return NextResponse.json(
      { error: "The Robinhood wallet RPC upstream is unavailable." },
      { status: 502 }
    );
  }
}

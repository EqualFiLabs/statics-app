import { NextResponse } from "next/server";

import { isRobinhoodReadRequest } from "@/lib/server/robinhood-rpc-methods";
import { robinhoodRpcUrl } from "@/lib/server/robinhood-rpc";

export const runtime = "nodejs";

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
  if (requests.length === 0 || requests.length > 50 || !requests.every(isRobinhoodReadRequest)) {
    return NextResponse.json(
      { error: "Only bounded, read-only JSON-RPC requests are allowed." },
      { status: 403 }
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
      console.warn("Robinhood RPC upstream request failed", {
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
    console.warn("Robinhood RPC upstream request failed", {
      batchSize: requests.length,
      chainId,
      durationMs: Date.now() - startedAt,
      methods,
      retryAfter: false,
      status: 502,
    });
    return NextResponse.json(
      { error: "The Robinhood RPC upstream is unavailable." },
      { status: 502 }
    );
  }
}

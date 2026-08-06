import { NextResponse } from "next/server";
import { isAddress } from "viem";

import {
  eveBridgeRpcUrl,
  resolveEveLayerZeroStatus,
  verifyEveDelivery,
} from "@/lib/server/eve-bridge";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const txHash = params.get("txHash")?.trim() ?? "";
  const originChainId = Number(params.get("originChainId"));
  const destinationChainId = Number(params.get("destinationChainId"));
  const recipient = params.get("recipient")?.trim() ?? "";
  const rawAmount = params.get("amountRaw")?.trim() ?? "";
  if (
    !/^0x[0-9a-fA-F]{64}$/.test(txHash) ||
    !Number.isSafeInteger(originChainId) ||
    !Number.isSafeInteger(destinationChainId) ||
    !isAddress(recipient) ||
    !/^[1-9][0-9]*$/.test(rawAmount)
  ) {
    return NextResponse.json({ error: "Invalid LayerZero status parameters." }, { status: 400 });
  }

  const response = await fetch(`https://scan.layerzero-api.com/v1/messages/tx/${txHash}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json(
      { error: "LayerZero status is temporarily unavailable." },
      { status: 502 }
    );
  }
  const status = resolveEveLayerZeroStatus(payload, { originChainId, destinationChainId });
  if (!status) return NextResponse.json({ status: "submitted" });
  if (status.status !== "filled" || !status.guid || !status.destinationTxnRef) {
    return NextResponse.json(status);
  }

  const rpcUrl = eveBridgeRpcUrl(destinationChainId);
  if (!rpcUrl) {
    return NextResponse.json({
      ...status,
      status: "received",
      error: "Delivery was reported, but its destination receipt could not be verified.",
    });
  }
  const verified = await verifyEveDelivery({
    originChainId,
    destinationChainId,
    destinationTxnRef: status.destinationTxnRef,
    guid: status.guid,
    recipient,
    amountRaw: BigInt(rawAmount),
    rpcUrl,
  }).catch(() => false);
  return verified
    ? NextResponse.json(status)
    : NextResponse.json({
        ...status,
        status: "received",
        error: "The destination transaction was found, but its EVE receipt is not verified yet.",
      });
}

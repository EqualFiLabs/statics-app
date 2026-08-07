import { decodeEventLog, getAddress, isAddress, type Hex } from "viem";

import {
  eveOftAbi,
  getEveBridgeDeployment,
  getEveBridgeDestination,
} from "@/lib/portal/eve-bridge";

export type EveLayerZeroStatus = Readonly<{
  status: "pending" | "received" | "filled" | "attention";
  guid?: Hex;
  destinationTxnRef?: Hex;
  error?: string;
}>;

const layerZeroStatusPrecedence: Readonly<Record<EveLayerZeroStatus["status"], number>> = {
  pending: 0,
  received: 1,
  attention: 2,
  filled: 3,
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function transactionHash(value: unknown): Hex | undefined {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value)
    ? (value as Hex)
    : undefined;
}

export function resolveEveLayerZeroStatus(
  payload: unknown,
  expected: { originChainId: number; destinationChainId: number }
): EveLayerZeroStatus | null {
  const origin = getEveBridgeDeployment(expected.originChainId);
  const destination = getEveBridgeDestination(expected.originChainId, expected.destinationChainId);
  if (!origin || !destination) return null;
  const rows = record(payload)?.data;
  if (!Array.isArray(rows)) return null;
  let bestMatch: EveLayerZeroStatus | null = null;

  for (const value of rows) {
    const message = record(value);
    const pathway = record(message?.pathway);
    const sender = record(pathway?.sender);
    const receiver = record(pathway?.receiver);
    if (
      Number(pathway?.srcEid) !== origin.eid ||
      Number(pathway?.dstEid) !== destination.eid ||
      typeof sender?.address !== "string" ||
      sender.address.toLowerCase() !== origin.bridgeAddress.toLowerCase() ||
      typeof receiver?.address !== "string" ||
      receiver.address.toLowerCase() !== destination.bridgeAddress.toLowerCase()
    ) {
      continue;
    }

    const statusName = String(record(message?.status)?.name ?? "").toUpperCase();
    const destinationState = String(record(message?.destination)?.status ?? "").toUpperCase();
    const destinationTx = transactionHash(record(record(message?.destination)?.tx)?.txHash);
    const guid = transactionHash(message?.guid);
    let candidate: EveLayerZeroStatus;
    if (statusName === "DELIVERED" && destinationState === "SUCCEEDED" && destinationTx) {
      candidate = { status: "filled", ...(guid ? { guid } : {}), destinationTxnRef: destinationTx };
    } else if (statusName === "CONFIRMING") {
      candidate = {
        status: "received",
        ...(guid ? { guid } : {}),
        ...(destinationTx ? { destinationTxnRef: destinationTx } : {}),
      };
    } else if (
      ["FAILED", "BLOCKED", "PAYLOAD_STORED", "APPLICATION_BURNED", "APPLICATION_SKIPPED"].includes(
        statusName
      )
    ) {
      candidate = {
        status: "attention",
        ...(guid ? { guid } : {}),
        ...(destinationTx ? { destinationTxnRef: destinationTx } : {}),
        error: String(record(message?.status)?.message ?? "LayerZero delivery needs attention."),
      };
    } else {
      candidate = { status: "pending", ...(guid ? { guid } : {}) };
    }
    if (
      !bestMatch ||
      layerZeroStatusPrecedence[candidate.status] > layerZeroStatusPrecedence[bestMatch.status]
    ) {
      bestMatch = candidate;
    }
  }
  return bestMatch;
}

function parseRpcUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function eveBridgeRpcUrl(
  chainId: number,
  environment: Record<string, string | undefined> = process.env
): string | null {
  return parseRpcUrl(
    chainId === 8_453
      ? environment.EVE_BASE_RPC_URL
      : chainId === 4_663
        ? environment.EVE_ROBINHOOD_RPC_URL
        : undefined
  );
}

export async function verifyEveDelivery(
  input: {
    originChainId: number;
    destinationChainId: number;
    destinationTxnRef: Hex;
    guid: Hex;
    recipient: string;
    amountRaw: bigint;
    rpcUrl: string;
  },
  fetcher: typeof fetch = fetch
): Promise<boolean> {
  if (!isAddress(input.recipient)) return false;
  const origin = getEveBridgeDeployment(input.originChainId);
  const destination = getEveBridgeDestination(input.originChainId, input.destinationChainId);
  if (!origin || !destination) return false;
  const response = await fetcher(input.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionReceipt",
      params: [input.destinationTxnRef],
    }),
  });
  const payload: unknown = await response.json().catch(() => null);
  const receipt = record(record(payload)?.result);
  if (!response.ok || receipt?.status !== "0x1" || !Array.isArray(receipt.logs)) return false;

  return receipt.logs.some((value) => {
    const log = record(value);
    if (
      typeof log?.address !== "string" ||
      log.address.toLowerCase() !== destination.bridgeAddress.toLowerCase() ||
      typeof log.data !== "string" ||
      !Array.isArray(log.topics)
    ) {
      return false;
    }
    try {
      const decoded = decodeEventLog({
        abi: eveOftAbi,
        eventName: "OFTReceived",
        data: log.data as Hex,
        topics: log.topics as [Hex, ...Hex[]],
      });
      return (
        decoded.args.guid.toLowerCase() === input.guid.toLowerCase() &&
        decoded.args.srcEid === origin.eid &&
        getAddress(decoded.args.toAddress) === getAddress(input.recipient) &&
        decoded.args.amountReceivedLD === input.amountRaw
      );
    } catch {
      return false;
    }
  });
}

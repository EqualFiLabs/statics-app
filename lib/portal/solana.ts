import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export function isSolanaAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}

export function decodeJupiterTransaction(value: unknown): Uint8Array {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/=_-]+$/.test(value)) {
    throw new Error("Jupiter returned an invalid transaction.");
  }
  const bytes = Buffer.from(value, "base64");
  VersionedTransaction.deserialize(bytes);
  return bytes;
}

export function encodeJupiterTransaction(value: Uint8Array): string {
  return Buffer.from(value).toString("base64");
}

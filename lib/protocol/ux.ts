import { getAddress, isAddress, zeroAddress, type Address } from "viem";

export const BPS_SCALE = 10_000n;
export const AMOUNT_SHORTCUTS = [25, 50, 75, 100] as const;

export function applyPercent(value: bigint, percent: number): bigint {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new Error("Percentage must be a whole number from 0 to 100.");
  }
  return (value * BigInt(percent)) / 100n;
}

export function percentInputToBps(input: string, maximumPercent = 100): number | null {
  const trimmed = input.trim();
  if (!/^\d*(?:\.\d{0,2})?$/.test(trimmed) || !trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > maximumPercent) return null;
  return Math.round(value * 100);
}

export function bpsToPercentInput(bps: number): string {
  return (bps / 100).toString();
}

export function parseRecipientAddress(input: string, rejectZero = true): Address | null {
  if (!isAddress(input, { strict: false })) return null;
  const address = getAddress(input);
  return rejectZero && address === zeroAddress ? null : address;
}

export function formatTokenAmount(value: bigint, decimals: number, fractionDigits = 6): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const whole = absolute / scale;
  const remainder = absolute % scale;
  const fraction = remainder
    .toString()
    .padStart(decimals, "0")
    .slice(0, fractionDigits)
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${fraction ? `.${fraction}` : ""}`;
}

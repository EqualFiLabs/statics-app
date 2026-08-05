export function encodeCursor(id: bigint): string {
  return Buffer.from(id.toString()).toString("base64url");
}

export function decodeCursor(value: string | undefined): bigint | null {
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    return /^\d+$/.test(decoded) ? BigInt(decoded) : null;
  } catch {
    return null;
  }
}

export function readLimit(value: string | undefined): number {
  if (!value) return 100;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit > 0 && limit <= 100 ? limit : 0;
}

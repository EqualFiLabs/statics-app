import type { Abi } from "viem";

/** Identical SDK fragments must not make Ponder register duplicate event signatures. */
export function uniqueAbi<T extends Abi>(abi: T): T {
  const seen = new Set<string>();
  return abi.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }) as unknown as T;
}

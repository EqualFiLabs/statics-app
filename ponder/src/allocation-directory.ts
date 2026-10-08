import { encodeAbiParameters, getAddress, keccak256, stringToHex, zeroHash, type Hex } from "viem";

export const eligibilityDomain = keccak256(stringToHex("statics.gauge.eligibility.version.v1"));
export function allocationVersion(poolId: Hex, nonce0: bigint, nonce1: bigint): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint64" }, { type: "uint64" }],
      [eligibilityDomain, poolId, nonce0, nonce1]
    )
  );
}
export type AllocationEligibilityReason =
  | "gauge-uninitialized"
  | "gauge-stopped"
  | "decommissioned"
  | "currency0-restricted"
  | "currency1-restricted";
export function allocationEligibility(
  pool: { gaugeInitialized: boolean; gaugeStopped: boolean; decommissioned: boolean },
  restricted0: boolean,
  restricted1: boolean
) {
  const reasons: AllocationEligibilityReason[] = [];
  if (!pool.gaugeInitialized) reasons.push("gauge-uninitialized");
  if (pool.gaugeStopped) reasons.push("gauge-stopped");
  if (pool.decommissioned) reasons.push("decommissioned");
  if (restricted0) reasons.push("currency0-restricted");
  if (restricted1) reasons.push("currency1-restricted");
  return { eligible: reasons.length === 0, reasons };
}
export function allocatorSchedule(
  stream: {
    eligibilityVersion: Hex;
    periodBudget: bigint;
    periodEmitted: bigint;
    periodFinish: bigint;
    lastUpdate: bigint;
    terminated: boolean;
  },
  currentVersion: Hex,
  weight: bigint
) {
  const remaining = stream.periodBudget - stream.periodEmitted;
  const duration =
    stream.periodFinish > stream.lastUpdate ? stream.periodFinish - stream.lastUpdate : 0n;
  const invalidated = currentVersion === zeroHash || currentVersion !== stream.eligibilityVersion;
  const funded = !stream.terminated && !invalidated && remaining > 0n && duration > 0n;
  const paused = funded && weight === 0n;
  return {
    funded,
    paused,
    invalidated,
    rateNumerator: funded ? remaining : 0n,
    rateDenominator: funded ? duration : 0n,
    nominalRatePerSecond: funded ? remaining / duration : 0n,
    ratePerSecond: funded && !paused ? remaining / duration : 0n,
  };
}
export function allocationTokenKey(chainId: number, asset: string): string {
  return `${chainId}:${getAddress(asset).toLowerCase()}`;
}
export function decimalJson(value: unknown): string {
  return JSON.stringify(value, (_, entry) =>
    typeof entry === "bigint" ? entry.toString() : entry
  );
}

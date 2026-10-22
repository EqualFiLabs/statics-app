/** USD reference metadata is distinct from indexed pool observations and trade timestamps. */
export type PriceReference = Readonly<{
  source: "robinhood" | "coinbase" | "kraken";
  asset: string;
  observedAt: number;
  fetchedAt: number;
  expiresAt: number;
  freshUntil?: number;
  stale: boolean;
  halted: boolean;
}>;
export type UsdReferenceSnapshot = Readonly<{
  asOf: number;
  prices: readonly Readonly<{
    address: string;
    decimals: number;
    valueWad: bigint;
    reference: PriceReference;
  }>[];
  /** Includes mapped stocks with missing/expired quotes; these cannot use pool fallback. */
  restricted: readonly string[];
  allowDerived: boolean;
}>;
// Provider cache refreshes are more frequent than the user-facing stale deadline.
export const REFERENCE_FRESH_MS = 120_000;
export function referenceStale(r: PriceReference, now = Date.now()) {
  return (
    r.stale ||
    now >=
      Math.min(r.freshUntil ?? Infinity, Math.min(r.fetchedAt, r.observedAt) + REFERENCE_FRESH_MS)
  );
}
export const USD_SCALE = 10n ** 18n;
export function positiveDecimal(value: unknown): bigint {
  if (typeof value !== "string" || !/^\d+(\.\d{1,18})?$/.test(value))
    throw new Error("Invalid USD reference decimal");
  const [whole, fraction = ""] = value.split(".");
  const result = BigInt(whole!) * USD_SCALE + BigInt(fraction.padEnd(18, "0"));
  if (result <= 0n) throw new Error("Non-positive USD reference");
  return result;
}
export function midpoint(bid: unknown, ask: unknown): bigint {
  const b = positiveDecimal(bid),
    a = positiveDecimal(ask);
  if (b > a) throw new Error("Crossed USD reference quote");
  return (b + a) / 2n;
}
export function combineReferences(...groups: (readonly PriceReference[] | undefined)[]) {
  return [
    ...new Map(groups.flatMap((g) => g ?? []).map((r) => [`${r.source}:${r.asset}`, r])).values(),
  ];
}
export function referenceUsable(
  references: readonly PriceReference[] | undefined,
  now = Date.now()
) {
  return !references?.some((r) => referenceStale(r, now) || r.halted || r.expiresAt <= now);
}
export function defaultMarketQuote(deploymentId: string): "usd" | "usdg" {
  return deploymentId === "robinhood-phase-one" ? "usd" : "usdg";
}

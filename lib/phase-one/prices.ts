import { getSqrtPriceAtTick } from "@statics-protocol/sdk/phase-one";
import { usableTickBounds } from "@/lib/phase-one/liquidity";

/** Prices are token1 per token0, fixed to 36 decimals. All comparisons use integers. */
export function priceToAlignedTick(
  price: bigint,
  decimals0: number,
  decimals1: number,
  spacing: number,
  boundary: "lower" | "upper"
): number {
  if (price <= 0n) throw new Error("Range prices must be greater than zero.");
  const [minimum, maximum] = usableTickBounds(spacing);
  const target = price * (1n << 192n) * 10n ** BigInt(decimals1);
  const scale = 10n ** BigInt(decimals0 + 36);
  const compare = (tick: number) => getSqrtPriceAtTick(tick) ** 2n * scale;
  if (target < compare(minimum) || target > compare(maximum))
    throw new Error("Price is outside this pool's supported range.");
  let low = minimum;
  let high = maximum;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (compare(middle) <= target) low = middle;
    else high = middle - 1;
  }
  const tick = boundary === "upper" && compare(low) < target ? low + 1 : low;
  return boundary === "lower"
    ? Math.floor(tick / spacing) * spacing
    : Math.ceil(tick / spacing) * spacing;
}

export function fractionalRewardAmount(remainderX160: bigint, decimals: number): string {
  const fraction = (remainderX160 * 10n ** 54n) / (1n << 160n);
  const scaled = fraction / 10n ** BigInt(decimals);
  return `0.${scaled.toString().padStart(54, "0").replace(/0+$/, "") || "0"}`;
}

export function tickPrice(tick: number, decimals0: number, decimals1: number): string {
  const price =
    (getSqrtPriceAtTick(tick) ** 2n * 10n ** BigInt(decimals0 + 36)) /
    ((1n << 192n) * 10n ** BigInt(decimals1));
  const whole = price / 10n ** 36n;
  const fraction = (price % 10n ** 36n).toString().padStart(36, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

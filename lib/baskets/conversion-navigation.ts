import type { PositionRecord } from "@/lib/positions/positions";

export type BasketConversionAction = "mint" | "redeem";
export type BasketConversionSelection = "wallet" | "new-position" | `position:${string}`;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function readBasketConversionAction(
  value: string | string[] | undefined
): BasketConversionAction {
  return firstValue(value) === "redeem" ? "redeem" : "mint";
}

export function readBasketPositionFocus(value: string | string[] | undefined): bigint | null {
  const candidate = firstValue(value);
  return candidate && /^\d+$/.test(candidate) ? BigInt(candidate) : null;
}

export function positionSelection(positionId: bigint): BasketConversionSelection {
  return `position:${positionId.toString()}`;
}

export function recommendedMintSelection(
  positions: readonly Pick<PositionRecord, "positionId">[]
): BasketConversionSelection {
  if (positions.length === 0) return "new-position";
  const highestPositionId = positions.reduce(
    (highest, position) => (position.positionId > highest ? position.positionId : highest),
    positions[0]!.positionId
  );
  return positionSelection(highestPositionId);
}

export function selectedPositionId(selection: BasketConversionSelection): bigint | null {
  if (!selection.startsWith("position:")) return null;
  return BigInt(selection.slice("position:".length));
}

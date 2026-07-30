export function readRewardPositionFocus(
  value: string | readonly string[] | undefined
): bigint | null {
  return typeof value === "string" && /^\d+$/.test(value) ? BigInt(value) : null;
}

export function focusRewardPositions<T extends { positionId: bigint }>(
  positions: readonly T[],
  positionId: bigint | null
): readonly T[] {
  if (positionId === null) return positions;
  const focused = positions.find((position) => position.positionId === positionId);
  return focused
    ? [focused, ...positions.filter((position) => position.positionId !== positionId)]
    : positions;
}

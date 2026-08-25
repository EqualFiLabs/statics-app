"use client";

import { formatTokenAmountGrouped } from "@/lib/protocol/ux";

/**
 * Mirrors GenesisActivationRegistry.multiplierForTier. Kept as a pure local
 * table rather than a contract read: it is `pure` onchain, five constant
 * values, and every rung of the ladder needs it at once.
 */
export const GENESIS_TIER_MULTIPLIER_BPS: readonly number[] = [
  10_000, 11_000, 11_500, 12_000, 12_500,
];

export const GENESIS_MAX_TIER = 4;

export function genesisTierMultiplier(tier: number): number {
  return (GENESIS_TIER_MULTIPLIER_BPS[tier] ?? 10_000) / 10_000;
}

/** Cumulative cost of moving from `currentTier` up to `targetTier`. */
export function cumulativeTierCost(
  tierCosts: readonly bigint[],
  currentTier: number,
  targetTier: number
): bigint {
  let total = 0n;
  for (let tier = currentTier + 1; tier <= targetTier; tier += 1) {
    total += tierCosts[tier] ?? 0n;
  }
  return total;
}

/**
 * The activation ladder, drawn in full.
 *
 * A <select> of remaining tiers hides the shape of the decision: the
 * multiplier curve flattens hard after Tier 1, so the last 0.05x costs
 * 40,000 STATICS. That is only weighable when every rung is visible at once.
 */
export function GenesisTierLadder({
  currentTier,
  targetTier,
  tierCosts,
  onSelect,
  disabled,
}: Readonly<{
  currentTier: number;
  targetTier: number;
  tierCosts: readonly bigint[];
  onSelect: (tier: number) => void;
  disabled: boolean;
}>) {
  return (
    <ol className="genesis-ladder" aria-label="Activation tiers">
      {Array.from({ length: GENESIS_MAX_TIER + 1 }, (_, tier) => {
        const reached = tier < currentTier;
        const isCurrent = tier === currentTier;
        const isTarget = tier === targetTier && tier > currentTier;
        const state = reached ? "reached" : isCurrent ? "current" : isTarget ? "target" : "ahead";
        const selectable = tier > currentTier && !disabled;
        return (
          <li key={tier}>
            <button
              className="genesis-ladder-rung"
              type="button"
              data-state={state}
              disabled={!selectable}
              aria-current={isCurrent ? "step" : undefined}
              onClick={() => onSelect(tier)}
            >
              <span className="genesis-ladder-tier">Tier {tier}</span>
              <span className="genesis-ladder-multiplier">
                {genesisTierMultiplier(tier).toFixed(2)}× reward weight
              </span>
              <span className="genesis-ladder-cost">
                {tier === 0
                  ? "—"
                  : `${formatTokenAmountGrouped(tierCosts[tier] ?? 0n, 18, 0)} STATICS`}
              </span>
              <span className="genesis-ladder-mark">
                {reached ? "Reached" : isCurrent ? "You are here" : isTarget ? "Target" : ""}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

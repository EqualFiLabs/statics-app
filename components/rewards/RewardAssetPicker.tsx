"use client";

import { useState } from "react";
import type { Address } from "viem";

import type { TokenMetadata } from "@/lib/baskets/baskets";
import { VISIBLE_REWARD_CANDIDATES, rankRewardCandidates } from "@/lib/positions/staking";

export type RewardCandidateOption = Readonly<{
  token: TokenMetadata;
  sources: readonly string[];
}>;

/**
 * Asks what someone wants to be paid in.
 *
 * A deployment can offer up to 64 reward assets, and presenting them as 64
 * equal checkboxes stalls anyone who just wants more of one thing. So the list
 * is ranked by evidence that an asset actually pays, truncated, and the rest
 * put behind a disclosure.
 *
 * The no-backfill rule is stated here rather than anywhere else, because this
 * is the moment it applies: selecting an asset earns from now, and nobody will
 * guess that unprompted.
 */
export function RewardAssetPicker({
  candidates,
  selected,
  maximum,
  disabled = false,
  onToggle,
}: Readonly<{
  candidates: readonly RewardCandidateOption[];
  selected: readonly Address[];
  maximum: bigint;
  disabled?: boolean;
  onToggle: (asset: Address) => void;
}>) {
  const [showAll, setShowAll] = useState(false);

  const ranked = rankRewardCandidates(candidates);
  const visible = showAll ? ranked : ranked.slice(0, VISIBLE_REWARD_CANDIDATES);
  const hasMore = candidates.length > VISIBLE_REWARD_CANDIDATES;

  return (
    <fieldset className="reward-selector" disabled={disabled}>
      <legend>
        What do you want to earn?{" "}
        <small>
          {selected.length} of {maximum.toString()} chosen
        </small>
      </legend>
      <p className="reward-selector-note">
        You are paid in whichever assets you pick. Each one starts earning about a day after you
        choose it, and only from that point on — choosing an asset later does not earn you a share
        of fees collected before then.
      </p>
      {visible.map((candidate) => {
        const isSelected = selected.includes(candidate.token.address);
        return (
          <label key={candidate.token.address}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggle(candidate.token.address)}
            />
            <span>
              <strong>{candidate.token.symbol}</strong>
              {candidate.sources.join(" · ")}
            </span>
          </label>
        );
      })}
      {hasMore && (
        <button
          className="reward-selector-more"
          type="button"
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll ? "Show fewer" : `Show all ${candidates.length} assets`}
        </button>
      )}
    </fieldset>
  );
}

"use client";

import { formatUnits, type Address } from "viem";
import { useTranslations } from "next-intl";

import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import type { PositionReward, RewardCandidate } from "@/lib/positions/positions";

function displayAmount(value: bigint, decimals: number, precision = 6): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const shortFraction = fraction.slice(0, precision).replace(/0+$/, "");
  return shortFraction ? `${whole}.${shortFraction}` : whole;
}

export function RewardSelectionEditor({
  candidates,
  confirmed,
  selected,
  rewards,
  maximum,
  chainId,
  changeCount,
  disabled,
  saving,
  onToggle,
  onSave,
}: Readonly<{
  candidates: readonly RewardCandidate[];
  confirmed: readonly Address[];
  selected: readonly Address[];
  rewards: readonly PositionReward[];
  maximum: bigint;
  chainId: number;
  changeCount: number;
  disabled: boolean;
  saving: boolean;
  onToggle: (asset: Address) => void;
  onSave: () => void;
}>) {
  const t = useTranslations("positionDetail");

  return (
    <>
      <div className="position-section-heading">
        <div>
          <p className="dapp-section-label">{t("selectedRewards")}</p>
          <h3>{t("chooseAssets", { count: maximum.toString() })}</h3>
        </div>
        <div className="reward-selection-actions">
          <span>{t("selectedCount", { count: selected.length })}</span>
          <button
            className="dollar-submit"
            type="button"
            disabled={disabled || changeCount === 0}
            onClick={onSave}
          >
            {saving ? t("savingSelections") : t("saveSelections", { count: changeCount })}
          </button>
        </div>
      </div>
      <div className="reward-grid">
        {candidates.map((candidate) => {
          const isSelected = selected.includes(candidate.token.address);
          const isConfirmed = confirmed.includes(candidate.token.address);
          const changed = isSelected !== isConfirmed;
          const reward = rewards.find((item) => item.token.address === candidate.token.address);
          return (
            <article
              key={candidate.token.address}
              className={[isSelected ? "is-selected" : "", changed ? "is-changed" : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <div>
                <strong>{candidate.token.symbol}</strong>
                <span>{candidate.sources.join(" · ")}</span>
                {changed && (
                  <small className="reward-selection-change">
                    {isSelected ? t("pendingSelection") : t("pendingRemoval")}
                  </small>
                )}
              </div>
              <AddressDisplay
                address={candidate.token.address}
                chainId={chainId}
                label={t("token")}
              />
              <p>
                Pending: {displayAmount(reward?.pending ?? 0n, candidate.token.decimals)}{" "}
                {candidate.token.symbol}
              </p>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggle(candidate.token.address)}
              >
                {isSelected ? t("removeSelection") : t("selectReward")}
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}

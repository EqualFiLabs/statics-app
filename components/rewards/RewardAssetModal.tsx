"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Address } from "viem";
import { TokenLogo } from "@/components/wallet/TokenLogo";
import { formatDuration } from "@/lib/rewards/time";
import { ReviewDrawer } from "./ReviewDrawer";
import styles from "./earn.module.css";

export type RewardAssetOption = Readonly<{ address: Address; symbol: string; name: string }>;

/**
 * Pick the reward assets one position earns in. Nothing is sent from here: OK hands the
 * chosen set back, and the caller either stages it or opens a transaction review.
 */
export function RewardAssetModal({
  title,
  options,
  initial,
  maximum,
  maturity,
  now,
  onCancel,
  onConfirm,
}: {
  title: string;
  options: readonly RewardAssetOption[];
  initial: readonly Address[];
  maximum: bigint | undefined;
  /** Start time for assets still in the eligibility delay, keyed by lowercase address. */
  maturity?: Readonly<Record<string, bigint>>;
  now: bigint | undefined;
  onCancel: () => void;
  onConfirm: (assets: readonly Address[]) => void;
}) {
  const t = useTranslations("earnAssets");
  const [selected, setSelected] = useState<readonly Address[]>(initial);
  const [query, setQuery] = useState("");
  // Search only narrows what is shown; selections hidden by a search are kept.
  const text = query.trim().toLowerCase();
  const shown = text
    ? options.filter(
        (option) =>
          option.name.toLowerCase().includes(text) ||
          option.symbol.toLowerCase().includes(text) ||
          option.address.toLowerCase() === text
      )
    : options;
  const has = (asset: Address) =>
    selected.some((entry) => entry.toLowerCase() === asset.toLowerCase());
  const atLimit = maximum !== undefined && BigInt(selected.length) >= maximum;
  const toggle = (asset: Address) =>
    setSelected(
      has(asset)
        ? selected.filter((entry) => entry.toLowerCase() !== asset.toLowerCase())
        : [...selected, asset]
    );
  return (
    <ReviewDrawer title={title} onClose={onCancel} variant="modal">
      <p className={styles.muted}>{t("help")}</p>
      <label className={styles.assetSearch}>
        <span className={styles.srOnly}>{t("search")}</span>
        <input
          type="search"
          value={query}
          placeholder={t("searchPlaceholder")}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ul className={styles.assetList} aria-label={t("list")}>
        {shown.length === 0 && <li className={styles.cellMeta}>{t("noMatches")}</li>}
        {shown.map((option) => {
          const checked = has(option.address);
          const startsAt = maturity?.[option.address.toLowerCase()];
          return (
            <li key={option.address}>
              <label className={styles.assetRow} data-checked={checked}>
                <input
                  type="checkbox"
                  className={styles.selectionDot}
                  checked={checked}
                  disabled={!checked && atLimit}
                  onChange={() => toggle(option.address)}
                />
                <TokenLogo token={option} size={32} />
                <span className={styles.assetName}>
                  <strong>{option.name}</strong>
                  <span className={styles.cellMeta} title={option.address}>
                    {option.symbol}
                  </span>
                </span>
                {checked && startsAt !== undefined && now !== undefined && startsAt > now && (
                  <span className={styles.statusPill} data-tone="warning">
                    {t("maturing", { time: formatDuration(startsAt - now) })}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
      <footer className={styles.assetFooter}>
        <span className={styles.cellMeta} aria-live="polite">
          {t("count", {
            count: selected.length,
            max: maximum === undefined ? "—" : String(maximum),
          })}
        </span>
        <button type="button" className="ui-button ui-button--ghost" onClick={onCancel}>
          {t("cancel")}
        </button>
        <button
          type="button"
          className="ui-button ui-button--primary"
          disabled={maximum !== undefined && BigInt(selected.length) > maximum}
          onClick={() => onConfirm(selected)}
        >
          {t("ok")}
        </button>
      </footer>
    </ReviewDrawer>
  );
}

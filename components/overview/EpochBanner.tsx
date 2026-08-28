"use client";

import { useBlock } from "wagmi";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { formatTokenAmountGrouped } from "@/lib/protocol/ux";

export type EpochQuotes = Readonly<{
  /** Fixed STATICS backing paid on acquisition, GENESIS_PRICE. */
  staticsPrice: bigint;
  /** ceil(reserve / 5,554). Zero while the Epoch runs. */
  reserveBuyIn: bigint;
  /** The flat native acquisition fee, charged in both phases. */
  nativeFee: bigint;
  /** floor(reserve / 5,555) returned on redemption. Zero while the Epoch runs. */
  reservePayout: bigint;
  /**
   * What the buy-in would be at the reserve as it stands right now.
   *
   * During the Epoch `reserveBuyIn` is zero because none is charged, but the
   * reserve is already growing on acquisition fees, so the amount owed the
   * moment the Epoch ends is climbing the whole time. Showing zero there would
   * imply the post-Epoch cost is settled, and it never is.
   */
  projectedBuyIn: bigint;
  /** floor(reserve / 5,555) at today's reserve, charged or not. */
  projectedPayout: bigint;
  /** GENESIS_MAX_CREDIT_PRINCIPAL. */
  maxCredit: bigint;
}>;

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <b>{String(Math.max(0, value)).padStart(2, "0")}</b>
      <span>{label}</span>
    </div>
  );
}

function Change({
  label,
  current,
  other,
  caveat,
  complete,
  pastLabel,
  nextLabel,
}: Readonly<{
  label: string;
  /** What is true while the Epoch runs. */
  current: string;
  /** What is true once it has ended. */
  other: string;
  caveat?: string;
  complete: boolean;
  pastLabel: string;
  nextLabel: string;
}>) {
  return (
    <div className="epoch-change">
      <span className="dapp-eyebrow">{label}</span>
      <p className="epoch-change-primary">{complete ? other : current}</p>
      <p className="epoch-change-secondary">
        <span aria-hidden="true">{complete ? pastLabel : nextLabel}</span>
        <b className={complete ? "is-past" : "is-next"}>{complete ? current : other}</b>
      </p>
      {caveat && <p className="epoch-change-caveat">{caveat}</p>}
    </div>
  );
}

/**
 * The Genesis Epoch, as the Overview's thesis rather than one tile among nine.
 *
 * `genesisEpochEnd` is immutable -- fixed at Vault construction, it cannot be
 * moved -- and it changes three economics at once. The page it replaced stated
 * that as "Active until <locale timestamp>", and afterwards as "Complete".
 */
export function EpochBanner({
  chainId,
  epochActive,
  epochEnd,
  quotes,
}: Readonly<{
  chainId: number;
  epochActive: boolean;
  /** Unix seconds. */
  epochEnd: number;
  quotes: EpochQuotes | null;
}>) {
  const t = useTranslations("launchOverview.epoch");
  const format = useFormatter();
  const { data: block } = useBlock({ chainId, watch: false });
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1_000));
  useEffect(() => {
    if (!epochActive) return;
    const offset = block ? Number(block.timestamp) - Math.floor(Date.now() / 1_000) : 0;
    const timer = globalThis.setInterval(
      () => setNow(Math.floor(Date.now() / 1_000) + offset),
      1_000
    );
    return () => globalThis.clearInterval(timer);
  }, [block, epochActive]);
  const remaining = Math.max(0, epochEnd - now);
  const days = Math.floor(remaining / 86_400);
  const hours = Math.floor((remaining % 86_400) / 3_600);
  const minutes = Math.floor((remaining % 3_600) / 60);
  const seconds = remaining % 60;

  const statics = quotes ? formatTokenAmountGrouped(quotes.staticsPrice, 18, 0) : "—";
  const feeOnly = quotes ? formatTokenAmountGrouped(quotes.nativeFee, 18, 3) : "—";
  const feePlusBuyIn = quotes
    ? formatTokenAmountGrouped(quotes.nativeFee + quotes.projectedBuyIn, 18, 5)
    : "—";
  const payout = quotes ? formatTokenAmountGrouped(quotes.projectedPayout, 18, 5) : "—";
  const maxCredit = quotes ? formatTokenAmountGrouped(quotes.maxCredit, 18, 0) : "—";

  return (
    <section className={`epoch-banner${epochActive ? "" : " is-complete"}`} aria-label={t("aria")}>
      <div className="epoch-banner-top">
        <div className="epoch-banner-label">
          <p className="dapp-eyebrow">{epochActive ? t("activeStatus") : t("completeStatus")}</p>
          <h2>{epochActive ? t("endsIn") : t("hasEnded")}</h2>
          <p>{epochActive ? t("activeDescription") : t("completeDescription")}</p>
        </div>
        <div className="epoch-countdown">
          {epochActive ? (
            <div className="epoch-countdown-figure">
              <CountdownUnit value={days} label={t("days")} />
              <CountdownUnit value={hours} label={t("hours")} />
              <CountdownUnit value={minutes} label={t("minutes")} />
              <CountdownUnit value={seconds} label={t("seconds")} />
            </div>
          ) : (
            <div className="epoch-countdown-figure">
              <div>
                <b>—</b>
                <span>{t("complete")}</span>
              </div>
            </div>
          )}
          <p className="epoch-countdown-when">
            {epochActive
              ? t("ends", {
                  date:
                    epochEnd > 0
                      ? format.dateTime(new Date(epochEnd * 1_000), {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "UTC",
                        })
                      : "—",
                })
              : t("ended", {
                  date:
                    epochEnd > 0
                      ? format.dateTime(new Date(epochEnd * 1_000), {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "UTC",
                        })
                      : "—",
                })}
          </p>
        </div>
      </div>

      <div className="epoch-changes">
        <Change
          label={t("acquiring")}
          current={t("acquireCurrent", { statics, native: feeOnly })}
          other={t("acquireAfter", { statics, native: feePlusBuyIn })}
          caveat={t("acquireCaveat")}
          complete={!epochActive}
          pastLabel={t("was")}
          nextLabel={t("then")}
        />
        <Change
          label={t("redeeming")}
          current={t("redeemCurrent", { statics })}
          other={t("redeemAfter", { statics, native: payout })}
          caveat={t("redeemCaveat")}
          complete={!epochActive}
          pastLabel={t("was")}
          nextLabel={t("then")}
        />
        <Change
          label={t("securedCredit")}
          current={t("closed")}
          other={t("upTo", { amount: maxCredit })}
          complete={!epochActive}
          pastLabel={t("was")}
          nextLabel={t("then")}
        />
      </div>
    </section>
  );
}

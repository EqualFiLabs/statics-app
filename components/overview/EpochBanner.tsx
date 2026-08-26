"use client";

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

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1_000));
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1_000)), 1_000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

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
}: Readonly<{
  label: string;
  /** What is true while the Epoch runs. */
  current: string;
  /** What is true once it has ended. */
  other: string;
  caveat?: string;
  complete: boolean;
}>) {
  return (
    <div className="epoch-change">
      <span className="dapp-eyebrow">{label}</span>
      <p className="epoch-change-primary">{complete ? other : current}</p>
      <p className="epoch-change-secondary">
        <span aria-hidden="true">{complete ? "was" : "then"}</span>
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
  epochActive,
  epochEnd,
  quotes,
}: Readonly<{
  epochActive: boolean;
  /** Unix seconds. */
  epochEnd: number;
  quotes: EpochQuotes | null;
}>) {
  const now = useNow(epochActive);
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
    <section
      className={`epoch-banner${epochActive ? "" : " is-complete"}`}
      aria-label="Genesis Epoch"
    >
      <div className="epoch-banner-top">
        <div className="epoch-banner-label">
          <p className="dapp-eyebrow">
            {epochActive ? "Genesis Epoch · in progress" : "Genesis Epoch · complete"}
          </p>
          <h2>{epochActive ? "The Epoch ends in" : "The Epoch has ended"}</h2>
          <p>
            {epochActive
              ? "This date was fixed when the Vault was deployed and cannot be moved. Three things change the moment it passes."
              : "These three changes took effect the moment it passed, and are permanent."}
          </p>
        </div>
        <div className="epoch-countdown">
          {epochActive ? (
            <div className="epoch-countdown-figure">
              <CountdownUnit value={days} label="days" />
              <CountdownUnit value={hours} label="hrs" />
              <CountdownUnit value={minutes} label="min" />
              <CountdownUnit value={seconds} label="sec" />
            </div>
          ) : (
            <div className="epoch-countdown-figure">
              <div>
                <b>—</b>
                <span>complete</span>
              </div>
            </div>
          )}
          <p className="epoch-countdown-when">
            {epochActive ? "Ends " : "Ended "}
            {epochEnd > 0 ? new Date(epochEnd * 1_000).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <div className="epoch-changes">
        <Change
          label="Acquiring an Operator"
          current={`${statics} STATICS + ${feeOnly} ETH`}
          other={`${statics} STATICS + ${feePlusBuyIn} ETH`}
          caveat="Buy-in shown at today's reserve. Every acquisition fee accretes to it, so the amount owed rises with each sale."
          complete={!epochActive}
        />
        <Change
          label="Redeeming an Operator"
          current={`${statics} STATICS, no ETH`}
          other={`${statics} STATICS + ${payout} ETH`}
          caveat="Reserve share at today's reserve. It rises for the same reason."
          complete={!epochActive}
        />
        <Change
          label="Secured credit"
          current="Closed"
          other={`Up to ${maxCredit} STATICS`}
          complete={!epochActive}
        />
      </div>
    </section>
  );
}

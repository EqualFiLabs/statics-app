"use client";
import { useTranslations } from "next-intl";
import {
  legInRange,
  type GaugeLegState,
  type GaugePoolState,
} from "@/lib/rewards/liquidity-rewards";
import styles from "./earn.module.css";

/** The leg's tick range against the gauge's current tick. */
export function RangeBar({ leg, pool }: { leg: GaugeLegState; pool: GaugePoolState }) {
  const t = useTranslations("liquidityRewards");
  const low = Math.min(leg.tickLower, pool.referenceTick),
    high = Math.max(leg.tickUpper, pool.referenceTick);
  const pad = Math.max(1, (high - low) * 0.15),
    min = low - pad,
    span = high + pad - min;
  const at = (tick: number) => `${((tick - min) / span) * 100}%`;
  const inRange = legInRange(leg, pool);
  const side = pool.referenceTick < leg.tickLower ? "below" : "above";
  return (
    <span className={styles.rangeWrap}>
      <span className={styles.rangeTrack} aria-hidden="true">
        <span
          className={styles.rangeSpan}
          data-in-range={inRange}
          style={{
            left: at(leg.tickLower),
            width: `calc(${at(leg.tickUpper)} - ${at(leg.tickLower)})`,
          }}
        />
        <span className={styles.rangeMarker} style={{ left: at(pool.referenceTick) }} />
      </span>
      <span className={styles.cellMeta}>
        {leg.liquidity === 0n
          ? t("legEmpty")
          : inRange
            ? t("legInRange")
            : t(side === "below" ? "legBelow" : "legAbove")}
      </span>
    </span>
  );
}

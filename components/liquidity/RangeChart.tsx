"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { useAppLocale } from "@/i18n/client";
import { depthBuckets, type Bound, type PricePoint } from "@/lib/phase-one/range-chart";
import type { ChartPeriod } from "@/hooks/usePoolMarket";
import styles from "./range-chart.module.css";

const ZOOMS = [1.01, 1.025, 1.05, 1.1, 1.2, 1.5, 2, 3, 5];
const BARS = 40;

/**
 * Price history, liquidity depth and the selected range on one vertical price axis. When
 * editable, the range's handles drag (pointer) or step (arrow keys); prices snap in the parent.
 */
export function RangeChart({
  current,
  bounds,
  unit,
  series,
  depth,
  decimals,
  inverted,
  period,
  onPeriod,
  editable,
  onMove,
  onStep,
}: {
  current: number;
  /** Display [min, max]; [0, ∞] is full range; null while no range is set. */
  bounds: readonly [number, number] | null;
  unit: string;
  series: readonly PricePoint[] | null;
  depth: readonly Readonly<{ tick: number; liquidityNet: bigint }>[] | null;
  decimals: readonly [number, number];
  inverted: boolean;
  period: ChartPeriod;
  onPeriod: (period: ChartPeriod) => void;
  editable: boolean;
  onMove: (bound: Bound, price: number) => void;
  onStep: (bound: Bound, direction: 1 | -1) => void;
}) {
  const t = useTranslations("rangeChart");
  const locale = useAppLocale();
  const area = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [drag, setDrag] = useState<Bound | null>(null);
  const full = bounds !== null && bounds[0] === 0 && bounds[1] === Infinity;

  // Fit the range with some margin unless the viewer has zoomed.
  const fitted =
    !bounds || full
      ? 3
      : ZOOMS.findIndex(
          (factor) =>
            bounds[0] >= (current / factor) * 1.02 && bounds[1] <= (current * factor) / 1.02
        );
  const level = zoom ?? (fitted < 0 ? ZOOMS.length - 1 : fitted);
  const factor = ZOOMS[level]!;
  const low = current / factor,
    high = current * factor;
  const y = (value: number) => Math.max(0, Math.min(100, ((high - value) / (high - low)) * 100));
  const format = (value: number) =>
    new Intl.NumberFormat(locale, { maximumSignificantDigits: 5 }).format(value);

  const path = (() => {
    if (!series || series.length < 2) return null;
    const from = series[0]!.time,
      span = series.at(-1)!.time - from || 1;
    return series
      .map((point, index) => {
        const x = (((point.time - from) / span) * 100).toFixed(3);
        const height = y(point.price).toFixed(3);
        return index === 0 ? `M${x} ${height}` : `H${x} V${height}`;
      })
      .join(" ");
  })();
  const bars = depth ? depthBuckets(depth, low, high, BARS, decimals, inverted) : null;
  const top = !bounds ? null : full ? 0 : y(bounds[1]);
  const bottom = !bounds ? null : full ? 100 : y(bounds[0]);

  const pointAt = (event: PointerEvent) => {
    const rect = area.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return null;
    const fraction = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    return high - fraction * (high - low);
  };
  const grab = (bound: Bound) => (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setZoom(level);
    setDrag(bound);
  };
  const move = (event: PointerEvent) => {
    if (!drag) return;
    const price = pointAt(event);
    if (price !== null) onMove(drag, price);
  };
  const key = (bound: Bound) => (event: KeyboardEvent) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    onStep(bound, event.key === "ArrowUp" ? 1 : -1);
  };

  return (
    <div className={styles.chart}>
      <div
        ref={area}
        className={styles.area}
        data-depth={bars ? "" : undefined}
        role="group"
        aria-label={t("description", {
          current: format(current),
          unit,
          min: bounds ? (full ? "0" : format(bounds[0])) : "—",
          max: bounds ? (full ? "∞" : format(bounds[1])) : "—",
        })}
        onPointerMove={move}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        {top !== null && bottom !== null && (
          <div className={styles.band} style={{ top: `${top}%`, height: `${bottom - top}%` }} />
        )}
        {path && (
          <svg
            className={styles.line}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={path} vectorEffect="non-scaling-stroke" />
          </svg>
        )}
        {bars && (
          <div className={styles.depth} aria-hidden="true">
            {bars.map((value, index) => {
              const price = high - ((index + 0.5) / BARS) * (high - low);
              const inside =
                bounds !== null && (full || (price >= bounds[0] && price <= bounds[1]));
              return (
                <span key={index}>
                  <i data-inside={inside || undefined} style={{ width: `${value * 100}%` }} />
                </span>
              );
            })}
          </div>
        )}
        <div className={styles.current} style={{ top: `${y(current)}%` }} aria-hidden="true">
          <span>{format(current)}</span>
        </div>
        {editable &&
          bounds &&
          !full &&
          (["max", "min"] as const).map((bound) => {
            const value = bound === "min" ? bounds[0] : bounds[1];
            return (
              <div key={bound} className={styles.handle} style={{ top: `${y(value)}%` }}>
                <button
                  type="button"
                  aria-label={t(bound === "min" ? "dragMin" : "dragMax", {
                    price: format(value),
                    unit,
                  })}
                  data-dragging={drag === bound || undefined}
                  onPointerDown={grab(bound)}
                  onKeyDown={key(bound)}
                >
                  {format(value)}
                </button>
              </div>
            );
          })}
      </div>
      <div className={styles.controls}>
        <div className={styles.periods} role="group" aria-label={t("period")}>
          {(["1D", "1W", "1M"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={period === option}
              onClick={() => onPeriod(option)}
            >
              {t(`period${option}`)}
            </button>
          ))}
        </div>
        <div className={styles.zoom}>
          <button
            type="button"
            aria-label={t("zoomOut")}
            disabled={level >= ZOOMS.length - 1}
            onClick={() => setZoom(Math.min(ZOOMS.length - 1, level + 1))}
          >
            −
          </button>
          <button
            type="button"
            aria-label={t("zoomIn")}
            disabled={level <= 0}
            onClick={() => setZoom(Math.max(0, level - 1))}
          >
            +
          </button>
          <button type="button" disabled={zoom === null} onClick={() => setZoom(null)}>
            {t("reset")}
          </button>
        </div>
      </div>
      {!series && <p className={styles.note}>{t("noHistory")}</p>}
    </div>
  );
}

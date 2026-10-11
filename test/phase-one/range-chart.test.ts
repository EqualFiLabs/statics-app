import { describe, expect, it } from "vitest";

import { usableTickBounds } from "@/lib/phase-one/liquidity";
import {
  depthBuckets,
  displayBounds,
  feeShareMultiplier,
  moveBound,
  presetTicks,
  priceSeries,
  priceToTick,
  singleSidedToken,
  stepBound,
  tickToPrice,
} from "@/lib/phase-one/range-chart";

const decimals = [18, 18] as const;
const sqrtAt = (tick: number) =>
  BigInt(Math.round(Math.exp((tick * Math.log(1.0001)) / 2) * 2 ** 96));

describe("range chart geometry", () => {
  it("converts between ticks and human prices with token decimals", () => {
    expect(tickToPrice(0, 18, 18)).toBe(1);
    expect(tickToPrice(0, 18, 6)).toBeCloseTo(1e12);
    expect(priceToTick(tickToPrice(52_680, 18, 18), 18, 18)).toBeCloseTo(52_680, 6);
  });

  it("shows full range as zero to infinity and flips bounds when inverted", () => {
    expect(displayBounds(usableTickBounds(60), 60, decimals, false)).toEqual([0, Infinity]);
    const [min, max] = displayBounds([0, 6_960], 60, decimals, true);
    expect(min).toBeCloseTo(1 / tickToPrice(6_960, 18, 18));
    expect(max).toBeCloseTo(1);
  });

  it("snaps a dragged bound to the nearest usable tick and keeps the range ordered", () => {
    expect(moveBound([0, 600], "max", tickToPrice(1_190, 18, 18), 60, decimals, false)).toEqual([
      0, 1_200,
    ]);
    expect(moveBound([0, 600], "min", tickToPrice(900, 18, 18), 60, decimals, false)).toEqual([
      540, 600,
    ]);
    // Inverted, the displayed minimum is the canonical upper tick.
    expect(moveBound([0, 600], "min", 1 / tickToPrice(1_200, 18, 18), 60, decimals, true)).toEqual([
      0, 1_200,
    ]);
    expect(moveBound([0, 600], "min", 0, 60, decimals, false)).toEqual([0, 600]);
  });

  it("steps one spacing in the displayed direction", () => {
    expect(stepBound([0, 600], "min", 1, 60, false)).toEqual([60, 600]);
    expect(stepBound([0, 600], "max", -1, 60, false)).toEqual([0, 540]);
    expect(stepBound([0, 600], "min", 1, 60, true)).toEqual([0, 540]);
    expect(stepBound([0, 60], "min", 1, 60, false)).toEqual([0, 60]);
  });

  it("builds strategy ranges around the current tick, with one-sided ranges holding one token", () => {
    expect(presetTicks("full", 100, 60, false)).toEqual(usableTickBounds(60));
    const common = presetTicks("common", 100, 60, false);
    expect(common[0]).toBeLessThanOrEqual(100 - 953);
    expect(common[1]).toBeGreaterThanOrEqual(100 + 953);
    const narrow = presetTicks("narrow", 100, 600, false);
    expect(narrow[0]).toBeLessThanOrEqual(100);
    expect(narrow[1]).toBeGreaterThan(100);

    const below = presetTicks("below", 100, 60, false);
    expect(singleSidedToken(below, 100)).toBe(1);
    expect(below[0]).toBeLessThanOrEqual(100 - 6_931);
    const above = presetTicks("above", 100, 60, false);
    expect(singleSidedToken(above, 100)).toBe(0);
    expect(above[1]).toBeGreaterThanOrEqual(100 + 6_931);
    // "Below" in the flipped display is above the canonical price.
    expect(singleSidedToken(presetTicks("below", 100, 60, true), 100)).toBe(0);
    expect(singleSidedToken([0, 600], 100)).toBeNull();
  });

  it("keeps every preset aligned and usable near protocol tick limits", () => {
    const [lo, hi] = usableTickBounds(60);
    for (const tick of [lo, hi, -887271, 887271])
      for (const preset of ["narrow", "common", "wide", "below", "above"] as const)
        for (const inverted of [false, true]) {
          const [lower, upper] = presetTicks(preset, tick, 60, inverted);
          expect(lower).toBeGreaterThanOrEqual(lo);
          expect(upper).toBeLessThanOrEqual(hi);
          expect(lower).toBeLessThan(upper);
          expect(Math.abs(lower % 60)).toBe(0);
          expect(Math.abs(upper % 60)).toBe(0);
        }
  });

  it("measures the fee share against full range only while in range", () => {
    expect(feeShareMultiplier(usableTickBounds(60), sqrtAt(0), 60)).toBe(1);
    const narrow = feeShareMultiplier([-600, 600], sqrtAt(0), 60)!;
    const wide = feeShareMultiplier([-6_000, 6_000], sqrtAt(0), 60)!;
    expect(narrow).toBeGreaterThan(wide);
    expect(wide).toBeGreaterThan(1);
    // Symmetric range: 1 / (1 − (Pa/Pb)^¼).
    expect(narrow).toBeCloseTo(1 / (1 - Math.exp((-1_200 * Math.log(1.0001)) / 4)), 3);
    expect(feeShareMultiplier([600, 1_200], sqrtAt(0), 60)).toBeNull();
  });

  it("buckets active liquidity by display price and scales to the deepest bucket", () => {
    const ticks = [
      { tick: -600, liquidityNet: 100n },
      { tick: 0, liquidityNet: 300n },
      { tick: 600, liquidityNet: -400n },
    ];
    const low = tickToPrice(-1_200, 18, 18),
      high = tickToPrice(1_200, 18, 18);
    const buckets = depthBuckets(ticks, low, high, 4, decimals, false);
    expect(buckets).toEqual([0, 1, 0.25, 0]);
    expect(depthBuckets([], low, high, 3, decimals, false)).toEqual([0, 0, 0]);
  });

  it("carries prices between swaps and ends at the current price", () => {
    const series = priceSeries(
      [
        { timestamp: 50n, open: 9, close: 11 },
        { timestamp: 70n, open: 11, close: 12 },
        { timestamp: 500n, open: 1, close: 1 },
      ],
      13,
      0,
      100,
      false
    );
    expect(series).toEqual([
      { time: 50, price: 9 },
      { time: 50, price: 11 },
      { time: 70, price: 12 },
      { time: 100, price: 13 },
    ]);
    expect(priceSeries([], 4, 0, 10, true)).toEqual([
      { time: 10, price: 0.25 },
      { time: 10, price: 0.25 },
    ]);
  });
});

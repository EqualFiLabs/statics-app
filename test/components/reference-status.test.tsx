import { afterEach, expect, it, vi } from "vitest";
import { act, render, screen } from "@/test/render";
import { ReferenceStatus } from "@/components/overview/ReferenceStatus";
import { referenceUsable, type PriceReference } from "@/lib/market/reference-prices";
const now = Date.parse("2026-10-21T23:00:00Z");
const reference: PriceReference = {
  source: "robinhood",
  asset: "stock",
  observedAt: now - 10_000,
  fetchedAt: now,
  expiresAt: now + 900_000,
  freshUntil: now + 110_000,
  stale: false,
  halted: false,
};
afterEach(() => vi.useRealTimers());
it("keeps the pill quiet through routine refresh intervals and warns at the actual freshness deadline", () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  render(<ReferenceStatus references={[reference]} />);
  act(() => vi.advanceTimersByTime(35_000));
  expect(screen.queryByText("Stale")).not.toBeInTheDocument();
  expect(referenceUsable([reference], Date.now())).toBe(true);
  act(() => vi.advanceTimersByTime(75_000));
  expect(screen.getByText("Stale")).toBeInTheDocument();
  expect(referenceUsable([reference], Date.now())).toBe(false);
});
it("honors failed refreshes, halts, expiry and older responses", () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const older = { ...reference, freshUntil: undefined };
  expect(referenceUsable([older], now + 35_000)).toBe(true);
  expect(referenceUsable([older], now + 110_000)).toBe(false);
  expect(referenceUsable([{ ...reference, halted: true }], now)).toBe(false);
  expect(referenceUsable([{ ...reference, expiresAt: now }], now)).toBe(false);
  render(<ReferenceStatus references={[{ ...reference, stale: true, halted: true }]} />);
  expect(screen.getByText("Stale")).toBeInTheDocument();
  expect(screen.getByText("Trading halted")).toBeInTheDocument();
});

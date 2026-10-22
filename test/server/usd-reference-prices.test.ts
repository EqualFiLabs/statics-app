import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadUsdReferences,
  resetUsdReferenceCacheForTest,
} from "@/lib/server/usd-reference-prices";
import { resetEthUsdCacheForTest } from "@/lib/server/eth-usd";
const stock = `0x${"11".repeat(20)}`,
  weth = `0x${"22".repeat(20)}`,
  usdg = `0x${"33".repeat(20)}`;
const now = Date.parse("2026-10-21T23:00:00Z");
const deployments = [{ chainId: 4663, contractAddress: stock }];
const registry = { assets: [{ tokenSymbol: "NVDA", currentMultiplier: "1.1", deployments }] };
const quote = {
  tokenSymbol: "NVDA",
  deployments,
  bid: "200",
  ask: "202",
  currency: "USD",
  generatedAt: new Date(now).toISOString(),
  isTradingHalt: false,
};
const input = {
  chainId: 4663,
  tokens: [
    { address: stock, decimals: 18 },
    { address: weth, decimals: 18 },
    { address: usdg, decimals: 6 },
  ],
  weth,
  usdg,
};
let fetchMock: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.restoreAllMocks();
  resetUsdReferenceCacheForTest();
  resetEthUsdCacheForTest();
  fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async (url: Parameters<typeof fetch>[0]) =>
        new Response(
          JSON.stringify(
            String(url).endsWith("assets")
              ? registry
              : String(url).includes("prices/")
                ? { quotes: [quote] }
                : String(url).includes("kraken")
                  ? { error: [], result: { USDGUSD: { b: ["0.98"], a: ["1"] } } }
                  : { price: "2500" }
          )
        )
    );
});
describe("USD reference adapters", () => {
  it("normalizes raw stock quotes once, uses a real USDG rate, and coalesces requests", async () => {
    const [a, b] = await Promise.all([
      loadUsdReferences(input, now),
      loadUsdReferences(input, now),
    ]);
    expect(a).toEqual(b);
    expect(a.prices.find((p) => p.address === stock)?.valueWad).toBe(2211n * 10n ** 17n);
    expect(a.prices.find((p) => p.address === usdg)?.valueWad).toBe(99n * 10n ** 16n);
    expect(a.prices.find((p) => p.address === weth)?.valueWad).toBe(2500n * 10n ** 18n);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(a.restricted).toEqual([stock]);
    expect(a.allowDerived).toBe(true);
  });
  it("does not multiply already adjusted token quotes, and exposes halt status", async () => {
    fetchMock.mockImplementation(
      async (url: Parameters<typeof fetch>[0]) =>
        new Response(
          JSON.stringify(
            String(url).endsWith("assets")
              ? registry
              : { quotes: [{ ...quote, tokenBid: "220", tokenAsk: "222", isTradingHalt: true }] }
          )
        )
    );
    const r = await loadUsdReferences({ ...input, tokens: input.tokens.slice(0, 1) }, now);
    expect(r.prices[0]?.valueWad).toBe(221n * 10n ** 18n);
    expect(r.prices[0]?.reference.halted).toBe(true);
  });
  it.each([
    { bid: "202", ask: "200" },
    { bid: "0" },
    { tokenBid: "220" },
    { deployments: [{ chainId: 46630, contractAddress: stock }] },
    { deployments: [{ chainId: 4663, contractAddress: weth }] },
    { currency: "EUR" },
    { generatedAt: new Date(now - 900000).toISOString() },
    { generatedAt: new Date(now + 60000).toISOString() },
  ])("rejects invalid stock quotes without losing crypto prices: %j", async (override) => {
    fetchMock.mockImplementation(
      async (url: Parameters<typeof fetch>[0]) =>
        new Response(
          JSON.stringify(
            String(url).endsWith("assets")
              ? registry
              : String(url).includes("prices/")
                ? { quotes: [{ ...quote, ...override }] }
                : String(url).includes("kraken")
                  ? { error: [], result: { USDGUSD: { b: ["0.99"], a: ["1"] } } }
                  : { price: "2500" }
          )
        )
    );
    const r = await loadUsdReferences(input, now);
    expect(r.prices.map((p) => p.address)).toEqual([weth, usdg]);
    expect(r.restricted).toContain(stock);
  });
  it("serves bounded stale values, applies cooldown, then expires without pool fallback", async () => {
    await loadUsdReferences(input, now);
    fetchMock.mockResolvedValue(new Response("limited", { status: 429 }));
    const stale = await loadUsdReferences(input, now + 61000);
    expect(stale.prices).toHaveLength(3);
    expect(stale.prices.every((p) => p.reference.stale)).toBe(true);
    const count = fetchMock.mock.calls.length;
    await loadUsdReferences(input, now + 62000);
    expect(fetchMock).toHaveBeenCalledTimes(count);
    const expired = await loadUsdReferences(input, now + 900001);
    expect(expired.prices).toEqual([]);
    expect(expired.restricted).toContain(stock);
    expect(expired.allowDerived).toBe(false);
  });
  it("does not map Mainnet prices onto other networks", async () => {
    expect((await loadUsdReferences({ ...input, chainId: 46630 }, now)).prices).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("passes a four-second timeout to provider requests", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    await loadUsdReferences(input, now);
    expect(timeout).toHaveBeenCalledWith(4000);
  });
});

it("bounds network concurrency across separate simultaneous market requests", async () => {
  const assets = Array.from({ length: 12 }, (_, i) => ({
    tokenSymbol: `T${i}`,
    currentMultiplier: "1",
    deployments: [
      { chainId: 4663, contractAddress: `0x${(i + 100).toString(16).padStart(40, "0")}` },
    ],
  }));
  let active = 0,
    peak = 0;
  fetchMock.mockImplementation(async (url: Parameters<typeof fetch>[0]) => {
    if (String(url).endsWith("assets")) return new Response(JSON.stringify({ assets }));
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    const symbol = String(url).split("/").at(-1)!;
    const asset = assets.find((a) => a.tokenSymbol === symbol)!;
    return new Response(
      JSON.stringify({
        quotes: [{ ...quote, tokenSymbol: symbol, deployments: asset.deployments }],
      })
    );
  });
  const tokens = assets.map((a) => ({ address: a.deployments[0]!.contractAddress, decimals: 18 }));
  const results = await Promise.all([
    loadUsdReferences({ ...input, tokens: tokens.slice(0, 6) }, now),
    loadUsdReferences({ ...input, tokens: tokens.slice(6) }, now),
  ]);
  expect(peak).toBeLessThanOrEqual(4);
  expect(results.flatMap((r) => r.prices)).toHaveLength(12);
});
it("handles actual timeout rejection without losing independently available prices", async () => {
  vi.useFakeTimers();
  const original = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(url).includes("prices/"))
      return new Promise<Response>((_, reject) =>
        init!.signal!.addEventListener("abort", () => reject(new Error("timeout")), { once: true })
      );
    return original(url, init);
  });
  // Simulate the timeout signal deterministically; the native helper uses real timers.
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  });
  try {
    const pending = loadUsdReferences(input, now);
    await vi.advanceTimersByTimeAsync(4001);
    const r = await pending;
    expect(r.prices.map((p) => p.address)).toEqual([weth, usdg]);
    expect(r.restricted).toContain(stock);
  } finally {
    vi.useRealTimers();
  }
});

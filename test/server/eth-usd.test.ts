import { beforeEach, describe, expect, it, vi } from "vitest";

import { WAD } from "@/lib/market/analytics";
import { loadEthUsd, resetEthUsdCacheForTest } from "@/lib/server/eth-usd";

beforeEach(() => {
  resetEthUsdCacheForTest();
  vi.restoreAllMocks();
});

describe("ETH/USD cache", () => {
  it("deduplicates fresh Coinbase reads", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ price: "2500.25" })));
    const [first, second] = await Promise.all([loadEthUsd(1_000), loadEthUsd(1_000)]);
    expect(first?.valueWad).toBe(2_500n * WAD + WAD / 4n);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await loadEthUsd(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves bounded stale data and then removes USD values", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ price: "2500" })))
      .mockRejectedValue(new Error("offline"));
    await loadEthUsd(1_000);
    expect((await loadEthUsd(62_000))?.stale).toBe(true);
    expect(await loadEthUsd(901_001)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadOverview: vi.fn() }));

vi.mock("@/lib/server/market-overview", () => ({ loadMarketOverview: mocks.loadOverview }));

import { GET as getInternalOverview } from "@/app/api/market/overview/route";
import { GET as getCandles } from "@/app/api/market/v1/candles/route";
import { GET as getExternalOverview } from "@/app/api/market/v1/overview/route";
import { GET as getStatus } from "@/app/api/market/v1/status/route";
import { GET as getSwaps } from "@/app/api/market/v1/swaps/route";
import { resetMarketRateLimitsForTest } from "@/lib/server/market-api-auth";

const secret = "test-secret-with-enough-entropy";
const token = `stx_live_partner_${secret}`;
const overview = {
  schemaVersion: 1,
  status: "fresh",
  chainId: 4_663,
  deploymentId: "robinhood-genesis",
  poolId: `0x${"1".repeat(64)}`,
  asOfBlock: "100",
  freshness: { snapshotAt: "2026-08-31T00:00:00.000Z" },
};

function authorized(url: string): Request {
  return new Request(url, { headers: { authorization: `Bearer ${token}` } });
}

beforeEach(() => {
  resetMarketRateLimitsForTest();
  mocks.loadOverview.mockResolvedValue(overview);
  process.env.STATICS_MARKET_API_KEYS = `partner:${createHash("sha256").update(secret).digest("hex")}`;
  process.env.NEXT_PUBLIC_STATICS_MAINNET_INDEXER_URL = "https://indexer.example/api";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.STATICS_MARKET_API_KEYS;
  delete process.env.NEXT_PUBLIC_STATICS_MAINNET_INDEXER_URL;
});

describe("market API routes", () => {
  it("keeps the dashboard overview public while authenticating external routes", async () => {
    expect((await getInternalOverview()).status).toBe(200);
    expect(
      (await getExternalOverview(new Request("https://app.example/api/market/v1/overview"))).status
    ).toBe(401);
    expect(
      (await getExternalOverview(authorized("https://app.example/api/market/v1/overview"))).status
    ).toBe(200);
    expect(mocks.loadOverview).toHaveBeenCalledTimes(2);
  });

  it("returns bounded status data", async () => {
    const response = await getStatus(authorized("https://app.example/api/market/v1/status"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      status: "fresh",
      chainId: 4_663,
      asOfBlock: "100",
    });
  });

  it("validates and forwards only bounded candle parameters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ deploymentId: "robinhood-genesis", items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const invalid = await getCandles(
      authorized("https://app.example/api/market/v1/candles?from=0&to=9999999999&resolution=1")
    );
    expect(invalid.status).toBe(400);
    const response = await getCandles(
      authorized("https://app.example/api/market/v1/candles?from=100&to=200&resolution=15")
    );
    expect(response.status).toBe(200);
    const upstream = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(upstream.origin + upstream.pathname).toBe("https://indexer.example/api/market/candles");
    expect(Object.fromEntries(upstream.searchParams)).toEqual({
      from: "100",
      to: "200",
      resolution: "15",
    });
  });

  it("caps swap history requests", async () => {
    expect(
      (await getSwaps(authorized("https://app.example/api/market/v1/swaps?limit=101"))).status
    ).toBe(400);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ deploymentId: "robinhood-genesis", items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    expect(
      (await getSwaps(authorized("https://app.example/api/market/v1/swaps?limit=25"))).status
    ).toBe(200);
    expect(new URL(String(fetchMock.mock.calls[0]![0])).searchParams.get("limit")).toBe("25");
  });
});

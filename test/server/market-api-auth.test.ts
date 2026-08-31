import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import { authorizeMarketRequest, resetMarketRateLimitsForTest } from "@/lib/server/market-api-auth";

const secret = "a-long-random-market-secret";
const environment = {
  STATICS_MARKET_API_KEYS: `partner:${createHash("sha256").update(secret).digest("hex")}`,
};

function request(value?: string): Request {
  return new Request("https://staticsprotocol.com/api/market/v1/overview", {
    headers: value ? { authorization: value } : {},
  });
}

beforeEach(resetMarketRateLimitsForTest);

describe("market API authorization", () => {
  it("fails closed when keys are missing or malformed", () => {
    expect(authorizeMarketRequest(request(), {})).toEqual({ ok: false, status: 503 });
    expect(
      authorizeMarketRequest(request(`Bearer stx_live_partner_${secret}`), {
        STATICS_MARKET_API_KEYS: "bad",
      })
    ).toEqual({ ok: false, status: 503 });
  });

  it("rejects missing and incorrect bearer secrets", () => {
    expect(authorizeMarketRequest(request(), environment)).toEqual({ ok: false, status: 401 });
    expect(
      authorizeMarketRequest(
        request("Bearer stx_live_partner_this-is-the-wrong-secret"),
        environment
      )
    ).toEqual({ ok: false, status: 401 });
  });

  it("accepts configured keys and enforces the burst", () => {
    const authorized = request(`Bearer stx_live_partner_${secret}`);
    expect(authorizeMarketRequest(authorized, environment, 1_000)).toEqual({
      ok: true,
      keyId: "partner",
    });
    for (let index = 1; index < 30; index += 1) {
      expect(authorizeMarketRequest(authorized, environment, 1_000).ok).toBe(true);
    }
    expect(authorizeMarketRequest(authorized, environment, 1_000)).toEqual({
      ok: false,
      status: 429,
      retryAfter: 1,
    });
    expect(authorizeMarketRequest(authorized, environment, 1_500).ok).toBe(true);
  });
});

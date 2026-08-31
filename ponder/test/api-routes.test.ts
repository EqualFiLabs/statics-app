import { describe, expect, it, vi } from "vitest";

vi.mock("ponder:api", () => ({ db: {} }));
vi.mock("ponder:schema", () => ({
  activeGenesisCredit: {},
  activeLoan: {},
  v4Position: {},
  genesisNft: {},
  genesisRewardClaim: {},
  harvestedFee: {},
  marketCandle: {},
  marketSwap: {},
}));

import { recoverableGenesisCreditPage } from "../src/api/genesis-credits";
import app from "../src/api";

const RESERVED_ROUTES = new Set(["/health", "/ready", "/status", "/metrics", "/client"]);

describe("indexer API routes", () => {
  it("leaves Ponder's operational routes available", () => {
    const conflicts = app.routes
      .map((route) => route.path)
      .filter((path) => RESERVED_ROUTES.has(path));

    expect(conflicts).toEqual([]);
  });

  it.each([
    "/genesis/credits/recoverable",
    "/genesis/credits/recoverable?asOf=1.5",
    "/genesis/credits/recoverable?asOf=100&limit=0",
    "/genesis/credits/recoverable?asOf=100&cursor=",
    "/genesis/credits/recoverable?asOf=100&limit=101",
    "/genesis/credits/recoverable?asOf=100&cursor=not-a-cursor",
  ])("rejects invalid recoverable Genesis credit query %s", async (path) => {
    const response = await app.request(path);
    expect(response.status).toBe(400);
  });

  it.each([
    "/market/candles",
    "/market/candles?from=1&to=2",
    "/market/candles?from=1&to=2&resolution=2",
    "/market/candles?from=2&to=1&resolution=1",
    "/market/candles?from=0&to=2678401&resolution=60",
  ])("rejects invalid candle query %s", async (path) => {
    const response = await app.request(path);
    expect(response.status).toBe(400);
  });
});

describe("recoverable Genesis credit query", () => {
  const owner = "0x0000000000000000000000000000000000000001" as const;
  const row = (genesisId: bigint, recoverableAt: bigint, deploymentId = "selected") => ({
    deploymentId,
    genesisId,
    owner,
    principal: 100n,
    maturity: recoverableAt - 60n,
    recoverableAt,
  });

  it("is deployment-scoped and strictly excludes the asOf boundary", () => {
    expect(
      recoverableGenesisCreditPage(
        [row(1n, 99n), row(2n, 100n), row(3n, 98n, "other")],
        "selected",
        100n,
        100
      )
    ).toEqual({ items: [row(1n, 99n)], hasNextPage: false });
  });

  it("reports pagination when one extra ordered row is present", () => {
    expect(recoverableGenesisCreditPage([row(1n, 90n), row(2n, 91n)], "selected", 100n, 1)).toEqual(
      { items: [row(1n, 90n)], hasNextPage: true }
    );
  });
});

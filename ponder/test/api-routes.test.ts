import { describe, expect, it, vi } from "vitest";

vi.mock("ponder:api", () => ({ db: {} }));
vi.mock("ponder:schema", () => ({
  activeLoan: {},
  v4Position: {},
  genesisNft: {},
  genesisRewardClaim: {},
  harvestedFee: {},
}));

import app from "../src/api";

const RESERVED_ROUTES = new Set(["/health", "/ready", "/status", "/metrics", "/client"]);

describe("indexer API routes", () => {
  it("leaves Ponder's operational routes available", () => {
    const conflicts = app.routes
      .map((route) => route.path)
      .filter((path) => RESERVED_ROUTES.has(path));

    expect(conflicts).toEqual([]);
  });
});

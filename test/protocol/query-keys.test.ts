import { describe, expect, it } from "vitest";

import { protocolQueryKeys } from "@/lib/protocol/query-keys";

const wallet = "0x0000000000000000000000000000000000000001" as const;

describe("protocol query keys", () => {
  it("shares basket and position catalog identities across routes", () => {
    expect(protocolQueryKeys.basketCatalog("commit", wallet)).toEqual([
      "basket-catalog",
      "commit",
      wallet,
    ]);
    expect(protocolQueryKeys.positionCatalog("commit", wallet)).toEqual([
      "position-catalog",
      "commit",
      wallet,
    ]);
  });

  it("fails closed to an unconfigured deployment identity", () => {
    expect(protocolQueryKeys.positionCatalog(undefined, null)).toEqual([
      "position-catalog",
      "unconfigured",
      null,
    ]);
  });

  it("keeps Morpho position keys JSON serializable", () => {
    const marketId = `0x${"12".repeat(32)}` as const;
    const key = protocolQueryKeys.morphoPosition("testnet-rehearsal", 1n, marketId);

    expect(key).toEqual(["morpho-position", "testnet-rehearsal", "1", marketId]);
    expect(() => JSON.stringify(key)).not.toThrow();
  });
});

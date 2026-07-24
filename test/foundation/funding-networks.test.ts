import { describe, expect, it } from "vitest";

import { fundingNetworks, getFundingNetwork, isFundingChainId } from "@/lib/funding-networks";

describe("funding network registry", () => {
  it("keeps chain identifiers unique and resolves the Eves mainnet set", () => {
    const chainIds = fundingNetworks.map((network) => network.chain.id);

    expect(new Set(chainIds).size).toBe(chainIds.length);
    expect(getFundingNetwork(8_453)?.label).toBe("Base");
    expect(getFundingNetwork(4_663)?.label).toBe("Robinhood Chain");
    expect(isFundingChainId(31_337)).toBe(false);
  });
});

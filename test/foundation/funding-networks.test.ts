import { describe, expect, it } from "vitest";

import { fundingNetworks, getFundingNetwork, isFundingChainId } from "@/lib/funding-networks";

describe("funding network registry", () => {
  it("keeps chain identifiers unique and resolves the Eves mainnet set", () => {
    const chainIds = fundingNetworks.map((network) => network.chain.id);

    expect(new Set(chainIds).size).toBe(chainIds.length);
    expect(getFundingNetwork(8_453)?.label).toBe("Base");
    expect(getFundingNetwork(4_663)?.label).toBe("Robinhood Chain");
    expect(getFundingNetwork(46_630)?.label).toBe("Robinhood Testnet");
  });

  it("offers local Anvil in development, so the wallet can reach the local stack", () => {
    // This assertion used to be its inverse. Excluding Anvil meant the wallet
    // could not be pointed at the only chain with fixtures on it, so balances,
    // NFTs and transfers were untestable against a real deployment.
    expect(isFundingChainId(31_337)).toBe(true);
    expect(getFundingNetwork(31_337)?.label).toBe("Local Anvil");
  });

  it("does not offer swaps on Anvil", () => {
    // The routing APIs the swap panel calls are public services that know
    // nothing about a local chain, so offering it would fail like a bug in the
    // app rather than like an unsupported network.
    expect(getFundingNetwork(31_337)?.supportsUniswap).toBe(false);
  });

  it("offers testnet funding without claiming Trading API routes", () => {
    expect(isFundingChainId(46_630)).toBe(true);
    expect(getFundingNetwork(46_630)?.supportsUniswap).toBe(false);
  });

  it("lists Anvil first, where someone running the local stack will look", () => {
    expect(fundingNetworks[0].key).toBe("anvil");
  });
});

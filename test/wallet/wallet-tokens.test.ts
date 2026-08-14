import { describe, expect, it } from "vitest";

import type { DollarDeploymentState } from "@/lib/dollar/deployment";
import { defaultWalletTokens } from "@/lib/wallet-tokens";

describe("default Statics wallet tokens", () => {
  it("includes the deployed EVE token on Base and Robinhood", () => {
    expect(defaultWalletTokens(8_453)).toContainEqual(
      expect.objectContaining({
        symbol: "EVE",
        name: "0xAgentEVE",
        decimals: 18,
        isDefault: true,
      })
    );
    expect(defaultWalletTokens(4_663)).toContainEqual(
      expect.objectContaining({
        symbol: "EVE",
        name: "0xAgentEVE",
        decimals: 18,
        isDefault: true,
      })
    );
    expect(
      defaultWalletTokens(8_453).some(
        (token) => token.address.toLowerCase() === "0xe7d192e52fa418236d6eecf7d5eb38da9dd11ba3"
      )
    ).toBe(true);
    expect(
      defaultWalletTokens(4_663).some(
        (token) => token.address.toLowerCase() === "0x12fa0ec31be30677fa38274b3afbc2a0fce7648f"
      )
    ).toBe(true);
    expect(defaultWalletTokens(1).some((token) => token.symbol === "EVE")).toBe(false);
  });

  it("uses the deployed Dollar ticker", () => {
    const dollarAddress = "0x1111111111111111111111111111111111111111";
    const deployment = {
      status: "configured",
      deployment: { chainId: 46_630, contracts: { dollar: dollarAddress } },
    } as unknown as DollarDeploymentState;
    const dollar = defaultWalletTokens(46_630, deployment).find(
      (token) => token.address.toLowerCase() === dollarAddress.toLowerCase()
    );
    expect(dollar?.symbol).toBe("USDstx");
  });
});

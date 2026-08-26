import { describe, expect, it } from "vitest";

import type { DollarDeploymentState } from "@/lib/dollar/deployment";
import type { ProtocolDeployment } from "@/lib/deployments/types";
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
      deployment: {
        chainId: 46_630,
        contracts: {
          dollar: dollarAddress,
          weth: "0x2222222222222222222222222222222222222222",
        },
      },
    } as unknown as DollarDeploymentState;
    const dollar = defaultWalletTokens(46_630, deployment).find(
      (token) => token.address.toLowerCase() === dollarAddress.toLowerCase()
    );
    expect(dollar?.symbol).toBe("USDstx");
  });

  it("keeps STATICS and WETH visible after the full protocol joins a launch network", () => {
    const deployment = {
      kind: "protocol",
      descriptor: { chainId: 46_630 },
      protocol: {
        chainId: 46_630,
        contracts: {
          dollar: "0x1111111111111111111111111111111111111111",
          weth: "0x2222222222222222222222222222222222222222",
        },
        genesis: { token: "0x3333333333333333333333333333333333333333" },
      },
    } as unknown as ProtocolDeployment;

    const symbols = defaultWalletTokens(46_630, deployment).map((token) => token.symbol);
    expect(symbols).toContain("STATICS");
    expect(symbols).toContain("WETH");
    expect(symbols).toContain("USDstx");
  });
});

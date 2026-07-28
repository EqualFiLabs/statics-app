import { describe, expect, it } from "vitest";

import { defaultDestinationToken } from "@/components/portal/AcrossBridgePanel";
import { parseAcrossAmount } from "@/lib/portal/across";

describe("parseAcrossAmount", () => {
  it("reads the shapes Across actually returns", () => {
    expect(parseAcrossAmount("1000000")).toBe(1_000_000n);
    expect(parseAcrossAmount("0x0f4240")).toBe(1_000_000n);
    expect(parseAcrossAmount(1_000_000)).toBe(1_000_000n);
    expect(parseAcrossAmount(1_000_000n)).toBe(1_000_000n);
  });

  // The crash this exists to prevent: fees.total arrives as an object while
  // outputAmount beside it is a plain string, and BigInt() on the object throws
  // during render, taking the panel down through the error boundary.
  it("unwraps an amount carried inside an object", () => {
    expect(parseAcrossAmount({ amount: "2500", amountUsd: "2.50" })).toBe(2_500n);
    expect(parseAcrossAmount({ total: 42 })).toBe(42n);
    expect(parseAcrossAmount({ value: "0x10" })).toBe(16n);
  });

  it("returns null instead of throwing on anything it cannot read", () => {
    for (const value of [
      undefined,
      null,
      "",
      "abc",
      "1.5",
      -1,
      1.5,
      {},
      { amount: "not a number" },
      { amount: { amount: "1" } },
      [],
    ]) {
      expect(parseAcrossAmount(value), JSON.stringify(value) ?? "undefined").toBeNull();
    }
  });
});

describe("defaultDestinationToken", () => {
  // Across's real Robinhood list, in the order the API returns it.
  const robinhood = [
    { chainId: 4663, address: "0x0Bd7", name: "Wrapped Ether", symbol: "WETH", decimals: 18 },
    { chainId: 4663, address: "0x0000", name: "Ether", symbol: "ETH", decimals: 18 },
    { chainId: 4663, address: "0x5fc5", name: "Global Dollar", symbol: "USDG", decimals: 6 },
  ];

  // Sending ETH and receiving WETH is a swap nobody asked for, and taking the
  // first entry produced exactly that because WETH leads the list.
  it("receives the same asset that was sent", () => {
    expect(defaultDestinationToken(robinhood, "ETH")).toBe("0x0000");
    expect(defaultDestinationToken(robinhood, "WETH")).toBe("0x0Bd7");
  });

  it("prefers the dollar when the sent asset does not exist there", () => {
    expect(defaultDestinationToken(robinhood, "DAI")).toBe("0x5fc5");
    expect(defaultDestinationToken(robinhood, undefined)).toBe("0x5fc5");
  });

  it("falls back to the first token only when nothing matches", () => {
    const sparse = [{ chainId: 1, address: "0xabc", name: "Token", symbol: "TKN", decimals: 18 }];
    expect(defaultDestinationToken(sparse, "ETH")).toBe("0xabc");
    expect(defaultDestinationToken([], "ETH")).toBe("");
  });
});

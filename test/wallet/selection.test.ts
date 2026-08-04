import { describe, expect, it } from "vitest";

import { selectWalletKind } from "@/lib/wallet/selection";

describe("Statics EVM wallet selection", () => {
  it("uses the directly connected external wallet during automatic restoration", () => {
    expect(
      selectWalletKind({
        preference: "auto",
        externalAvailable: true,
        embeddedAvailable: true,
      })
    ).toBe("external");
  });

  it("honors an explicit embedded-wallet selection", () => {
    expect(
      selectWalletKind({
        preference: "embedded",
        externalAvailable: true,
        embeddedAvailable: true,
      })
    ).toBe("embedded");
  });

  it("does not fall through to a different signer when the selected source disappears", () => {
    expect(
      selectWalletKind({
        preference: "external",
        externalAvailable: false,
        embeddedAvailable: true,
      })
    ).toBeNull();
  });

  it("preserves an explicit local disconnect even when Privy has an embedded wallet", () => {
    expect(
      selectWalletKind({
        preference: "none",
        externalAvailable: true,
        embeddedAvailable: true,
      })
    ).toBeNull();
  });
});

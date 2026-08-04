import { describe, expect, it } from "vitest";

import {
  derivePrivyIdentityStatus,
  deriveWalletRuntimeStatus,
  parseWalletPreference,
  walletClientAccountAddress,
  walletClientMatchesAddress,
} from "@/lib/wallet/runtime";

describe("wallet and identity failure boundaries", () => {
  it("keeps a connected wallet ready while Privy is degraded", () => {
    expect(
      derivePrivyIdentityStatus({
        configured: true,
        ready: true,
        authenticated: true,
        hasError: true,
      })
    ).toBe("degraded");
    expect(
      deriveWalletRuntimeStatus({
        preferenceLoaded: true,
        connecting: false,
        address: "0x1111111111111111111111111111111111111111",
        selectedKind: "external",
        hasError: false,
      })
    ).toBe("ready");
  });

  it("does not require an authenticated Privy session for an external wallet", () => {
    expect(
      derivePrivyIdentityStatus({
        configured: true,
        ready: true,
        authenticated: false,
        hasError: false,
      })
    ).toBe("signed-out");
    expect(
      deriveWalletRuntimeStatus({
        preferenceLoaded: true,
        connecting: false,
        address: "0x1111111111111111111111111111111111111111",
        selectedKind: "external",
        hasError: false,
      })
    ).toBe("ready");
  });

  it("persists only explicit wallet-source choices", () => {
    expect(parseWalletPreference("external")).toBe("external");
    expect(parseWalletPreference("embedded")).toBe("embedded");
    expect(parseWalletPreference("none")).toBe("none");
    expect(parseWalletPreference("unexpected")).toBe("auto");
    expect(parseWalletPreference(null)).toBe("auto");
  });

  it("withholds a stale transaction client after the wallet account changes", () => {
    expect(
      walletClientMatchesAddress(
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222"
      )
    ).toBe(false);
    expect(
      walletClientMatchesAddress(
        "0x1111111111111111111111111111111111111111",
        "0x1111111111111111111111111111111111111111"
      )
    ).toBe(true);
  });

  it("normalizes both Viem account objects and plain connector addresses", () => {
    const address = "0x1111111111111111111111111111111111111111";

    expect(walletClientAccountAddress(address)).toBe(address);
    expect(walletClientAccountAddress({ address })).toBe(address);
    expect(walletClientAccountAddress(undefined)).toBeUndefined();
  });
});

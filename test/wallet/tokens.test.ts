import { beforeEach, describe, expect, it } from "vitest";

import { searchTokenList } from "@/lib/token-list";
import {
  loadWalletTokens,
  mergeWalletTokens,
  saveWalletTokens,
  walletTokenStorageKey,
} from "@/lib/wallet-tokens";

const aero = "0x940181a94A35A4569E4529A3CDfB74e38FD98631" as const;

describe("wallet token management", () => {
  beforeEach(() => window.localStorage.clear());

  it("searches the generated catalog by symbol and excludes existing assets", () => {
    expect(searchTokenList(8_453, "AERO")[0]).toMatchObject({
      address: aero,
      symbol: "AERO",
      decimals: 18,
    });
    expect(searchTokenList(8_453, "AERO", [aero])).toEqual([]);
  });

  it("persists custom selections without duplicating chain defaults", () => {
    saveWalletTokens(8_453, [
      ...loadWalletTokens(8_453),
      {
        address: aero,
        symbol: "AERO",
        name: "Aerodrome Finance",
        decimals: 18,
      },
    ]);

    const stored = JSON.parse(window.localStorage.getItem(walletTokenStorageKey(8_453)) ?? "[]");
    expect(stored).toHaveLength(1);
    expect(loadWalletTokens(8_453).map((token) => token.symbol)).toEqual(
      expect.arrayContaining(["USDC", "AERO"])
    );
  });

  it("ignores malformed persisted token metadata", () => {
    window.localStorage.setItem(
      walletTokenStorageKey(8_453),
      JSON.stringify([{ address: aero, symbol: "AERO", name: "AERO", decimals: "18" }])
    );
    expect(loadWalletTokens(8_453).some((token) => token.address === aero)).toBe(false);
  });

  it("merges a faucet token bundle without duplicating existing assets", () => {
    const current = loadWalletTokens(8_453);
    const additions = [
      {
        address: aero,
        symbol: "AERO",
        name: "Aerodrome Finance",
        decimals: 18,
      },
      current[0]!,
      {
        address: aero,
        symbol: "AERO",
        name: "Aerodrome Finance",
        decimals: 18,
      },
    ];

    const merged = mergeWalletTokens(current, additions);
    expect(merged).toHaveLength(current.length + 1);
    expect(
      merged.filter((token) => token.address.toLowerCase() === aero.toLowerCase())
    ).toHaveLength(1);
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import { loadSolanaTokens, saveSolanaTokens } from "@/lib/solana-tokens";

const jup = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";

describe("Solana wallet token management", () => {
  beforeEach(() => window.localStorage.clear());

  it("persists added mints alongside SOL and USDC defaults", () => {
    saveSolanaTokens([
      ...loadSolanaTokens(),
      {
        mint: jup,
        symbol: "JUP",
        name: "Jupiter",
        decimals: 6,
      },
    ]);
    expect(loadSolanaTokens().map((token) => token.symbol)).toEqual(["SOL", "USDC", "JUP"]);
  });

  it("rejects malformed persisted mint metadata", () => {
    window.localStorage.setItem(
      "statics:wallet:solana-tokens:mainnet",
      JSON.stringify([{ mint: "bad", symbol: "BAD", name: "Bad", decimals: 6 }])
    );
    expect(loadSolanaTokens().map((token) => token.symbol)).toEqual(["SOL", "USDC"]);
  });
});

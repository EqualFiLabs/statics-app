import { describe, expect, it } from "vitest";

import { explain, glossary, protocolTerm, term, termPlural, type TermKey } from "@/lib/vocabulary";

const keys = Object.keys(glossary) as TermKey[];

describe("vocabulary", () => {
  it("exposes a consumer label for every term", () => {
    for (const key of keys) {
      expect(term(key), key).toBeTruthy();
    }
  });

  it("falls back to a naive plural only when no explicit plural is given", () => {
    expect(termPlural("position")).toBe("Positions");
    expect(termPlural("basket")).toBe("Baskets");
    // Mass nouns opt out, so we never render "Collaterals" or "Liquiditys".
    expect(termPlural("collateral")).toBe("Collateral");
    expect(termPlural("liquidity")).toBe("Liquidity");
    expect(termPlural("rewards")).toBe("Rewards");
  });

  it("keeps the protocol term for every entry", () => {
    for (const key of keys) {
      expect(protocolTerm(key), key).toBeTruthy();
    }
  });

  it("explains every term in plain language", () => {
    for (const key of keys) {
      const plain = explain(key);
      expect(plain, key).toBeTruthy();
      expect(plain.endsWith("."), `${key} should read as a sentence`).toBe(true);
    }
  });

  it("never leaks implementation vocabulary into a consumer label", () => {
    // The point of the layer: these words describe how the protocol is built,
    // not what the user owns. They may appear in `protocol`, never in `label`.
    const implementationWords = [
      "nft",
      "canonical",
      "bilateral",
      "hook",
      "tranche",
      "permissionless",
      "oracle",
      "eip-",
      "diamond",
      "reconciled",
      "v4",
    ];
    for (const key of keys) {
      const label = term(key).toLowerCase();
      for (const word of implementationWords) {
        expect(label.includes(word), `"${term(key)}" (${key}) contains "${word}"`).toBe(false);
      }
    }
  });

  it("explains terms without falling back on the jargon it replaces", () => {
    // A definition that reuses the protocol term explains nothing.
    for (const key of keys) {
      const plain = explain(key).toLowerCase();
      for (const word of ["positionnft", "lp nft", "hook-owned", "tranche"]) {
        expect(plain.includes(word), `${key} definition leans on "${word}"`).toBe(false);
      }
    }
  });
});

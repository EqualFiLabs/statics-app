import { serializeSignature } from "viem";
import { describe, expect, it } from "vitest";

import {
  PERMIT_TTL_SECONDS,
  decodePermitSignature,
  exactPeggedMintPermitValue,
  permitDeadline,
} from "@/lib/dollar/permit";

describe("Dollar permit helpers", () => {
  it("uses a short block-timestamp deadline", () => {
    expect(permitDeadline(1_000n)).toBe(1_000n + PERMIT_TTL_SECONDS);
  });

  it("normalizes a wallet signature for the gateway ABI", () => {
    const signature = serializeSignature({
      r: `0x${"11".repeat(32)}`,
      s: `0x${"22".repeat(32)}`,
      yParity: 1,
    });
    expect(decodePermitSignature(2_000n, signature)).toEqual({
      deadline: 2_000n,
      v: 28,
      r: `0x${"11".repeat(32)}`,
      s: `0x${"22".repeat(32)}`,
    });
  });

  it("signs the fresh exact amount within the reviewed maximum", () => {
    expect(exactPeggedMintPermitValue(100n, 105n)).toBe(100n);
    expect(() => exactPeggedMintPermitValue(106n, 105n)).toThrow(
      "The required USDG moved above the reviewed maximum."
    );
  });
});

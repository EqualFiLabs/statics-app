import { describe, expect, it } from "vitest";

import { parseLocalControlCommand } from "../../scripts/lib/local-control.mjs";

describe("connected local fixture commands", () => {
  it("accepts only exact bounded wallet funding", () => {
    expect(
      parseLocalControlCommand("fund-wallet", [
        "0x1234567890abcdef1234567890abcdef12345678",
        "--eth",
        "5",
        "--weth",
        "25.5",
      ])
    ).toEqual({
      action: "fund-wallet",
      address: "0x1234567890AbcdEF1234567890aBcdef12345678",
      eth: "5",
      weth: "25.5",
    });

    expect(() =>
      parseLocalControlCommand("fund-wallet", [
        "0x1234567890abcdef1234567890abcdef12345678",
        "--eth",
        "1001",
      ])
    ).toThrow("cannot exceed");
    expect(() =>
      parseLocalControlCommand("fund-wallet", ["0x1234567890abcdef1234567890abcdef12345678"])
    ).toThrow("nonzero");
  });

  it("bounds deterministic time advancement", () => {
    expect(parseLocalControlCommand("advance", ["3600"])).toEqual({
      action: "advance",
      seconds: 3600,
    });
    expect(() => parseLocalControlCommand("advance", ["0"])).toThrow("positive");
    expect(() => parseLocalControlCommand("advance", ["31536001"])).toThrow("cannot exceed");
  });

  it("rejects arbitrary commands and status arguments", () => {
    expect(parseLocalControlCommand("status", [])).toEqual({ action: "status" });
    expect(() => parseLocalControlCommand("status", ["extra"])).toThrow("does not accept");
    expect(() => parseLocalControlCommand("send-calldata", ["0x"])).toThrow("Unknown");
  });

  it("parses bounded protocol fixture generation", () => {
    expect(parseLocalControlCommand("generate-rewards", ["12"])).toEqual({
      action: "generate-rewards",
      positionId: "12",
      shares: "0.1",
    });
    expect(parseLocalControlCommand("generate-lp-fees", ["12", "44", "--amount", "0.001"])).toEqual(
      {
        action: "generate-lp-fees",
        positionId: "12",
        tokenId: "44",
        amount: "0.001",
      }
    );
    expect(parseLocalControlCommand("seed-recovery", ["7"])).toEqual({
      action: "seed-recovery",
      loanId: "7",
    });
    expect(() => parseLocalControlCommand("generate-lp-fees", ["1", "2", "--amount", "1"])).toThrow(
      "up to 0.01"
    );
  });
});

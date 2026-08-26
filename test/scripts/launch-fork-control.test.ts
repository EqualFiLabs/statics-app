import { describe, expect, it } from "vitest";

import {
  LAUNCH_FORK_RPC_PORT,
  parseLaunchForkControl,
  validateLaunchForkCommand,
} from "@/scripts/lib/launch-fork-control.mjs";

const wallet = "0x1234567890abcdef1234567890abcdef12345678";

describe("launch fork controls", () => {
  it("uses the standard local Ethereum RPC port", () => {
    expect(LAUNCH_FORK_RPC_PORT).toBe(8_545);
  });

  it("accepts only bounded forward time advances", () => {
    expect(parseLaunchForkControl("advance-time", ["3600"])).toEqual({
      action: "advance-time",
      seconds: 3_600,
    });
    expect(() => parseLaunchForkControl("advance-time", ["0"])).toThrow("from 1 through");
    expect(() => parseLaunchForkControl("advance-time", ["-1"])).toThrow("from 1 through");
    expect(() => parseLaunchForkControl("advance-time", ["31536001"])).toThrow("31536000");
    expect(() => parseLaunchForkControl("advance-time", ["1", "2"])).toThrow("exactly one");
  });
  it("accepts only bounded typed wallet funding", () => {
    expect(
      parseLaunchForkControl("fund-wallet", [wallet, "--eth", "10", "--statics", "100000"])
    ).toEqual({
      action: "fund-wallet",
      wallet: "0x1234567890AbcdEF1234567890aBcdef12345678",
      eth: "10",
      weth: "0",
      statics: "100000",
    });
    expect(() => parseLaunchForkControl("fund-wallet", [wallet, "--eth", "1000001"])).toThrow(
      "no greater than"
    );
    expect(() => parseLaunchForkControl("fund-wallet", [wallet, "--target", wallet])).toThrow(
      "Unknown"
    );
    expect(() =>
      parseLaunchForkControl("fund-wallet", [wallet, "--eth", "1", "--eth", "2"])
    ).toThrow("only once");
  });

  it("accepts only bounded round-trip volume generation", () => {
    expect(parseLaunchForkControl("generate-volume", ["--eth", "2.5", "--cycles", "4"])).toEqual({
      action: "generate-volume",
      eth: "2.5",
      cycles: 4,
    });
    expect(() => parseLaunchForkControl("generate-volume", ["--eth", "1", "--to", wallet])).toThrow(
      "Unknown"
    );
    expect(() =>
      parseLaunchForkControl("generate-volume", ["--eth", "1", "--cycles", "1001"])
    ).toThrow("1 through 1000");
  });

  it("revalidates commands received over the local control socket", () => {
    expect(
      validateLaunchForkCommand({
        action: "fund-wallet",
        wallet,
        eth: "1",
        weth: "2",
        statics: "3",
      })
    ).toMatchObject({ action: "fund-wallet", eth: "1", weth: "2", statics: "3" });
    expect(validateLaunchForkCommand({ action: "advance-time", seconds: 60 })).toEqual({
      action: "advance-time",
      seconds: 60,
    });
    expect(() => validateLaunchForkCommand({ action: "status", target: wallet })).toThrow("fields");
    expect(() =>
      validateLaunchForkCommand({ action: "advance-time", seconds: 60, method: "evm_mine" })
    ).toThrow("fields");
    expect(() => validateLaunchForkCommand({ action: "arbitrary-call" })).toThrow("Unknown");
  });
});

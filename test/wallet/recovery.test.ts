import { describe, expect, it } from "vitest";

import { walletRecoveryAction, type WalletRuntimeStatus } from "@/providers/wallet-context";

describe("wallet recovery actions", () => {
  it.each([
    ["signed-out", "login"],
    ["error", "login"],
    ["wallet-missing", "create-wallet"],
    ["unconfigured", null],
    ["loading", null],
    ["ready", null],
  ] satisfies ReadonlyArray<
    readonly [WalletRuntimeStatus, ReturnType<typeof walletRecoveryAction>]
  >)("maps %s to %s", (status, expected) => {
    expect(walletRecoveryAction(status)).toBe(expected);
  });
});

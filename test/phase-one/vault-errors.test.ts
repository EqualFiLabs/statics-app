import { describe, expect, it } from "vitest";
import { encodeErrorResult, getAddress } from "viem";
import { genesisVaultErrorName, genesisVaultRecoveryErrors } from "@/lib/genesis/vault-errors";

describe("encoded Operator ownership recovery", () => {
  const wallet = getAddress(`0x${"1".repeat(40)}`);
  const newOwner = getAddress(`0x${"2".repeat(40)}`);
  it("recognizes a transfer before approval through the raw viem cause", () => {
    const data = encodeErrorResult({
      abi: genesisVaultRecoveryErrors,
      errorName: "ERC721InvalidApprover",
      args: [wallet],
    });
    expect(genesisVaultErrorName(new Error("CallExecutionError", { cause: { data } }))).toBe(
      "ERC721InvalidApprover"
    );
  });
  it("recognizes a transfer after approval through the raw viem cause", () => {
    const data = encodeErrorResult({
      abi: genesisVaultRecoveryErrors,
      errorName: "NotGenesisOwner",
      args: [7n, wallet, newOwner],
    });
    expect(
      genesisVaultErrorName(new Error("CallExecutionError", { cause: { cause: { data } } }))
    ).toBe("NotGenesisOwner");
  });
});

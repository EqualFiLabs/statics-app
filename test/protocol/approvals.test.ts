import { decodeFunctionData, getAddress, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";

import {
  basketTokenAbi,
  permit2AllowanceAbi,
  v4PositionManagerReadAbi,
} from "@statics-protocol/sdk";

import { buildApprovalUpdate, type ApprovalRecord } from "@/lib/protocol/approval-inventory";
import {
  MAX_ERC20_ALLOWANCE,
  MAX_PERMIT2_ALLOWANCE,
  MAX_PERMIT2_EXPIRATION,
  approvalStatusLabel,
  hasUsablePermit2Allowance,
  operatorApprovalAbi,
} from "@/lib/protocol/approvals";

const token = getAddress("0x0000000000000000000000000000000000000001");
const spender = getAddress("0x0000000000000000000000000000000000000002");
const permit2 = getAddress("0x0000000000000000000000000000000000000003");

function record(overrides: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    key: "approval",
    kind: "erc20",
    authorityContract: token,
    token,
    tokenName: "Token",
    tokenSymbol: "TKN",
    spender,
    spenderLabel: "StaticsDiamond",
    purposes: ["Basket minting"],
    allowance: 0n,
    ...overrides,
  };
}

describe("application approval policy", () => {
  it("recognizes maximum, custom, and revoked authority", () => {
    expect(approvalStatusLabel("erc20", 0n)).toBe("Revoked");
    expect(approvalStatusLabel("erc20", 5n)).toBe("Custom");
    expect(approvalStatusLabel("erc20", MAX_ERC20_ALLOWANCE)).toBe("Maximum");
    expect(approvalStatusLabel("permit2", MAX_PERMIT2_ALLOWANCE, MAX_PERMIT2_EXPIRATION)).toBe(
      "Maximum"
    );
    expect(approvalStatusLabel("permit2", 5n, 999, 1_000)).toBe("Revoked");
    expect(approvalStatusLabel("operator", 1n)).toBe("Maximum");
  });

  it("requires both sufficient Permit2 amount and an unexpired authorization", () => {
    expect(hasUsablePermit2Allowance(10n, 1_001, 10n, 1_000)).toBe(true);
    expect(hasUsablePermit2Allowance(9n, 1_001, 10n, 1_000)).toBe(false);
    expect(hasUsablePermit2Allowance(10n, 1_000, 10n, 1_000)).toBe(false);
  });

  it("builds maximum and zero ERC20 allowance updates", () => {
    const maximum = decodeFunctionData({
      abi: basketTokenAbi,
      data: buildApprovalUpdate(record(), true).data,
    });
    const revoked = decodeFunctionData({
      abi: basketTokenAbi,
      data: buildApprovalUpdate(record(), false).data,
    });

    expect(maximum).toMatchObject({
      functionName: "approve",
      args: [spender, MAX_ERC20_ALLOWANCE],
    });
    expect(revoked).toMatchObject({ functionName: "approve", args: [spender, 0n] });
  });

  it("builds maximum and zero Permit2 allowance updates", () => {
    const approval = record({
      kind: "permit2",
      authorityContract: permit2,
      expiration: 0,
    });
    const maximum = decodeFunctionData({
      abi: permit2AllowanceAbi,
      data: buildApprovalUpdate(approval, true).data,
    });
    const revoked = decodeFunctionData({
      abi: permit2AllowanceAbi,
      data: buildApprovalUpdate(approval, false).data,
    });

    expect(maximum).toMatchObject({
      functionName: "approve",
      args: [token, spender, MAX_PERMIT2_ALLOWANCE, MAX_PERMIT2_EXPIRATION],
    });
    expect(revoked).toMatchObject({
      functionName: "approve",
      args: [token, spender, 0n, 0],
    });
  });

  it("builds broad operator enable and revoke updates", () => {
    const approval = record({ kind: "operator" });
    const maximum = decodeFunctionData({
      abi: operatorApprovalAbi,
      data: buildApprovalUpdate(approval, true).data,
    });
    const revoked = decodeFunctionData({
      abi: operatorApprovalAbi,
      data: buildApprovalUpdate(approval, false).data,
    });

    expect(maximum).toMatchObject({
      functionName: "setApprovalForAll",
      args: [spender, true],
    });
    expect(revoked).toMatchObject({
      functionName: "setApprovalForAll",
      args: [spender, false],
    });
  });

  it("revokes legacy per-position v4 approvals", () => {
    const approval = record({ kind: "erc721-token", tokenId: 42n });
    const maximum = decodeFunctionData({
      abi: v4PositionManagerReadAbi,
      data: buildApprovalUpdate(approval, true).data,
    });
    const revoked = decodeFunctionData({
      abi: v4PositionManagerReadAbi,
      data: buildApprovalUpdate(approval, false).data,
    });

    expect(maximum).toMatchObject({ functionName: "approve", args: [spender, 42n] });
    expect(revoked).toMatchObject({ functionName: "approve", args: [zeroAddress, 42n] });
  });
});

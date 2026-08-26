import { decodeFunctionData, getAddress, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";

import {
  basketTokenAbi,
  permit2AllowanceAbi,
  v4PositionManagerReadAbi,
} from "@statics-protocol/sdk";

import {
  buildApprovalUpdate,
  launchApprovalDefinitions,
  type ApprovalRecord,
} from "@/lib/protocol/approval-inventory";
import type { LaunchDeployment } from "@/lib/deployments/types";
import {
  MAX_ERC20_ALLOWANCE,
  MAX_PERMIT2_ALLOWANCE,
  MAX_PERMIT2_EXPIRATION,
  approvalClockTimestamp,
  approvalStatusLabel,
  hasUsablePermit2Allowance,
  operatorApprovalAbi,
} from "@/lib/protocol/approvals";

const token = getAddress("0x0000000000000000000000000000000000000001");
const spender = getAddress("0x0000000000000000000000000000000000000002");
const permit2 = getAddress("0x0000000000000000000000000000000000000003");

const launchDeployment = {
  kind: "launch",
  descriptor: {
    deploymentId: "launch-fixture",
    label: "Genesis",
    network: "Fixture",
    chainId: 1,
    stage: "launch",
    capabilities: [],
    available: true,
  },
  deploymentStartBlock: 1n,
  protocolCommit: "fixture",
  source: "development-fixture",
  contracts: {
    statics: token,
    genesis: getAddress("0x0000000000000000000000000000000000000004"),
    vault: getAddress("0x0000000000000000000000000000000000000005"),
    activationRegistry: getAddress("0x0000000000000000000000000000000000000006"),
    feeReceiver: getAddress("0x0000000000000000000000000000000000000007"),
    launchDistributor: getAddress("0x0000000000000000000000000000000000000008"),
    weth: getAddress("0x0000000000000000000000000000000000000009"),
    poolManager: getAddress("0x000000000000000000000000000000000000000a"),
    stateView: getAddress("0x000000000000000000000000000000000000000b"),
    quoter: getAddress("0x000000000000000000000000000000000000000c"),
    universalRouter: spender,
    permit2,
  },
  runtimeCodeHashes: {},
  market: {
    poolId: `0x${"1".repeat(64)}`,
    poolKey: {
      currency0: token,
      currency1: getAddress("0x0000000000000000000000000000000000000009"),
      fee: 10_000,
      tickSpacing: 8,
      hooks: zeroAddress,
    },
  },
} as const satisfies LaunchDeployment;

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
  it("inventories only the standalone launch spenders for Genesis and trading", () => {
    const definitions = launchApprovalDefinitions(launchDeployment);
    expect(definitions).toHaveLength(6);
    expect(
      definitions.map(({ kind, tokenSymbol, spenderLabel }) => ({
        kind,
        tokenSymbol,
        spenderLabel,
      }))
    ).toEqual(
      expect.arrayContaining([
        { kind: "erc20", tokenSymbol: "STATICS", spenderLabel: "Genesis Vault" },
        {
          kind: "erc20",
          tokenSymbol: "STATICS",
          spenderLabel: "Genesis Activation Registry",
        },
        { kind: "erc20", tokenSymbol: "STATICS", spenderLabel: "Permit2" },
        { kind: "erc20", tokenSymbol: "WETH", spenderLabel: "Permit2" },
        {
          kind: "permit2",
          tokenSymbol: "STATICS",
          spenderLabel: "Uniswap Universal Router",
        },
        {
          kind: "permit2",
          tokenSymbol: "WETH",
          spenderLabel: "Uniswap Universal Router",
        },
      ])
    );
  });

  it("evaluates expiring approvals against the current clock", () => {
    expect(approvalClockTimestamp(new Date("2026-08-02T17:00:00.999Z"))).toBe(1_785_690_000);
  });

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

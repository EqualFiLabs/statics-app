import { describe, expect, it } from "vitest";
import {
  createPublicClient,
  encodeFunctionData,
  http,
  keccak256,
  parseAbi,
  type Address,
} from "viem";

import { encodeErc7821Batch, ERC_7821_BATCH_MODE } from "@/lib/genesis/atomic-batch";
import { ROBINHOOD_CALIBUR, ROBINHOOD_CALIBUR_CODE_HASH } from "@/lib/genesis/calibur";
import { robinhoodMainnet } from "@/lib/wallet-config";

const live = process.env.RUN_CALIBUR_READONLY === "1" ? describe : describe.skip;
const wallet = "0x4e313aE951E6F6982d2634Fd635537578B7e99f0" as Address;
const probe = "0x3CD55E2eB5633aC45ABA45E95EBF2D49257D9f2F" as Address;
const token = "0x3277Cfd7b479F70869e8C688c4F26f960A3DD05a" as Address;
const probeAbi = parseAbi([
  "function record() payable",
  "function checkAllowance(address token,address owner,uint256 expected) view",
  "function fail() pure",
  "function calls() view returns (uint256)",
]);
const tokenAbi = parseAbi([
  "function approve(address spender,uint256 amount) returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)",
]);
const executorAbi = parseAbi(["function supportsExecutionMode(bytes32 mode) view returns (bool)"]);

live("Robinhood Calibur read-only conformance", () => {
  const rpc = process.env.STATICS_ROBINHOOD_MAINNET_RPC_URL;
  const client = createPublicClient({ chain: robinhoodMainnet, transport: http(rpc) });
  const override = [{ address: wallet, code: `0xef0100${ROBINHOOD_CALIBUR.slice(2)}` as const }];

  it("pins implementation code and executes the owner/value/approval batch", async () => {
    if (!rpc) throw new Error("STATICS_ROBINHOOD_MAINNET_RPC_URL is required.");
    const code = await client.getCode({ address: ROBINHOOD_CALIBUR });
    expect(code && keccak256(code)).toBe(ROBINHOOD_CALIBUR_CODE_HASH);
    expect(
      await client.readContract({
        address: ROBINHOOD_CALIBUR,
        abi: executorAbi,
        functionName: "supportsExecutionMode",
        args: [ERC_7821_BATCH_MODE],
      })
    ).toBe(true);
    const callsBefore = await client.readContract({
      address: probe,
      abi: probeAbi,
      functionName: "calls",
    });
    const data = encodeErc7821Batch([
      {
        to: token,
        value: 0n,
        data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [probe, 7n] }),
      },
      {
        to: probe,
        value: 0n,
        data: encodeFunctionData({
          abi: probeAbi,
          functionName: "checkAllowance",
          args: [token, wallet, 7n],
        }),
      },
      {
        to: probe,
        value: 1n,
        data: encodeFunctionData({ abi: probeAbi, functionName: "record" }),
      },
      {
        to: token,
        value: 0n,
        data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [probe, 0n] }),
      },
    ]);
    await expect(
      client.call({ account: wallet, to: wallet, data, value: 1n, stateOverride: override })
    ).resolves.toBeDefined();
    expect(
      await client.readContract({ address: probe, abi: probeAbi, functionName: "calls" })
    ).toBe(callsBefore);
    expect(
      await client.readContract({
        address: token,
        abi: tokenAbi,
        functionName: "allowance",
        args: [wallet, probe],
      })
    ).toBe(0n);
  }, 30_000);

  it("receives ordinary ETH and reverts a batch whose last call fails", async () => {
    if (!rpc) throw new Error("STATICS_ROBINHOOD_MAINNET_RPC_URL is required.");
    await expect(
      client.call({ account: probe, to: wallet, value: 1n, stateOverride: override })
    ).resolves.toBeDefined();
    const failing = encodeErc7821Batch([
      {
        to: token,
        value: 0n,
        data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [probe, 9n] }),
      },
      {
        to: probe,
        value: 0n,
        data: encodeFunctionData({ abi: probeAbi, functionName: "fail" }),
      },
    ]);
    await expect(
      client.call({ account: wallet, to: wallet, data: failing, stateOverride: override })
    ).rejects.toThrow();
    expect(
      await client.readContract({
        address: token,
        abi: tokenAbi,
        functionName: "allowance",
        args: [wallet, probe],
      })
    ).toBe(0n);
  }, 30_000);
});

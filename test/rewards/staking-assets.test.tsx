import { decodeFunctionData, getAddress, zeroAddress, type PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import { staticsAbi } from "@statics-protocol/sdk/phase-one";
import { fireEvent, render, screen } from "@/test/render";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { stakingRewardAssetOptions, stakingRewardAssets } from "@/lib/rewards/staking-assets";
import {
  buildCreateAndStakeTransaction,
  buildPositionStakingTransaction,
} from "@/lib/phase-one/staking";
import { RewardAssetModal } from "@/components/rewards/RewardAssetModal";

const address = (digit: string) => getAddress(`0x${digit.repeat(40)}`);
const weth = address("a"),
  statics = address("2"),
  other = address("3");
const token = (address: `0x${string}`, symbol: string) => ({ address, symbol, name: symbol });
const deployment = {
  contracts: { diamond: address("1"), statics, weth },
  supportedPools: [
    { token0: token(zeroAddress, "ETH"), token1: token(statics, "STATICS") },
    { token0: token(weth, "WETH"), token1: token(other, "USDG") },
  ],
} as PhaseOneDeployment;

describe("ETH staking reward choice", () => {
  it("offers one ETH choice backed by WETH even with native and wrapped pools", () => {
    const options = stakingRewardAssetOptions(deployment);
    expect(options.filter((option) => option.symbol === "ETH")).toEqual([
      { address: weth, symbol: "ETH", name: "Ether" },
    ]);
    expect(
      options.some((option) => option.address === zeroAddress || option.symbol === "WETH")
    ).toBe(false);
    expect(options.find((option) => option.address === other)?.symbol).toBe("USDG");
  });

  it("offers ETH without a WETH pool and preserves held unknown reward assets", () => {
    const unknown = address("4");
    const options = stakingRewardAssetOptions({ ...deployment, supportedPools: [] }, [
      weth,
      unknown,
    ]);
    expect(options.filter((option) => option.address === weth)).toEqual([
      { address: weth, symbol: "ETH", name: "Ether" },
    ]);
    expect(options.some((option) => option.address === unknown)).toBe(true);
  });

  it("normalizes native and wrapped aliases once without modifying inputs", () => {
    const input = Object.freeze([zeroAddress, weth.toLowerCase() as `0x${string}`, other]);
    expect(stakingRewardAssets(deployment, input)).toEqual([weth.toLowerCase(), other]);
    expect(input[0]).toBe(zeroAddress);
  });

  it("selects ETH in the real modal and encodes WETH for the contract", () => {
    const onConfirm = vi.fn();
    render(
      <RewardAssetModal
        title="Rewards"
        options={stakingRewardAssetOptions(deployment)}
        initial={[]}
        maximum={12n}
        now={0n}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Ether\s*ETH/ }));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onConfirm).toHaveBeenCalledWith([weth]);
    const transaction = buildPositionStakingTransaction({
      deployment,
      positionId: 7n,
      action: { kind: "opt-in", assets: onConfirm.mock.calls[0][0] },
    });
    expect(decodeFunctionData({ abi: staticsAbi, data: transaction.calldata }).args).toEqual([
      7n,
      [weth],
    ]);
  });

  it("recognizes an existing WETH selection as checked ETH", () => {
    const onConfirm = vi.fn();
    render(
      <RewardAssetModal
        title="Rewards"
        options={stakingRewardAssetOptions(deployment, [weth])}
        initial={[weth.toLowerCase() as `0x${string}`]}
        maximum={12n}
        now={0n}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    const checkbox = screen.getByRole("checkbox", { name: /Ether\s*ETH/ });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onConfirm).toHaveBeenCalledWith([]);
  });

  it("normalizes ETH before reward opt-in calldata is built", () => {
    const transaction = buildPositionStakingTransaction({
      deployment,
      positionId: 7n,
      action: { kind: "opt-in", assets: [zeroAddress, weth, other] },
    });
    expect(decodeFunctionData({ abi: staticsAbi, data: transaction.calldata }).args).toEqual([
      7n,
      [weth, other],
    ]);
  });

  it("normalizes ETH before new-position limit validation and calldata", async () => {
    const readContract = vi
      .fn()
      .mockImplementation(({ functionName }) =>
        Promise.resolve(functionName === "positionCreationFee" ? 10n : 1n)
      );
    const transaction = await buildCreateAndStakeTransaction({
      deployment,
      publicClient: { readContract } as unknown as PublicClient,
      amount: 100n,
      receiver: other,
      rewardAssets: [zeroAddress, weth],
    });
    expect(decodeFunctionData({ abi: staticsAbi, data: transaction.calldata }).args).toEqual([
      100n,
      other,
      [weth],
    ]);
    expect(transaction.value).toBe(10n);
  });
});

import { describe, expect, it } from "vitest";
import {
  decodeAbiParameters,
  decodeFunctionData,
  getAddress,
  parseAbiParameters,
  parseAbi,
  zeroAddress,
} from "viem";
import { buildV4ExactInputSingleSwap as sdkSwap } from "@statics-protocol/sdk";
import { buildV4ExactInputSingleSwap } from "@/lib/trade/v4-execution";
import { buildV4ExactInputPathSwap } from "@/lib/trade/v4-path";
const token = getAddress(`0x${"3".repeat(40)}`),
  router = getAddress(`0x${"4".repeat(40)}`);
const request = {
  router,
  poolKey: { currency0: zeroAddress, currency1: token, fee: 3000, tickSpacing: 60, hooks: router },
  zeroForOne: true,
  amountIn: 100n,
  amountOutMinimum: 90n,
  deadline: 999n,
};
function plan(calldata: `0x${string}`) {
  const { args } = decodeFunctionData({
    abi: parseAbi(["function execute(bytes commands,bytes[] inputs,uint256 deadline) payable"]),
    data: calldata,
  });
  const [actions, params] = decodeAbiParameters(
    parseAbiParameters("bytes actions,bytes[] params"),
    args![1][0]!
  );
  return { commands: args![0], actions, params, deadline: args![2] };
}
describe("native pool execution", () => {
  it("settles ETH directly, sends exact value and retains the reviewed minimum", () => {
    const swap = buildV4ExactInputSingleSwap({
      ...request,
      settlement: { input: "native", output: "erc20" },
    });
    expect(swap.value).toBe(100n);
    const decoded = plan(swap.calldata);
    expect(decoded.commands).toBe("0x10");
    expect(decoded.actions).toBe("0x060b0f");
    expect(decoded.deadline).toBe(999n);
    expect(
      decodeAbiParameters(parseAbiParameters("address,uint256,bool"), decoded.params[1]!)
    ).toEqual([zeroAddress, 100n, false]);
    expect(decodeAbiParameters(parseAbiParameters("address,uint256"), decoded.params[2]!)).toEqual([
      token,
      90n,
    ]);
    const [exact] = decodeAbiParameters(
      parseAbiParameters(
        "((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,uint256 minHopPriceX36,bytes hookData)"
      ),
      decoded.params[0]!
    );
    expect(exact.amountOutMinimum).toBe(90n);
  });
  it("takes ETH output directly to the caller without an unwrap command", () => {
    const swap = buildV4ExactInputSingleSwap({
      ...request,
      zeroForOne: false,
      settlement: { input: "erc20", output: "native" },
    });
    expect(swap.value).toBe(0n);
    const decoded = plan(swap.calldata);
    expect(decoded.commands).toBe("0x10");
    expect(decoded.actions).toBe("0x060c0f");
    expect(decodeAbiParameters(parseAbiParameters("address,uint256"), decoded.params[2]!)).toEqual([
      zeroAddress,
      90n,
    ]);
  });
  it("retains SDK calldata for wrapped ETH input and output", () => {
    const poolKey = { ...request.poolKey, currency0: token, currency1: router };
    const forward = {
      ...request,
      poolKey,
      settlement: { input: "native", output: "erc20", wrappedNative: token } as const,
    };
    const reverse = {
      ...request,
      poolKey,
      zeroForOne: false,
      settlement: { input: "erc20", output: "native", wrappedNative: token } as const,
    };
    expect(buildV4ExactInputSingleSwap(forward)).toEqual(sdkSwap(forward));
    expect(buildV4ExactInputSingleSwap(reverse)).toEqual(sdkSwap(reverse));
  });
  it("rejects a native PoolKey with ERC-20 or wrapped settlement and invalid amounts", () => {
    expect(() =>
      buildV4ExactInputSingleSwap({ ...request, settlement: { input: "erc20", output: "erc20" } })
    ).toThrow("Native pool currency");
    expect(() =>
      buildV4ExactInputSingleSwap({
        ...request,
        settlement: { input: "native", output: "erc20", wrappedNative: token },
      })
    ).toThrow("settlement currency");
    expect(() =>
      buildV4ExactInputSingleSwap({
        ...request,
        amountIn: 0n,
        settlement: { input: "native", output: "erc20" },
      })
    ).toThrow("Invalid swap input");
    expect(() =>
      buildV4ExactInputSingleSwap({
        ...request,
        amountOutMinimum: -1n,
        settlement: { input: "native", output: "erc20" },
      })
    ).toThrow();
  });
  it("supports native input and output on multi-pool routes", () => {
    const path = [
      {
        poolId: `0x${"1".repeat(64)}` as const,
        intermediateCurrency: token,
        fee: 3000,
        tickSpacing: 60,
        hooks: router,
        reviewed: true,
      },
      {
        poolId: `0x${"2".repeat(64)}` as const,
        intermediateCurrency: router,
        fee: 3000,
        tickSpacing: 60,
        hooks: router,
        reviewed: true,
      },
    ];
    const input = buildV4ExactInputPathSwap({
      router,
      currencyIn: zeroAddress,
      path,
      amountIn: 100n,
      amountOutMinimum: 90n,
      deadline: 999n,
      settlement: { input: "native", output: "erc20" },
    });
    expect(input.value).toBe(100n);
    expect(plan(input.calldata)).toMatchObject({ commands: "0x10", actions: "0x070b0f" });
    const output = buildV4ExactInputPathSwap({
      router,
      currencyIn: router,
      path: [
        { ...path[0]!, intermediateCurrency: token },
        { ...path[1]!, intermediateCurrency: zeroAddress },
      ],
      amountIn: 100n,
      amountOutMinimum: 90n,
      deadline: 999n,
      settlement: { input: "erc20", output: "native" },
    });
    expect(output.value).toBe(0n);
    expect(plan(output.calldata)).toMatchObject({ commands: "0x10", actions: "0x070c0f" });
  });
});

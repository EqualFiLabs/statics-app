import { describe, expect, it, vi } from "vitest";
import {
  decodeAbiParameters,
  decodeFunctionData,
  encodeFunctionResult,
  getAddress,
  parseAbi,
  parseAbiParameters,
  type Address,
  type PublicClient,
} from "viem";
import {
  buildV4ExactInputPathSwap,
  candidatePaths,
  v4PathQuoterAbi,
  type PathPool,
} from "@/lib/trade/v4-path";
import { quoteSwapRoute, type DirectSwapRoute } from "@/lib/trade/swap-routing";

const t = (n: string) => getAddress(`0x${n.repeat(40)}`) as Address;
const [A, B, C, D] = [t("a"), t("b"), t("c"), t("d")];
const hook = t("4");
const pool = (id: string, x: Address, y: Address, reviewed = true): PathPool => ({
  poolId: `0x${id.repeat(64)}`,
  poolKey: {
    currency0: x.toLowerCase() < y.toLowerCase() ? x : y,
    currency1: x.toLowerCase() < y.toLowerCase() ? y : x,
    fee: 3000,
    tickSpacing: 60,
    hooks: hook,
  },
  swappable: true,
  reviewed,
});

describe("multi-pool paths", () => {
  it("finds two- and three-pool paths, fewest pools and reviewed pools first", () => {
    const pools = [
      pool("1", A, B),
      pool("2", B, D),
      pool("3", A, C, false),
      pool("4", C, D, false),
      pool("5", B, C),
    ];
    const paths = candidatePaths(A, D, pools);
    expect(paths.map((path) => path.map((hop) => hop.poolId.slice(2, 3)).join(""))).toEqual([
      "12",
      "34",
      "154",
      "352",
    ]);
    expect(paths[0]!.at(-1)!.intermediateCurrency).toBe(D);
    expect(candidatePaths(A, D, pools, 2)).toHaveLength(2);
  });
  it("never reuses a token, uses closed pools, or returns a single pool", () => {
    expect(candidatePaths(A, B, [pool("1", A, B)])).toEqual([]);
    expect(
      candidatePaths(A, D, [pool("1", A, B), { ...pool("2", B, D), swappable: false }])
    ).toEqual([]);
  });
});

describe("multi-pool router calldata", () => {
  const router = t("8");
  const path = candidatePaths(A, D, [pool("1", A, B), pool("2", B, D)])[0]!;
  const execute = parseAbi(["function execute(bytes commands, bytes[] inputs, uint256 deadline)"]);
  it("wraps native input, swaps with an empty per-pool price array and takes the output", () => {
    const swap = buildV4ExactInputPathSwap({
      router,
      currencyIn: A,
      path,
      amountIn: 10n,
      amountOutMinimum: 7n,
      deadline: 99n,
      settlement: { input: "native", output: "erc20", wrappedNative: A },
    });
    expect(swap.value).toBe(10n);
    const { args } = decodeFunctionData({ abi: execute, data: swap.calldata });
    expect(args[0]).toBe("0x0b10");
    const [actions, params] = decodeAbiParameters(
      parseAbiParameters("bytes actions,bytes[] params"),
      args[1][1]!
    );
    expect(actions).toBe("0x070b0f");
    const [exact] = decodeAbiParameters(
      parseAbiParameters(
        "(address currencyIn,(address intermediateCurrency,uint24 fee,int24 tickSpacing,address hooks,bytes hookData)[] path,uint256[] maxHopSlippage,uint128 amountIn,uint128 amountOutMinimum)"
      ),
      params[0]!
    );
    expect(exact.path.map((hop) => hop.intermediateCurrency)).toEqual([B, D]);
    expect(exact.maxHopSlippage).toEqual([]);
    expect(exact.amountOutMinimum).toBe(7n);
  });
  it("settles and takes all for tokens, and unwraps native output", () => {
    const erc20 = buildV4ExactInputPathSwap({
      router,
      currencyIn: A,
      path,
      amountIn: 10n,
      amountOutMinimum: 7n,
      deadline: 99n,
      settlement: { input: "erc20", output: "erc20" },
    });
    expect(decodeFunctionData({ abi: execute, data: erc20.calldata }).args[0]).toBe("0x10");
    const native = buildV4ExactInputPathSwap({
      router,
      currencyIn: A,
      path,
      amountIn: 10n,
      amountOutMinimum: 7n,
      deadline: 99n,
      settlement: { input: "erc20", output: "native", wrappedNative: D },
    });
    expect(decodeFunctionData({ abi: execute, data: native.calldata }).args[0]).toBe("0x100c");
    expect(() =>
      buildV4ExactInputPathSwap({
        router,
        currencyIn: A,
        path: path.slice(0, 1),
        amountIn: 10n,
        amountOutMinimum: 7n,
        deadline: 99n,
        settlement: { input: "erc20", output: "erc20" },
      })
    ).toThrow();
  });
});

describe("multi-pool quotes", () => {
  it("quotes every candidate, skips those that cannot fill and executes the best", async () => {
    const paths = candidatePaths(A, D, [
      pool("1", A, B),
      pool("2", B, D),
      pool("3", A, C),
      pool("4", C, D),
    ]);
    const outputs = [50n, null, 80n];
    let call = 0;
    const client = {
      call: vi.fn(async () => {
        const out = outputs[call++ % 2 === 0 ? 0 : 1];
        if (out === null) throw new Error("IncompleteSpecifiedFill");
        return {
          data: encodeFunctionResult({
            abi: v4PathQuoterAbi,
            functionName: "quoteExactInput",
            result: [out, 1n],
          }),
        };
      }),
    } as unknown as PublicClient;
    const route = {
      kind: "direct",
      inputToken: A,
      quoter: t("9"),
      paths,
    } as unknown as DirectSwapRoute;
    const best = await quoteSwapRoute(client, route, 10n, t("1"));
    expect(best.amountOut).toBe(50n);
    expect(best.path).toBe(paths[0]);
    const failing = {
      ...client,
      call: vi.fn(async () => {
        throw new Error("no");
      }),
    } as unknown as PublicClient;
    await expect(quoteSwapRoute(failing, route, 10n, t("1"))).rejects.toThrow("No swap quote");
  });
});

import { getAddress, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";

import {
  canonicalTradeDirection,
  settlementForTrade,
  tradeDirections,
  zeroForTrade,
} from "@/lib/trade/canonical-market";
import type { LaunchDeployment } from "@/lib/deployments/types";

const statics = getAddress("0x1111111111111111111111111111111111111111");
const weth = getAddress("0x7777777777777777777777777777777777777777");
const deployment = {
  kind: "launch",
  descriptor: {
    deploymentId: "fixture",
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
    statics,
    genesis: zeroAddress,
    vault: zeroAddress,
    activationRegistry: zeroAddress,
    feeReceiver: zeroAddress,
    launchDistributor: zeroAddress,
    weth,
    poolManager: zeroAddress,
    stateView: zeroAddress,
    quoter: zeroAddress,
    universalRouter: zeroAddress,
    permit2: zeroAddress,
  },
  runtimeCodeHashes: {},
  market: {
    poolId: `0x${"1".repeat(64)}`,
    poolKey: {
      currency0: statics,
      currency1: weth,
      fee: 10_000,
      tickSpacing: 8,
      hooks: zeroAddress,
    },
  },
} as const satisfies LaunchDeployment;

describe("canonical STATICS market", () => {
  it("offers native and wrapped buy and sell routes", () => {
    expect(tradeDirections).toEqual([
      { input: "eth", output: "statics" },
      { input: "weth", output: "statics" },
      { input: "statics", output: "weth" },
      { input: "statics", output: "eth" },
    ]);
  });

  it("selects direction from canonical currency order", () => {
    expect(zeroForTrade(deployment, "statics")).toBe(true);
    expect(zeroForTrade(deployment, "eth")).toBe(false);
    expect(zeroForTrade(deployment, "weth")).toBe(false);
  });

  it("routes only canonical STATICS pairs through the reviewed PoolKey", () => {
    expect(
      canonicalTradeDirection(
        deployment,
        { address: zeroAddress, kind: "native" },
        { address: statics, kind: "erc20" }
      )
    ).toEqual({ input: "eth", output: "statics" });
    expect(
      canonicalTradeDirection(
        deployment,
        { address: statics, kind: "erc20" },
        { address: weth, kind: "erc20" }
      )
    ).toEqual({ input: "statics", output: "weth" });
    expect(
      canonicalTradeDirection(
        deployment,
        { address: weth, kind: "erc20" },
        { address: zeroAddress, kind: "native" }
      )
    ).toBeNull();
  });

  it("uses router wrap and unwrap settlement only for native routes", () => {
    expect(settlementForTrade(deployment, tradeDirections[0]!)).toEqual({
      input: "native",
      output: "erc20",
      wrappedNative: weth,
    });
    expect(settlementForTrade(deployment, tradeDirections[1]!)).toEqual({
      input: "erc20",
      output: "erc20",
    });
    expect(settlementForTrade(deployment, tradeDirections[3]!)).toEqual({
      input: "erc20",
      output: "native",
      wrappedNative: weth,
    });
  });
});

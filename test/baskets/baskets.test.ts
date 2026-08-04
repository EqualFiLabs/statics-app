import { describe, expect, it } from "vitest";

import {
  deriveBasketActionAvailability,
  loadBasketCatalog,
  maximumWithSlippage,
  minimumWithSlippage,
  parseSlippageBps,
  validateBasketCollateralSimulation,
  validateBasketSimulation,
} from "@/lib/baskets/baskets";
import { BasketStatus, staticsAbi } from "@statics-protocol/sdk";
import { encodeFunctionResult, type Address, type PublicClient } from "viem";
import type { DollarDeployment } from "@/lib/dollar/deployment";

const constituent = (walletBalance: bigint, allowance: bigint) => ({
  walletBalance,
  allowance,
});
const diamond = "0x0000000000000000000000000000000000000010";
const basketToken = "0x0000000000000000000000000000000000000020";
const asset = "0x0000000000000000000000000000000000000030";
const hash = `0x${"11".repeat(32)}` as const;

describe("basket action safety", () => {
  it("applies rounded receiver and caller bounds", () => {
    expect(maximumWithSlippage(101n, 50)).toBe(102n);
    expect(minimumWithSlippage(101n, 50)).toBe(100n);
    expect(parseSlippageBps("0.50")).toBe(50);
    expect(parseSlippageBps("5.01")).toBeNull();
  });

  it("presents underlying approvals sequentially", () => {
    const availability = deriveBasketActionAvailability({
      mode: "mint",
      amount: 1n,
      status: BasketStatus.Active,
      quoteState: "ready",
      slippageBps: 50,
      walletBalance: 0n,
      constituents: [constituent(200n, 200n), constituent(300n, 0n)],
      quoteAmounts: [100n, 200n],
    });
    expect(availability).toMatchObject({
      kind: "approve",
      approvalIndex: 1,
      executable: true,
    });
  });

  it("blocks exposure increases outside active lifecycle", () => {
    expect(
      deriveBasketActionAvailability({
        mode: "mint",
        amount: 1n,
        status: BasketStatus.ExitOnly,
        quoteState: "ready",
        slippageBps: 50,
        walletBalance: 0n,
        constituents: [constituent(200n, 200n)],
        quoteAmounts: [100n],
      })
    ).toMatchObject({ kind: "blocked", label: "Mint unavailable" });
  });

  it("allows bounded redemptions from non-active states", () => {
    expect(
      deriveBasketActionAvailability({
        mode: "redeem",
        amount: 1n,
        status: BasketStatus.Quarantined,
        quoteState: "ready",
        slippageBps: 50,
        walletBalance: 1n,
        constituents: [],
        quoteAmounts: [100n],
      })
    ).toMatchObject({ kind: "execute", label: "Redeem basket" });
  });

  it("rejects successful simulations with zero underlying results", () => {
    const result = encodeFunctionResult({
      abi: staticsAbi,
      functionName: "redeem",
      result: [0n],
    });
    expect(() => validateBasketSimulation("redeem", result, 1)).toThrow(
      "invalid underlying amounts"
    );
  });

  it("accepts an auto-deposited mint that creates its own position", () => {
    const result = encodeFunctionResult({
      abi: staticsAbi,
      functionName: "createAndMintBasketCollateral",
      result: [7n, [100n, 200n]],
    });
    expect(validateBasketCollateralSimulation("createAndMintBasketCollateral", result, 2)).toEqual([
      100n,
      200n,
    ]);
  });

  it("rejects an auto-deposited mint that returns no position", () => {
    // A zero position id would mean the shares were minted with nowhere to
    // accrue rewards, which is the whole point of depositing them.
    const result = encodeFunctionResult({
      abi: staticsAbi,
      functionName: "createAndMintBasketCollateral",
      result: [0n, [100n]],
    });
    expect(() =>
      validateBasketCollateralSimulation("createAndMintBasketCollateral", result, 1)
    ).toThrow("invalid position");
  });

  it("holds a deposit into an existing position to the same bar as a plain mint", () => {
    const result = encodeFunctionResult({
      abi: staticsAbi,
      functionName: "mintBasketCollateral",
      result: [0n],
    });
    expect(() => validateBasketCollateralSimulation("mintBasketCollateral", result, 1)).toThrow(
      "invalid underlying amounts"
    );
  });

  it("reconciles current state when event history or metadata is incomplete", async () => {
    const deployment = {
      chainId: 31_337,
      deploymentStartBlock: 1n,
      wethProfileId: 1n,
      protocolCommit: "a".repeat(40),
      source: "development-environment",
      contracts: {
        diamond,
        core: diamond,
        gateway: diamond,
        dollar: asset,
        risk: diamond,
        weth: diamond,
        oracle: diamond,
      },
      runtimeCodeHashes: {
        diamond: hash,
        core: hash,
        gateway: hash,
        dollar: hash,
        risk: hash,
        weth: hash,
        oracle: hash,
      },
    } satisfies DollarDeployment;
    const publicClient = {
      getBlockNumber: async () => 100n,
      getContractEvents: async () => [],
      readContract: async ({
        address,
        functionName,
      }: {
        address: Address;
        functionName: string;
      }) => {
        if (functionName === "basketCount") return 1n;
        if (functionName === "basket") {
          return {
            token: basketToken,
            creator: diamond,
            status: BasketStatus.Active,
            assets: [asset],
            bundleAmounts: [1n],
            mintFeeTiers: [],
            redemptionFeeTiers: [],
            flashFeeBps: 0,
            originationFeeBps: 0,
            extensionFeeBps: 0,
            ltvBps: 0,
            loanDuration: 1,
          };
        }
        if (functionName === "name") {
          if (address === asset) throw new Error("missing");
          return "Local Basket";
        }
        if (functionName === "symbol") {
          if (address === asset) throw new Error("missing");
          return "LOCAL";
        }
        if (functionName === "decimals") {
          if (address === asset) throw new Error("missing");
          return 18;
        }
        if (functionName === "totalSupply") return 10n;
        if (functionName === "vaultBalance") return 5n;
        throw new Error(`Unexpected read ${functionName}`);
      },
    } as unknown as PublicClient;

    const catalog = await loadBasketCatalog(publicClient, deployment, null);
    expect(catalog.warning).toMatch(/event history is incomplete/i);
    expect(catalog.baskets[0].name).toBe("Local Basket");
    expect(catalog.baskets[0].constituents[0]).toMatchObject({
      vaultBalance: 5n,
      walletBalance: 0n,
      allowance: 0n,
      token: { address: asset, metadataAvailable: false, decimals: 18 },
    });
  });
});

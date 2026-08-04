import { fireEvent, render, screen } from "@/test/render";
import { describe, expect, it, vi } from "vitest";

import {
  LiquidityContributionForm,
  lpStakeEligibility,
  resolveLiquidityPool,
} from "@/components/liquidity/LiquidityPage";
import {
  basketLiquiditySnapshot,
  borrowedLiquidityDeadline,
  borrowedLiquidityReadiness,
  canonicalFullRange,
  canonicalPoolLabel,
  liquidityWalletBalances,
  liquidityActivationWait,
  liquidityPositionActions,
  maximumWalletLiquidityInput,
  quoteWalletLiquidity,
  recommendedLiquidityAction,
  v4PoolId,
  type CanonicalPoolRecord,
  type LpPositionRecord,
} from "@/lib/liquidity/liquidity";
import type { BasketRecord } from "@/lib/baskets/baskets";

const Q96 = 1n << 96n;
const unit = 10n ** 18n;
const basketAddress = "0x0000000000000000000000000000000000000002" as const;
const assetAddress = "0x0000000000000000000000000000000000000001" as const;

const basketToken = {
  address: basketAddress,
  name: "Test Pool Asset",
  symbol: "TPA1",
  decimals: 18,
  metadataAvailable: true,
};
const assetToken = {
  address: assetAddress,
  name: "Test Asset",
  symbol: "TST",
  decimals: 18,
  metadataAvailable: true,
};

function contributionPool(): CanonicalPoolRecord {
  return {
    basketId: 1n,
    basketName: "Test Pool",
    basketSymbol: "TPA1",
    basketToken,
    asset: assetToken,
    poolId: `0x${"11".repeat(32)}`,
    key: {
      currency0: assetAddress,
      currency1: basketAddress,
      fee: 0,
      tickSpacing: 10,
      hooks: "0x0000000000000000000000000000000000000003",
    },
    sqrtPriceX96: Q96,
  } as unknown as CanonicalPoolRecord;
}

describe("canonical liquidity identifiers", () => {
  it("anchors borrowed-liquidity deadlines to chain time", () => {
    expect(borrowedLiquidityDeadline(1_000n)).toBe(2_200n);
  });

  it("derives a stable pool ID from the complete canonical key", () => {
    const key = {
      currency0: "0x0000000000000000000000000000000000000001" as const,
      currency1: "0x0000000000000000000000000000000000000002" as const,
      fee: 0,
      tickSpacing: 10,
      hooks: "0x0000000000000000000000000000000000000003" as const,
    };
    expect(v4PoolId(key)).toBe(v4PoolId({ ...key }));
    expect(v4PoolId({ ...key, tickSpacing: 20 })).not.toBe(v4PoolId(key));
  });

  it("marks canonical pools live unless they have been decommissioned", () => {
    expect(canonicalPoolLabel(false)).toBe("active");
    expect(canonicalPoolLabel(true)).toBe("exit-only");
  });

  it("requires an active unsubscribed full-range NFT before staking", () => {
    const pool = {
      poolId: `0x${"11".repeat(32)}`,
      decommissioned: false,
      managerSynced: true,
      key: { tickSpacing: 10 },
    } as unknown as CanonicalPoolRecord;
    const [tickLower, tickUpper] = canonicalFullRange(10);
    const position = {
      poolId: pool.poolId,
      tickLower,
      tickUpper,
      hasSubscriber: false,
      liquidity: 1n,
    } as LpPositionRecord;
    expect(lpStakeEligibility(position, pool)).toBeNull();
    expect(lpStakeEligibility({ ...position, hasSubscriber: true }, pool)).toMatch(/Subscribed/);
    expect(lpStakeEligibility({ ...position, tickLower: tickLower + 10 }, pool)).toMatch(
      /full-range/
    );
    expect(lpStakeEligibility(position, { ...pool, decommissioned: true })).toMatch(/live/);
  });

  it("derives defaults and keeps management on the selected NFT's pool", () => {
    const firstPool = {
      poolId: `0x${"11".repeat(32)}`,
    } as CanonicalPoolRecord;
    const positionPool = {
      poolId: `0x${"22".repeat(32)}`,
    } as CanonicalPoolRecord;
    const position = {
      poolId: positionPool.poolId,
    } as LpPositionRecord;

    expect(resolveLiquidityPool("create", [firstPool, positionPool], "", position)).toBe(firstPool);
    expect(resolveLiquidityPool("stake", [firstPool, positionPool], "", position)).toBe(
      positionPool
    );
  });

  it("builds the borrow quote snapshot from chain-reconciled basket data", () => {
    const basket = {
      basketId: 7n,
      status: 1,
      totalSupply: 1_000n,
      token: { address: "0x0000000000000000000000000000000000000001" },
      mintFeeTiers: [],
      redemptionFeeTiers: [],
      originationFeeBps: 100,
      extensionFeeBps: 25,
      ltvBps: 7_500,
      recoveryPenaltyBps: 500,
      constituents: [
        {
          token: { address: "0x0000000000000000000000000000000000000002" },
          bundleAmount: 5n,
          vaultBalance: 9n,
        },
      ],
    } as unknown as BasketRecord;
    expect(basketLiquiditySnapshot(basket)).toMatchObject({
      basketId: 7n,
      totalSupply: 1_000n,
      originationFeeBps: 100n,
      extensionFeeBps: 25n,
      ltvBps: 7_500n,
      recoveryPenaltyBps: 500n,
      constituents: [
        {
          asset: "0x0000000000000000000000000000000000000002",
          bundleAmount: 5n,
          vaultBalance: 9n,
        },
      ],
    });
  });

  it("requires every canonical pool and a bounded positive liquidity input", () => {
    const basket = {
      constituents: [{}, {}],
    } as unknown as BasketRecord;
    const readyPool = {
      poolId: `0x${"11".repeat(32)}`,
      decommissioned: false,
      managerSynced: true,
    } as CanonicalPoolRecord;
    const secondPool = {
      ...readyPool,
      poolId: `0x${"22".repeat(32)}`,
    } as CanonicalPoolRecord;

    expect(borrowedLiquidityReadiness(basket, [readyPool], {})).toMatch(/Every basket/);
    expect(
      borrowedLiquidityReadiness(basket, [readyPool, secondPool], {
        [readyPool.poolId]: "1",
        [secondPool.poolId]: "0",
      })
    ).toMatch(/positive raw liquidity/);
    expect(
      borrowedLiquidityReadiness(basket, [{ ...readyPool, managerSynced: false }, secondPool], {
        [readyPool.poolId]: "1",
        [secondPool.poolId]: "1",
      })
    ).toMatch(/live and synced/);
    expect(
      borrowedLiquidityReadiness(basket, [readyPool, secondPool], {
        [readyPool.poolId]: "1",
        [secondPool.poolId]: "2",
      })
    ).toBeNull();
  });

  it("reveals liquidity actions from the selected NFT state", () => {
    const walletOwned = { staked: false } as LpPositionRecord;
    const waiting = {
      staked: true,
      pendingLiquidity: 10n,
      eligibleAtBlock: 101n,
    } as LpPositionRecord;
    const ready = { ...waiting, eligibleAtBlock: 100n } as LpPositionRecord;

    expect(liquidityPositionActions(walletOwned, 100n)).toEqual(["stake"]);
    expect(liquidityPositionActions(waiting, 100n)).toEqual(["increase", "claim", "unstake"]);
    expect(liquidityActivationWait(waiting, 100n)).toBe(1n);
    expect(liquidityPositionActions(ready, 100n)).toEqual([
      "activate",
      "increase",
      "claim",
      "unstake",
    ]);
    expect(liquidityActivationWait(ready, 100n)).toBeNull();
    expect(recommendedLiquidityAction(ready, 100n)).toBe("activate");
  });

  it("maps basket and constituent balances into pool currency order", () => {
    const basket = {
      basketId: 1n,
      token: basketToken,
      walletBalance: 80n * unit,
      constituents: [{ token: assetToken, walletBalance: 25n * unit }],
    } as unknown as BasketRecord;

    expect(liquidityWalletBalances(contributionPool(), [basket])).toEqual([25n * unit, 80n * unit]);
  });

  it("quotes the paired maximum and a buffered executable deposit from one asset", () => {
    const quote = quoteWalletLiquidity(contributionPool(), 1, 100n * unit);

    expect(quote).not.toBeNull();
    expect(quote?.selectedIndex).toBe(1);
    expect(quote?.maximumAmounts[1]).toBe(100n * unit);
    expect(quote?.maximumAmounts[0]).toBeGreaterThan(0n);
    expect(quote?.estimatedAmounts[0]).toBeLessThanOrEqual(quote!.maximumAmounts[0]);
    expect(quote?.estimatedAmounts[1]).toBeLessThan(quote!.maximumAmounts[1]);
  });

  it("makes Max executable by both balances and reports the limiting side", () => {
    const pool = contributionPool();
    const balances = [20n * unit, 100n * unit] as const;
    const maximum = maximumWalletLiquidityInput(pool, balances, 1);

    expect(maximum).not.toBeNull();
    expect(maximum?.limitingIndex).toBe(0);
    const quote = quoteWalletLiquidity(pool, 1, maximum!.inputAmount);
    expect(quote?.maximumAmounts[0]).toBeLessThanOrEqual(balances[0]);
    expect(quote?.maximumAmounts[1]).toBeLessThanOrEqual(balances[1]);
  });

  it("preserves the quoted position size when the input asset switches", () => {
    const pool = contributionPool();
    const basketQuote = quoteWalletLiquidity(pool, 1, 100n * unit);
    const assetQuote = quoteWalletLiquidity(pool, 0, basketQuote!.maximumAmounts[0]);

    expect(assetQuote?.liquidity).toBe(basketQuote?.liquidity);
    expect(assetQuote?.maximumAmounts).toEqual(basketQuote?.maximumAmounts);
  });

  it("rejects zero and uint128-overflowing single-asset requests", () => {
    const pool = contributionPool();
    expect(quoteWalletLiquidity(pool, 0, 0n)).toBeNull();
    expect(quoteWalletLiquidity(pool, 0, 1n << 128n)).toBeNull();
  });
});

describe("single-input liquidity contribution", () => {
  it("surfaces the paired requirement, balances, switch, and Max actions", () => {
    const onSwitch = vi.fn();
    const onMax = vi.fn();
    const quote = {
      selectedIndex: 1 as const,
      liquidity: 1n,
      estimatedAmounts: [995n * unit, 1_990n * unit] as const,
      maximumAmounts: [1_000n * unit, 2_000n * unit] as const,
    };
    render(
      <LiquidityContributionForm
        tokens={[assetToken, basketToken]}
        balances={[1_000n * unit, 2_000n * unit]}
        selectedIndex={1}
        amountInput="2000"
        quote={quote}
        maxLimitedBy={0}
        pending={false}
        onAmountChange={vi.fn()}
        onSwitch={onSwitch}
        onMax={onMax}
      />
    );

    expect(screen.getByRole("textbox", { name: "Maximum TPA1" })).toHaveValue("2000");
    expect(screen.getByText("Up to 1,000 TST")).toBeInTheDocument();
    expect(screen.getAllByText("Sufficient")).toHaveLength(2);
    expect(screen.getByText(/limited by your TST balance/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use TST as the input asset" }));
    fireEvent.click(screen.getByRole("button", { name: "Max" }));
    expect(onSwitch).toHaveBeenCalledOnce();
    expect(onMax).toHaveBeenCalledOnce();
  });

  it("shows the exact counterpart shortfall", () => {
    render(
      <LiquidityContributionForm
        tokens={[assetToken, basketToken]}
        balances={[900n * unit, 2_000n * unit]}
        selectedIndex={1}
        amountInput="2000"
        quote={{
          selectedIndex: 1,
          liquidity: 1n,
          estimatedAmounts: [995n * unit, 1_990n * unit],
          maximumAmounts: [1_000n * unit, 2_000n * unit],
        }}
        maxLimitedBy={null}
        pending={false}
        onAmountChange={vi.fn()}
        onSwitch={vi.fn()}
        onMax={vi.fn()}
      />
    );

    expect(screen.getByText("Needs 100 more")).toBeInTheDocument();
    expect(screen.getAllByText("Sufficient")).toHaveLength(1);
  });
});

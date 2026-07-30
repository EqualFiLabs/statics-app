import { BasketStatus } from "@statics-protocol/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, PublicClient } from "viem";

import type { BasketRecord } from "@/lib/baskets/baskets";
import type { DollarDeployment } from "@/lib/dollar/deployment";
import {
  deriveLoanActionAvailability,
  hasExtensionExcess,
  isCurrentBorrowQuote,
  isCurrentExtensionQuote,
  loadBorrowQuote,
  loadExtensionQuote,
  loadLoanCatalog,
  loanTimeline,
  readBorrowDestination,
  validateExtensionGrossAmounts,
} from "@/lib/loans/loans";
import type { PositionCatalog } from "@/lib/positions/positions";

const mocks = vi.hoisted(() => ({
  loadPositionCatalog: vi.fn(),
}));

vi.mock("@/lib/positions/positions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/positions/positions")>();
  return { ...actual, loadPositionCatalog: mocks.loadPositionCatalog };
});

const wallet = "0x0000000000000000000000000000000000000001" as Address;
const diamond = "0x0000000000000000000000000000000000000002" as Address;
const basketToken = "0x0000000000000000000000000000000000000003" as Address;
const asset = "0x0000000000000000000000000000000000000004" as Address;
const secondAsset = "0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0" as Address;

const basket = {
  basketId: 0n,
  name: "Reserve Basket",
  symbol: "RSV",
  token: {
    address: basketToken,
    name: "Reserve Basket",
    symbol: "RSV",
    decimals: 18,
    metadataAvailable: true,
  },
  creator: wallet,
  status: BasketStatus.Active,
  totalSupply: 100n,
  walletBalance: 0n,
  constituents: [
    {
      token: {
        address: asset,
        name: "Asset",
        symbol: "AST",
        decimals: 6,
        metadataAvailable: true,
      },
      bundleAmount: 1_000_000n,
      vaultBalance: 100_000_000n,
      walletBalance: 20_000_000n,
      allowance: 10_000_000n,
    },
    {
      token: {
        address: secondAsset,
        name: "Second Asset",
        symbol: "TWO",
        decimals: 18,
        metadataAvailable: true,
      },
      bundleAmount: 1n,
      vaultBalance: 100n,
      walletBalance: 20n,
      allowance: 10n,
    },
  ],
  mintFeeTiers: [],
  redemptionFeeTiers: [],
  flashFeeBps: 0,
  originationFeeBps: 100,
  extensionFeeBps: 25,
  ltvBps: 9_000,
  loanDuration: 86_400,
  recoveryPenaltyBps: 500,
} satisfies BasketRecord;

const deployment = {
  chainId: 31_337,
  deploymentStartBlock: 1n,
  protocolCommit: "a".repeat(40),
  source: "development-environment",
  wethProfileId: 1n,
  contracts: {
    diamond,
    core: diamond,
    gateway: diamond,
    dollar: diamond,
    risk: diamond,
    weth: diamond,
    oracle: diamond,
  },
  runtimeCodeHashes: {
    diamond: `0x${"11".repeat(32)}`,
    core: `0x${"11".repeat(32)}`,
    gateway: `0x${"11".repeat(32)}`,
    dollar: `0x${"11".repeat(32)}`,
    risk: `0x${"11".repeat(32)}`,
    weth: `0x${"11".repeat(32)}`,
    oracle: `0x${"11".repeat(32)}`,
  },
} satisfies DollarDeployment;

describe("loan lifecycle state", () => {
  it("accepts only the supported borrow destination hint", () => {
    expect(readBorrowDestination("liquidity")).toBe("liquidity");
    expect(readBorrowDestination(["wallet", "liquidity"])).toBe("wallet");
    expect(readBorrowDestination("somewhere-else")).toBe("wallet");
  });
  beforeEach(() => {
    mocks.loadPositionCatalog.mockReset();
  });

  it("uses the protocol's strict maturity and recovery boundaries", () => {
    expect(loanTimeline(1_000n, 1_000n)).toBe("active");
    expect(loanTimeline(1_000n, 1_001n)).toBe("grace");
    expect(loanTimeline(1_000n, 4_600n)).toBe("grace");
    expect(loanTimeline(1_000n, 4_601n)).toBe("recoverable");
  });

  it("rejects placeholder quotes that belong to a previous selection", () => {
    const borrowQuote = {
      basketId: 1n,
      sharesIn: 10n,
      feeShares: 1n,
      collateralShares: 9n,
      debtShares: 8n,
      penaltyShares: 1n,
      assets: [asset],
      principals: [7n],
    };
    const extensionQuote = { loanId: 4n, assets: [asset], requiredFees: [2n] };

    expect(isCurrentBorrowQuote(borrowQuote, 1n, 10n)).toBe(true);
    expect(isCurrentBorrowQuote(borrowQuote, 2n, 10n)).toBe(false);
    expect(isCurrentExtensionQuote(extensionQuote, 4n)).toBe(true);
    expect(isCurrentExtensionQuote(extensionQuote, 5n)).toBe(false);
  });

  it("requires extension gross inputs to cover every exact quote amount", () => {
    expect(validateExtensionGrossAmounts([5n, 7n], [5n, 7n])).toBeNull();
    expect(validateExtensionGrossAmounts([0n], [0n])).toBeNull();
    expect(validateExtensionGrossAmounts([6n, 7n], [5n, 7n])).toBeNull();
    expect(hasExtensionExcess([6n, 7n], [5n, 7n])).toBe(true);
    expect(validateExtensionGrossAmounts([4n, 7n], [5n, 7n])).toContain(
      "below the current required fee"
    );
    expect(validateExtensionGrossAmounts([5n], [5n, 7n])).toContain("one gross");
  });

  it("sequences one exact asset approval before repayment execution", () => {
    expect(
      deriveLoanActionAvailability({
        mode: "repay",
        quoteState: "ready",
        timeline: "active",
        walletOwned: true,
        requirements: [5n, 7n],
        balances: [10n, 10n],
        allowances: [5n, 6n],
      })
    ).toMatchObject({
      kind: "approve",
      approvalIndex: 1,
      label: "Approve asset 2",
    });
    expect(
      deriveLoanActionAvailability({
        mode: "repay",
        quoteState: "ready",
        timeline: "active",
        walletOwned: true,
        requirements: [5n, 7n],
        balances: [10n, 10n],
        allowances: [5n, 7n],
      })
    ).toMatchObject({ kind: "execute", label: "Repay loan" });
  });

  it("blocks premature recovery and extension after maturity", () => {
    expect(
      deriveLoanActionAvailability({
        mode: "recover",
        quoteState: "ready",
        timeline: "grace",
        walletOwned: false,
      })
    ).toMatchObject({ kind: "blocked", label: "Recovery unavailable" });
    expect(
      deriveLoanActionAvailability({
        mode: "extend",
        quoteState: "ready",
        timeline: "grace",
        walletOwned: true,
      })
    ).toMatchObject({ kind: "blocked", label: "Extension unavailable" });
  });

  it("reconciles originated loans against closure events and current ownership", async () => {
    const positionCatalog = {
      positions: [
        {
          positionId: 17n,
          collateral: [],
        },
      ],
      baskets: [basket],
    } as unknown as PositionCatalog;
    mocks.loadPositionCatalog.mockResolvedValue(positionCatalog);

    const getContractEvents = vi.fn(async ({ eventName }: { eventName: string }) => {
      if (eventName === "LoanOriginated") {
        return [{ args: { loanId: 1n } }, { args: { loanId: 2n } }, { args: { loanId: 3n } }];
      }
      if (eventName === "LoanRepaid") return [{ args: { loanId: 2n } }];
      return [] as { args: { loanId: bigint } }[];
    });
    const readContract = vi.fn(
      async ({ functionName, args }: { functionName: string; args?: readonly unknown[] }) => {
        if (functionName === "loan") {
          const loanId = args?.[0] as bigint;
          return {
            positionId: loanId === 1n ? 17n : 99n,
            basketId: 0n,
            collateralShares: 90n,
            feeShares: 1n,
            maturity: loanId === 1n ? 6_000n : 1_000n,
            assets: [asset, secondAsset],
            principals: [75n, 65n],
          };
        }
        if (functionName === "ownerOf") {
          return (args?.[0] as bigint) === 17n
            ? wallet
            : "0x0000000000000000000000000000000000000099";
        }
        if (functionName === "balanceOf") return 100n;
        if (functionName === "allowance") return 50n;
        throw new Error(`Unexpected read ${functionName}`);
      }
    );
    const catalog = await loadLoanCatalog(
      {
        getContractEvents,
        readContract,
        getBlock: vi.fn().mockResolvedValue({ number: 100n, timestamp: 5_000n }),
      } as unknown as PublicClient,
      deployment,
      wallet
    );

    expect(catalog.ownedLoans.map((loan) => loan.loanId)).toEqual([1n]);
    expect(catalog.ownedLoans[0]?.assets.map((loanAsset) => loanAsset.token.address)).toEqual([
      asset,
      secondAsset,
    ]);
    expect(catalog.publicRecoverableLoans.map((loan) => loan.loanId)).toEqual([3n]);
    expect(readContract).not.toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "loan", args: [2n] })
    );
  });

  it("preserves canonical addresses across multi-asset borrow and extension quotes", async () => {
    const publicClient = {
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === "quoteBorrow") {
          return {
            feeShares: 1n,
            collateralShares: 99n,
            debtShares: 90n,
            penaltyShares: 5n,
            assets: [asset, secondAsset],
            principals: [45n, 45n],
          };
        }
        if (functionName === "quoteExtension") {
          return [
            [asset, secondAsset],
            [2n, 3n],
          ] as const;
        }
        throw new Error(`Unexpected read ${functionName}`);
      }),
    } as unknown as PublicClient;

    await expect(loadBorrowQuote(publicClient, deployment, 0n, 100n)).resolves.toMatchObject({
      assets: [asset, secondAsset],
    });
    await expect(loadExtensionQuote(publicClient, deployment, 1n)).resolves.toEqual({
      loanId: 1n,
      assets: [asset, secondAsset],
      requiredFees: [2n, 3n],
    });
  });

  it("fails closed when an active loan read fails for a reason other than closure", async () => {
    mocks.loadPositionCatalog.mockResolvedValue({
      positions: [],
      baskets: [basket],
    } as unknown as PositionCatalog);
    const publicClient = {
      getContractEvents: vi.fn(async ({ eventName }: { eventName: string }) =>
        eventName === "LoanOriginated" ? [{ args: { loanId: 8n } }] : []
      ),
      getBlock: vi.fn().mockResolvedValue({ number: 100n, timestamp: 5_000n }),
      readContract: vi.fn().mockRejectedValue(new Error("RPC unavailable")),
    } as unknown as PublicClient;

    await expect(loadLoanCatalog(publicClient, deployment, wallet)).rejects.toThrow(
      "RPC unavailable"
    );
  });
});

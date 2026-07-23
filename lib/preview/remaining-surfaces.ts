export type PreviewLoanTimeline = "active" | "grace" | "recoverable";

export type PreviewLoanTranche = {
  id: string;
  positionId: string;
  basketId: string;
  basketSymbol: string;
  collateralShares: string;
  feeShares: string;
  maturityLabel: string;
  recoveryLabel: string;
  maturity: number;
  recoverableAt: number;
  principals: readonly { symbol: string; amount: string; usd: string }[];
};

export type PreviewBasketAsset = {
  address: `0x${string}`;
  symbol: string;
  amount: string;
};

export type PreviewBasketDraft = {
  name: string;
  symbol: string;
  assets: readonly PreviewBasketAsset[];
  mintFeeTiers: readonly { threshold: string; feeShares: string }[];
  redemptionFeeTiers: readonly { threshold: string; feeShares: string }[];
  flashFeeBps: number;
  originationFeeBps: number;
  extensionFeeBps: number;
  ltvBps: number;
  loanDurationDays: number;
  creationFee: string;
};

export type PreviewLiquidityPool = {
  id: string;
  pair: string;
  basket: string;
  status: "active" | "warmup" | "exit-only";
  observation: string;
  managerSync: string;
  nativeLpFee: string;
  hookFees: string;
  pendingPol: string;
  lockedPol: string;
};

export type PreviewLpPosition = {
  tokenId: string;
  positionId: string;
  pair: string;
  liquidity: string;
  eligibleLiquidity: string;
  pendingLiquidity: string;
  activation: string;
  state: "wallet-owned" | "activation-pending" | "active";
  claimable0: string;
  claimable1: string;
};

export const PREVIEW_PROTOCOL_TIME = 1_753_315_200;

export const previewLoans: readonly PreviewLoanTranche[] = [
  {
    id: "84",
    positionId: "1042",
    basketId: "0",
    basketSymbol: "sRESERVE",
    collateralShares: "1,050.00",
    feeShares: "2.50",
    maturityLabel: "12d 6h remaining",
    recoveryLabel: "Recovery opens 1h after maturity",
    maturity: PREVIEW_PROTOCOL_TIME + 1_058_400,
    recoverableAt: PREVIEW_PROTOCOL_TIME + 1_062_000,
    principals: [
      { symbol: "WETH", amount: "0.164", usd: "$630.08" },
      { symbol: "Dollar", amount: "620.00", usd: "$620.00" },
      { symbol: "USDC", amount: "410.00", usd: "$410.00" },
      { symbol: "WBTC", amount: "0.0038", usd: "$258.40" },
    ],
  },
  {
    id: "79",
    positionId: "1042",
    basketId: "1",
    basketSymbol: "sBLUE",
    collateralShares: "420.00",
    feeShares: "1.20",
    maturityLabel: "Matured 24m ago",
    recoveryLabel: "Grace ends in 36m",
    maturity: PREVIEW_PROTOCOL_TIME - 1_440,
    recoverableAt: PREVIEW_PROTOCOL_TIME + 2_160,
    principals: [
      { symbol: "WETH", amount: "0.072", usd: "$276.64" },
      { symbol: "Dollar", amount: "188.00", usd: "$188.00" },
    ],
  },
  {
    id: "61",
    positionId: "744",
    basketId: "0",
    basketSymbol: "sRESERVE",
    collateralShares: "300.00",
    feeShares: "0.75",
    maturityLabel: "Matured 3h ago",
    recoveryLabel: "Permissionless recovery available",
    maturity: PREVIEW_PROTOCOL_TIME - 10_800,
    recoverableAt: PREVIEW_PROTOCOL_TIME - 7_200,
    principals: [
      { symbol: "WETH", amount: "0.041", usd: "$157.52" },
      { symbol: "Dollar", amount: "144.00", usd: "$144.00" },
    ],
  },
] as const;

export const previewBasketDraft: PreviewBasketDraft = {
  name: "Balanced Reserve",
  symbol: "sBAL",
  assets: [
    {
      address: "0xA11cE00000000000000000000000000000000001",
      symbol: "WETH",
      amount: "0.250",
    },
    {
      address: "0xA11cE00000000000000000000000000000000002",
      symbol: "Dollar",
      amount: "500.00",
    },
    {
      address: "0xA11cE00000000000000000000000000000000003",
      symbol: "USDC",
      amount: "500.00",
    },
    {
      address: "0xA11cE00000000000000000000000000000000004",
      symbol: "WBTC",
      amount: "0.005",
    },
  ],
  mintFeeTiers: [
    { threshold: "0", feeShares: "0.10" },
    { threshold: "10,000", feeShares: "0.06" },
  ],
  redemptionFeeTiers: [
    { threshold: "0", feeShares: "0.15" },
    { threshold: "10,000", feeShares: "0.08" },
  ],
  flashFeeBps: 5,
  originationFeeBps: 25,
  extensionFeeBps: 10,
  ltvBps: 7_500,
  loanDurationDays: 30,
  creationFee: "0.020 ETH · $76.84 sample value",
};

export const previewLiquidityPools: readonly PreviewLiquidityPool[] = [
  {
    id: "0x7f1a…ae20",
    pair: "sRESERVE / WETH",
    basket: "#0 · Dollar Reserve",
    status: "active",
    observation: "Healthy · 42 observations",
    managerSync: "Synced at sample block 18,442,019",
    nativeLpFee: "0.00%",
    hookFees: "0.30% input · 0.10% output",
    pendingPol: "18.42 WETH · $70,768 sample",
    lockedPol: "421,840 liquidity units",
  },
  {
    id: "0x49c2…bf11",
    pair: "sBLUE / Dollar",
    basket: "#1 · Blue Chip Index",
    status: "warmup",
    observation: "Warm-up · 18m remaining",
    managerSync: "Synced at sample block 18,442,014",
    nativeLpFee: "0.00%",
    hookFees: "0.30% input · 0.10% output",
    pendingPol: "4,280 Dollar · $4,280 sample",
    lockedPol: "96,220 liquidity units",
  },
] as const;

export const previewLpPositions: readonly PreviewLpPosition[] = [
  {
    tokenId: "4821",
    positionId: "1042",
    pair: "sRESERVE / WETH",
    liquidity: "84,220",
    eligibleLiquidity: "84,220",
    pendingLiquidity: "0",
    activation: "Active",
    state: "active",
    claimable0: "22.84 sRESERVE",
    claimable1: "0.0184 WETH",
  },
  {
    tokenId: "4907",
    positionId: "1042",
    pair: "sBLUE / Dollar",
    liquidity: "22,500",
    eligibleLiquidity: "0",
    pendingLiquidity: "22,500",
    activation: "Eligible next block",
    state: "activation-pending",
    claimable0: "0 sBLUE",
    claimable1: "0 Dollar",
  },
  {
    tokenId: "5012",
    positionId: "981",
    pair: "sRESERVE / WETH",
    liquidity: "12,840",
    eligibleLiquidity: "0",
    pendingLiquidity: "0",
    activation: "Wallet-owned · not staked",
    state: "wallet-owned",
    claimable0: "0 sRESERVE",
    claimable1: "0 WETH",
  },
] as const;

export function previewLoanTimeline(
  loan: Pick<PreviewLoanTranche, "maturity" | "recoverableAt">,
  protocolTime = PREVIEW_PROTOCOL_TIME
): PreviewLoanTimeline {
  if (protocolTime <= loan.maturity) return "active";
  if (protocolTime <= loan.recoverableAt) return "grace";
  return "recoverable";
}

export function validatePreviewBasketDraft(draft: PreviewBasketDraft): readonly string[] {
  const issues: string[] = [];
  if (!draft.name.trim() || !draft.symbol.trim()) issues.push("Name and symbol are required.");
  if (draft.assets.length < 1 || draft.assets.length > 16) {
    issues.push("A basket must contain between 1 and 16 constituents.");
  }
  if (
    new Set(draft.assets.map((asset) => asset.address.toLowerCase())).size !== draft.assets.length
  ) {
    issues.push("Constituent addresses must be unique.");
  }
  if (draft.assets.some((asset) => !asset.amount || Number(asset.amount) <= 0)) {
    issues.push("Every constituent requires a positive bundle amount.");
  }
  if (draft.loanDurationDays <= 0) issues.push("Loan duration must be positive.");
  if (draft.ltvBps < 0 || draft.ltvBps > 9_500) issues.push("LTV cannot exceed 95%.");
  for (const fee of [draft.flashFeeBps, draft.originationFeeBps, draft.extensionFeeBps]) {
    if (fee < 0 || fee > 10_000) issues.push("Fee values must remain within protocol bounds.");
  }
  return issues;
}

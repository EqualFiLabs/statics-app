export const DOLLAR_MINT_PAUSE = 1n << 0n;
/** PairingVaultFacet.PAUSE_PAIRING_FILLS -- pausable without pausing minting. */
export const DOLLAR_PAIRING_FILL_PAUSE = 1n << 2n;

export type DollarActionMode = "deposit" | "recombine" | "redeem" | "supply" | "unsupply";
export type DollarCollateralChoice = "ETH" | "WETH";
export type DollarQuoteState = "idle" | "refreshing" | "ready" | "error";

export type DollarActionSnapshot = Readonly<{
  profileKind: number;
  profileMode: number;
  seniorOutstanding: bigint;
  debtCeiling: bigint;
  seriesStatus: number;
  oracleAvailable: boolean;
  healthy: boolean;
  globalHealthPhase: number;
  pausedOperations: bigint;
  nativeBalance: bigint;
  wethBalance: bigint;
  dollarBalance: bigint;
  riskBalance: bigint;
  wethAllowance: bigint;
  dollarAllowance: bigint;
  riskApproved: boolean;
  /** Dollar approved to the periphery, which pulls it on redeem. */
  peripheryDollarAllowance: bigint;
  /** Dollar the opt-in book can currently fill. Zero means no exit today. */
  redeemableLiquidity: bigint;
  /** True when pairing fills are paused independently of minting. */
  pairingFillsPaused: boolean;
}>;

export type DollarActionAvailability = Readonly<{
  kind:
    | "needs-input"
    | "blocked"
    | "refreshing"
    | "approve-weth"
    | "approve-dollar"
    | "approve-dollar-periphery"
    | "approve-risk"
    | "approve-risk-periphery"
    | "stake"
    | "opt-in"
    | "opt-out"
    | "withdraw"
    | "execute";
  label: string;
  reason: string | null;
  executable: boolean;
}>;

export type DeriveDollarActionInput = Readonly<{
  mode: DollarActionMode;
  asset: DollarCollateralChoice;
  amount: bigint;
  snapshot: DollarActionSnapshot;
  quoteState: DollarQuoteState;
  quoteError?: string | null;
  quotedDollarAmount?: bigint;
}>;

export function dollarQuoteQueryKey({
  chainId,
  mode,
  amount,
  seriesId,
}: {
  chainId: number;
  mode: DollarActionMode;
  amount: bigint;
  seriesId?: bigint;
}) {
  return ["dollar-quote", chainId, mode, amount.toString(), seriesId?.toString()] as const;
}

function unavailable(label: string, reason: string): DollarActionAvailability {
  return { kind: "blocked", label, reason, executable: false };
}

export function deriveDollarActionAvailability({
  mode,
  asset,
  amount,
  snapshot,
  quoteState,
  quoteError,
  quotedDollarAmount,
}: DeriveDollarActionInput): DollarActionAvailability {
  if (amount <= 0n) {
    return {
      kind: "needs-input",
      label: mode === "deposit" ? `Enter ${asset} amount` : "Enter Dollar amount",
      reason: null,
      executable: false,
    };
  }

  if (mode === "deposit") {
    if (snapshot.profileKind !== 0) {
      return unavailable(
        "Deposit unavailable",
        "The configured profile is not a volatile profile."
      );
    }
    if (snapshot.profileMode !== 1) {
      return unavailable("Deposit unavailable", "The WETH profile is not active.");
    }
    if ((snapshot.pausedOperations & DOLLAR_MINT_PAUSE) !== 0n) {
      return unavailable("Deposit unavailable", "Dollar minting is currently paused.");
    }
    if (!snapshot.oracleAvailable) {
      return unavailable("Deposit unavailable", "The WETH oracle is currently unavailable.");
    }
    if (!snapshot.healthy) {
      return unavailable("Deposit unavailable", "The WETH profile is currently impaired.");
    }
    if (snapshot.seriesStatus !== 1) {
      return unavailable("Deposit unavailable", "The active Risk series cannot accept deposits.");
    }
    if (asset === "ETH" && amount >= snapshot.nativeBalance) {
      return unavailable(
        "Deposit unavailable",
        "Leave enough ETH in this wallet to pay the network fee."
      );
    }
    if (asset === "WETH" && amount > snapshot.wethBalance) {
      return unavailable("Deposit unavailable", "This wallet does not have enough WETH.");
    }
  } else if (mode === "redeem") {
    // Redeeming spends somebody else's opted-in Risk shares, so the only thing
    // this wallet needs is Dollar -- that is the whole point of the route.
    if (snapshot.seriesStatus !== 1) {
      return unavailable("Redemption unavailable", "The Risk series is not currently active.");
    }
    if (snapshot.pairingFillsPaused) {
      return unavailable("Redemption unavailable", "Dollar redemption is currently paused.");
    }
    if (snapshot.globalHealthPhase !== 0) {
      return unavailable(
        "Redemption unavailable",
        "Global protocol health currently prevents collateral exits."
      );
    }
    if (amount > snapshot.dollarBalance) {
      return unavailable("Redemption unavailable", "This wallet does not have enough Dollar.");
    }
    if (snapshot.redeemableLiquidity === 0n) {
      return unavailable(
        "No redemption liquidity",
        "Nobody has opted Risk shares in for this series yet. Recombine instead, or wait."
      );
    }
  } else {
    if (![1, 2, 3, 4].includes(snapshot.seriesStatus)) {
      return unavailable(
        "Recombination unavailable",
        "This Risk series can no longer be recombined."
      );
    }
    if (snapshot.globalHealthPhase !== 0) {
      return unavailable(
        "Recombination unavailable",
        "Global protocol health currently prevents collateral exits."
      );
    }
    if (amount > snapshot.dollarBalance) {
      return unavailable("Recombination unavailable", "This wallet does not have enough Dollar.");
    }
    if (amount > snapshot.riskBalance) {
      return unavailable(
        "Recombination unavailable",
        "This wallet does not have enough matching Risk shares."
      );
    }
  }

  if (quoteState === "error") {
    return unavailable(
      mode === "deposit"
        ? "Deposit unavailable"
        : mode === "redeem"
          ? "Redemption unavailable"
          : "Recombination unavailable",
      quoteError || "The protocol could not produce a current preview."
    );
  }
  if (quoteState !== "ready") {
    return {
      kind: "refreshing",
      label: quoteState === "idle" ? "Load preview" : "Refreshing preview…",
      reason: "Wait for a current onchain preview.",
      executable: false,
    };
  }

  if (
    mode === "deposit" &&
    quotedDollarAmount !== undefined &&
    snapshot.seniorOutstanding + quotedDollarAmount > snapshot.debtCeiling
  ) {
    return unavailable(
      "Deposit unavailable",
      "This deposit would exceed the WETH profile debt ceiling."
    );
  }

  if (mode === "deposit" && asset === "WETH" && snapshot.wethAllowance < amount) {
    return {
      kind: "approve-weth",
      label: "Enable WETH deposits",
      reason: null,
      executable: true,
    };
  }
  // The periphery pulls the Dollar on redeem, so the approval targets it
  // rather than the gateway that mint and recombine use.
  if (mode === "redeem" && snapshot.peripheryDollarAllowance < amount) {
    return {
      kind: "approve-dollar-periphery",
      label: "Enable Dollar redemptions",
      reason: null,
      executable: true,
    };
  }
  if (mode === "recombine" && snapshot.dollarAllowance < amount) {
    return {
      kind: "approve-dollar",
      label: "Enable Dollar recombination",
      reason: null,
      executable: true,
    };
  }
  if (mode === "recombine" && !snapshot.riskApproved) {
    return {
      kind: "approve-risk",
      label: "Approve Risk operator",
      reason: null,
      executable: true,
    };
  }

  return {
    kind: "execute",
    label:
      mode === "deposit"
        ? `Deposit ${asset}`
        : mode === "redeem"
          ? `Redeem for ${asset}`
          : `Recombine to ${asset}`,
    reason: null,
    executable: true,
  };
}

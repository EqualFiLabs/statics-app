export const DOLLAR_MINT_PAUSE = 1n << 0n;

export type DollarActionMode = "deposit" | "recombine";
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
}>;

export type DollarActionAvailability = Readonly<{
  kind:
    | "needs-input"
    | "blocked"
    | "refreshing"
    | "approve-weth"
    | "approve-dollar"
    | "approve-risk"
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
      mode === "deposit" ? "Deposit unavailable" : "Recombination unavailable",
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

  if (mode === "deposit" && asset === "WETH" && snapshot.wethAllowance !== amount) {
    return {
      kind: "approve-weth",
      label: "Approve exact WETH",
      reason: null,
      executable: true,
    };
  }
  if (mode === "recombine" && snapshot.dollarAllowance !== amount) {
    return {
      kind: "approve-dollar",
      label: "Approve exact Dollar",
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
    label: mode === "deposit" ? `Deposit ${asset}` : `Recombine to ${asset}`,
    reason: null,
    executable: true,
  };
}

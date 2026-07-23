export type DappRoutePresentation = {
  label: string;
  status: string;
  title: string;
  description: string;
};

const routePresentations = {
  overview: {
    label: "Overview",
    status: "Portfolio view",
    title: "Track your Statics portfolio.",
    description:
      "Review Dollar balances, PositionNFTs, basket collateral, pending rewards, and protocol readiness from one wallet-scoped view.",
  },
  dollar: {
    label: "Dollar",
    status: "Dollar flows",
    title: "Issue and redeem Statics Dollar.",
    description:
      "Deposit ETH or WETH into the active profile, or recombine Dollar and Risk shares using fresh protocol quotes before signing.",
  },
  baskets: {
    label: "Baskets",
    status: "Basket flows",
    title: "Inspect, mint, and redeem static baskets.",
    description:
      "Discover basket creation events, reconcile current protocol state, and enforce bounded constituent flows before signing.",
  },
  positions: {
    label: "Positions",
    status: "Position flows",
    title: "Manage each wallet-owned PositionNFT.",
    description:
      "Reconcile ownership from current onchain state, then manage collateral, staking, and reward selections with bounded transactions.",
  },
  loans: {
    label: "Loans",
    status: "Loan portfolio",
    title: "Review independent loan tranches.",
    description:
      "Inspect principal vectors, locked collateral, maturity, extension fees, and permissionless recovery timing per PositionNFT obligation.",
  },
  rewards: {
    label: "Rewards",
    status: "Reward flows",
    title: "Create stake positions with selected rewards.",
    description:
      "Choose fee assets per PositionNFT, inspect pending amounts, and respect the onchain unstaking cooldown.",
  },
  liquidity: {
    label: "Liquidity",
    status: "Canonical pools",
    title: "Manage canonical v4 liquidity.",
    description:
      "Separate hook-owned permanent liquidity from user LP NFTs, then review eligibility, activation, bilateral rewards, and exits.",
  },
  create: {
    label: "Create basket",
    status: "Permissionless creation",
    title: "Configure a new static basket.",
    description:
      "Review constituents, bundle amounts, fee tiers, lending parameters, and the exact creation fee before signing.",
  },
  activity: {
    label: "Activity",
    status: "Activity view",
    title: "Review protocol activity.",
    description:
      "Follow wallet-scoped actions from simulation through confirmation, replacement, rejection, or onchain failure.",
  },
  settings: {
    label: "Settings",
    status: "Wallet controls",
    title: "Manage your Statics wallet.",
    description:
      "Review the active account, network, wallet type, explorer destination, export guidance, and Statics-only session controls.",
  },
} as const satisfies Record<string, DappRoutePresentation>;

export function getDappRoutePresentation(pathname: string): DappRoutePresentation {
  if (pathname.startsWith("/app/dollar")) return routePresentations.dollar;
  if (pathname.startsWith("/app/baskets")) return routePresentations.baskets;
  if (pathname.startsWith("/app/create")) return routePresentations.create;
  if (pathname.startsWith("/app/positions")) return routePresentations.positions;
  if (pathname.startsWith("/app/loans")) return routePresentations.loans;
  if (pathname.startsWith("/app/rewards")) return routePresentations.rewards;
  if (pathname.startsWith("/app/liquidity")) return routePresentations.liquidity;
  if (pathname.startsWith("/app/activity")) return routePresentations.activity;
  if (pathname.startsWith("/app/settings")) return routePresentations.settings;
  return routePresentations.overview;
}

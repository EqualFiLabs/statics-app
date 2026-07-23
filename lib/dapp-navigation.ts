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
  rewards: {
    label: "Rewards",
    status: "Reward flows",
    title: "Create stake positions with selected rewards.",
    description:
      "Choose fee assets per PositionNFT, inspect pending amounts, and respect the onchain unstaking cooldown.",
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
  if (pathname.startsWith("/app/positions")) return routePresentations.positions;
  if (pathname.startsWith("/app/rewards")) return routePresentations.rewards;
  if (pathname.startsWith("/app/activity")) return routePresentations.activity;
  if (pathname.startsWith("/app/settings")) return routePresentations.settings;
  return routePresentations.overview;
}

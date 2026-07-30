export type DappRoutePresentation = {
  label: string;
  status: string;
  title: string;
  description: string;
};

export function isDappOverviewPath(pathname: string): boolean {
  return pathname === "/app" || pathname === "/app/";
}

/**
 * Route copy, written for someone who has not read the protocol docs.
 *
 * Titles say what you can do here, in a verb. Descriptions say what you get,
 * in one sentence, without naming a contract. See lib/vocabulary.ts for which
 * words are translated and which are deliberately kept.
 */
const routePresentations = {
  overview: {
    label: "Overview",
    status: "Portfolio",
    title: "Your portfolio",
    description:
      "Everything you hold in one place: your Dollar balance, positions, collateral, and rewards waiting to be claimed.",
  },
  dollar: {
    label: "Dollar",
    status: "Dollar",
    title: "Get Statics Dollar",
    description:
      "Deposit ETH to receive Dollar, or convert your Dollar and risk shares back into ETH. You will see the exact amounts before you confirm.",
  },
  wallet: {
    label: "Wallet",
    status: "Wallet",
    title: "Your wallet",
    description:
      "Check your balances, add funds, send assets, and move money in and out of Statics.",
  },
  portal: {
    label: "Add funds",
    status: "Add funds",
    title: "Add funds to Statics",
    description:
      "Bring money in from another network or another token. Swap, bridge, or convert to Statics Dollar.",
  },
  baskets: {
    label: "Baskets",
    status: "Baskets",
    title: "Baskets",
    description:
      "Buy or sell a fixed bundle of assets as one unit. You will see exactly what a basket holds before you buy.",
  },
  positions: {
    label: "Positions",
    status: "Positions",
    title: "Your positions",
    description:
      "Each position holds your baskets, loans, and Dollar together. Manage collateral, staking, and rewards from here.",
  },
  loans: {
    label: "Loans",
    status: "Loans",
    title: "Your loans",
    description:
      "Money you have borrowed against locked collateral. Review what you owe, what is locked, and when each loan is due.",
  },
  rewards: {
    label: "Rewards",
    status: "Rewards",
    title: "Your rewards",
    description:
      "Stake a position to earn a share of protocol fees. Pick which assets to earn in and claim what you have built up.",
  },
  liquidity: {
    label: "Liquidity",
    status: "Liquidity",
    title: "Provide liquidity",
    description:
      "Supply assets so other people can trade, and earn a share of the trading fees. Review your pools and what they have earned.",
  },
  create: {
    label: "Launch policy",
    status: "Governed",
    title: "Basket launch policy",
    description:
      "Public basket creation is closed during the testnet beta. Review how governed launches work and browse the baskets already available.",
  },
  activity: {
    label: "Activity",
    status: "Activity",
    title: "Your activity",
    description:
      "Every action from this wallet, from the moment you confirm it to the moment it settles.",
  },
  settings: {
    label: "Settings",
    status: "Settings",
    title: "Settings",
    description: "Your account, network, and wallet details, plus how to export your keys.",
  },
  tools: {
    label: "Tools",
    status: "Tools",
    title: "Approval tools",
    description: "Review and revoke the permissions this wallet has granted to Statics.",
  },
} as const satisfies Record<string, DappRoutePresentation>;

export function getDappRoutePresentation(pathname: string): DappRoutePresentation {
  if (pathname.startsWith("/app/wallet")) return routePresentations.wallet;
  if (pathname.startsWith("/app/portal")) return routePresentations.portal;
  if (pathname.startsWith("/app/dollar")) return routePresentations.dollar;
  if (pathname.startsWith("/app/baskets")) return routePresentations.baskets;
  if (pathname.startsWith("/app/create")) return routePresentations.create;
  if (pathname.startsWith("/app/positions")) return routePresentations.positions;
  if (pathname.startsWith("/app/loans")) return routePresentations.loans;
  if (pathname.startsWith("/app/rewards")) return routePresentations.rewards;
  if (pathname.startsWith("/app/liquidity")) return routePresentations.liquidity;
  if (pathname.startsWith("/app/activity")) return routePresentations.activity;
  if (pathname.startsWith("/app/settings")) return routePresentations.settings;
  if (pathname.startsWith("/app/tools")) return routePresentations.tools;
  return routePresentations.overview;
}

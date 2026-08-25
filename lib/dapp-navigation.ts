import type { DeploymentCapability, DeploymentDescriptor } from "@/lib/deployments/types";

export type DappRouteCapability = DeploymentCapability;

/** Exact runtime route policy; unknown paths intentionally return null. */
export function getDappRouteCapability(pathname: string): DappRouteCapability | null {
  if (pathname === "/app" || pathname === "/app/") return "overview";
  if (pathname === "/app/swap") return "canonical-statics-market";
  if (pathname === "/app/genesis") return "genesis-vault";
  if (pathname === "/app/wallet" || pathname === "/app/portal") return "wallet";
  if (pathname === "/app/activity") return "activity";
  if (pathname === "/app/tools") return "approval-tools";
  if (pathname === "/app/dollar") return "dollar";
  if (pathname === "/app/baskets" || pathname.startsWith("/app/baskets/")) return "baskets";
  if (pathname === "/app/create") return "baskets";
  if (pathname === "/app/positions" || pathname.startsWith("/app/positions/")) return "positions";
  if (pathname === "/app/loans") return "loans";
  if (pathname === "/app/rewards") return "protocol-rewards";
  if (pathname === "/app/liquidity") return "protocol-liquidity";
  if (pathname === "/app/faucet") return "faucet";
  return null;
}

export function isDappRouteAllowed(pathname: string, descriptor: DeploymentDescriptor): boolean {
  const capability = getDappRouteCapability(pathname);
  if (capability === null) return true;
  if (descriptor.stage === "full-protocol") return true;
  return (
    capability === "overview" ||
    capability === "canonical-statics-market" ||
    capability === "genesis-vault" ||
    capability === "wallet" ||
    capability === "activity" ||
    capability === "approval-tools"
  );
}
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
  swap: {
    label: "Swap",
    status: "STATICS market",
    title: "Swap tokens and Genesis NFTs",
    description:
      "Buy or sell STATICS through its official pool, then exchange STATICS for a fully backed Genesis NFT.",
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
  faucet: {
    label: "Faucet",
    status: "Testnet",
    title: "Get testnet assets",
    description:
      "Claim the fixtures used by Statics or open Robinhood's faucet for more testnet ETH and stock tokens.",
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
      "Mint or redeem a fixed bundle of assets as one unit. You will see exactly what a basket holds before you mint.",
  },
  positions: {
    label: "Position NFT",
    status: "Position NFT",
    title: "Your Position NFTs",
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
  genesis: {
    label: "Genesis NFT",
    status: "Genesis NFT",
    title: "Manage your Genesis NFTs",
    description:
      "Activate a Genesis NFT with a STATICS treasury payment, manage secured credit, and later link it to a Position for additional reward weight.",
  },
  liquidity: {
    label: "Liquidity",
    status: "Liquidity",
    title: "Provide liquidity",
    description:
      "Supply assets so other people can trade, and earn a share of the trading fees. Review your pools and what they have earned.",
  },
  create: {
    label: "Create basket",
    status: "Create",
    title: "Launch an index basket",
    description:
      "Choose a fixed asset bundle, fund its trading pools, and earn the creator share of its swap fees.",
  },
  activity: {
    label: "Activity",
    status: "Activity",
    title: "Your activity",
    description:
      "Every action from this wallet, from the moment you confirm it to the moment it settles.",
  },
  tools: {
    label: "Tools",
    status: "Tools",
    title: "Approval tools",
    description: "Review and revoke the permissions this wallet has granted to Statics.",
  },
} as const satisfies Record<string, DappRoutePresentation>;

export type DappRouteId = keyof typeof routePresentations;

export function getDappRouteId(pathname: string): DappRouteId {
  if (pathname.startsWith("/app/swap")) return "swap";
  if (pathname.startsWith("/app/wallet")) return "wallet";
  if (pathname.startsWith("/app/faucet")) return "faucet";
  if (pathname.startsWith("/app/portal")) return "portal";
  if (pathname.startsWith("/app/dollar")) return "dollar";
  if (pathname.startsWith("/app/baskets")) return "baskets";
  if (pathname.startsWith("/app/create")) return "create";
  if (pathname.startsWith("/app/positions")) return "positions";
  if (pathname.startsWith("/app/loans")) return "loans";
  if (pathname.startsWith("/app/rewards")) return "rewards";
  if (pathname.startsWith("/app/genesis")) return "genesis";
  if (pathname.startsWith("/app/liquidity")) return "liquidity";
  if (pathname.startsWith("/app/activity")) return "activity";
  if (pathname.startsWith("/app/tools")) return "tools";
  return "overview";
}

export function getDappRoutePresentation(pathname: string): DappRoutePresentation {
  return routePresentations[getDappRouteId(pathname)];
}

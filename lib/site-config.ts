export type AppEnvironment = "development" | "staging" | "production";

export type SiteNavigationItem =
  | { label: string; messageKey: string; kind: "anchor" | "route"; href: string }
  | { label: string; messageKey: string; kind: "placeholder" };

function parseAppEnvironment(value: string | undefined): AppEnvironment {
  if (!value) return "development";
  if (value === "development" || value === "staging" || value === "production") {
    return value;
  }
  throw new Error("NEXT_PUBLIC_APP_ENV must be development, staging, or production.");
}

function parseSiteUrl(value: string | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an absolute HTTP(S) URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTP or HTTPS.");
  }
  return url.toString();
}

export function readEvesMarketUrl(value: string | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_EVES_MARKET_URL must be an absolute HTTP(S) URL.");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
    throw new Error("NEXT_PUBLIC_EVES_MARKET_URL must be a credential-free HTTP(S) URL.");
  }
  return url.toString();
}

export function readPublicEnvironment(
  environment: Record<string, string | undefined> = process.env
) {
  const appEnvironment = parseAppEnvironment(environment.NEXT_PUBLIC_APP_ENV);
  const siteUrl = parseSiteUrl(environment.NEXT_PUBLIC_SITE_URL);
  if (appEnvironment === "production" && !siteUrl) {
    throw new Error("NEXT_PUBLIC_SITE_URL is required when NEXT_PUBLIC_APP_ENV is production.");
  }
  return { appEnvironment, siteUrl } as const;
}

export const primaryNavigation: readonly SiteNavigationItem[] = [
  { label: "Protocol", messageKey: "protocol", kind: "anchor", href: "#protocol" },
  { label: "Baskets", messageKey: "baskets", kind: "anchor", href: "#baskets" },
  { label: "Dollar", messageKey: "dollar", kind: "anchor", href: "#dollar" },
  { label: "Liquidity", messageKey: "liquidity", kind: "anchor", href: "#liquidity" },
  { label: "Docs", messageKey: "docs", kind: "placeholder" },
  { label: "Dev", messageKey: "dev", kind: "placeholder" },
] as const;

export const protocolStatus = {
  system: "Public testnet beta",
  network: "Robinhood Testnet",
  deployment: "Testnet live",
  audit: "Internal review",
} as const;

import type { DeploymentCapability, DeploymentStage } from "@/lib/deployments/types";

export type AppNavigationItem = Readonly<{
  label: string;
  messageKey: string;
  enabled: boolean;
  href: string;
  capability: DeploymentCapability;
  /**
   * Short label for the mobile tab bar, and the opt-in to appearing there.
   *
   * A tab bar is hard-limited by thumb width -- five is the practical maximum
   * at 390px -- so it carries a curated subset rather than every primary
   * destination. The sidebar has no such limit and still shows them all, and
   * the panel still reaches everything, so nothing here removes a route.
   */
  tabLabel?: string;
}>;

export type AppNavigationGroup = Readonly<{
  /** Null for the first group, which needs no heading above the home link. */
  label: string | null;
  messageKey: string | null;
  items: readonly AppNavigationItem[];
}>;

/**
 * Application navigation, grouped by what someone is trying to do.
 *
 * Flat peers described the protocol's facets rather than any intent. Positions
 * remain reachable from the portfolio and the workflows that use them, while
 * account configuration lives in the account dialog instead of a second page.
 *
 * Earn leads because staking is the one part of this protocol that reads as an
 * ordinary savings product -- deposit, choose what you are paid in, get paid.
 * Nobody arbitrages a basket by accident, but anyone can understand that.
 */
export const appNavigationGroups: readonly AppNavigationGroup[] = [
  {
    label: null,
    messageKey: null,
    items: [
      {
        label: "Overview",
        messageKey: "overview",
        enabled: true,
        href: "/app",
        capability: "overview",
      },
      {
        label: "Swap",
        messageKey: "swap",
        enabled: true,
        href: "/app/swap",
        capability: "canonical-statics-market",
      },
    ],
  },
  {
    label: "Earn",
    messageKey: "earn",
    items: [
      {
        label: "Earn",
        messageKey: "earn",
        enabled: true,
        href: "/app/rewards",
        capability: "protocol-rewards",
        tabLabel: "Earn",
      },
      {
        label: "Liquidity",
        messageKey: "liquidity",
        enabled: true,
        href: "/app/liquidity",
        capability: "protocol-liquidity",
      },
    ],
  },
  {
    label: "Assets",
    messageKey: "assets",
    items: [
      {
        label: "Baskets",
        messageKey: "baskets",
        enabled: true,
        href: "/app/baskets",
        capability: "baskets",
        tabLabel: "Baskets",
      },
      {
        label: "Create basket",
        messageKey: "create",
        enabled: true,
        href: "/app/create",
        capability: "baskets",
      },
      {
        label: "Dollar",
        messageKey: "dollar",
        enabled: true,
        href: "/app/dollar",
        capability: "dollar",
        tabLabel: "Dollar",
      },
    ],
  },
  {
    label: "Manage",
    messageKey: "manage",
    items: [
      {
        label: "Position NFT",
        messageKey: "positions",
        enabled: true,
        href: "/app/positions",
        capability: "positions",
      },
      {
        label: "Operator NFT",
        messageKey: "genesis",
        enabled: true,
        href: "/app/genesis",
        capability: "genesis-vault",
      },
      {
        label: "Loans",
        messageKey: "loans",
        enabled: true,
        href: "/app/loans",
        capability: "loans",
      },
    ],
  },
  {
    label: "Account",
    messageKey: "account",
    items: [
      {
        label: "Wallet",
        messageKey: "wallet",
        enabled: true,
        href: "/app/wallet",
        capability: "wallet",
        tabLabel: "Wallet",
      },
      {
        label: "Faucet",
        messageKey: "faucet",
        enabled: true,
        href: "/app/faucet",
        capability: "faucet",
      },
      {
        label: "Activity",
        messageKey: "activity",
        enabled: true,
        href: "/app/activity",
        capability: "activity",
      },
      {
        label: "Tools",
        messageKey: "tools",
        enabled: true,
        href: "/app/tools",
        capability: "approval-tools",
      },
    ],
  },
];

/** Every navigable item, flattened, for callers that only need the routes. */
export const appNavigation: readonly AppNavigationItem[] = appNavigationGroups.flatMap(
  (group) => group.items
);

/** The mobile tab bar, in order. Capped at five by thumb width. */
export const appTabNavigation: readonly AppNavigationItem[] = appNavigation.filter(
  (item) => typeof item.tabLabel === "string"
);
/** The only product capabilities promoted by a launch deployment. */
export const launchPrimaryCapabilities: readonly DeploymentCapability[] = [
  "overview",
  "canonical-statics-market",
  "genesis-vault",
] as const;

/**
 * Selects the canonical catalog for the selected deployment stage. The full
 * catalog remains the source of truth; launch only filters and regroups it.
 */
export function appNavigationGroupsForStage(stage: DeploymentStage): readonly AppNavigationGroup[] {
  if (stage === "full-protocol") return appNavigationGroups;
  const launchNavigationCapabilities: readonly DeploymentCapability[] = [
    ...launchPrimaryCapabilities,
    "wallet",
  ];
  return appNavigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => launchNavigationCapabilities.includes(item.capability)),
    }))
    .filter((group) => group.items.length > 0);
}

export function appTabNavigationForStage(stage: DeploymentStage): readonly AppNavigationItem[] {
  if (stage === "full-protocol") return appTabNavigation;
  const launchTabCapabilities: readonly DeploymentCapability[] = [
    "canonical-statics-market",
    "genesis-vault",
    "wallet",
  ];
  return appNavigation.filter((item) => launchTabCapabilities.includes(item.capability));
}

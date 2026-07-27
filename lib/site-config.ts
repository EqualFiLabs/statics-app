export type AppEnvironment = "development" | "staging" | "production";

export type SiteNavigationItem =
  | { label: string; kind: "anchor" | "route"; href: string }
  | { label: string; kind: "placeholder" };

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
  { label: "Protocol", kind: "anchor", href: "#protocol" },
  { label: "Baskets", kind: "anchor", href: "#baskets" },
  { label: "Dollar", kind: "anchor", href: "#dollar" },
  { label: "Liquidity", kind: "anchor", href: "#liquidity" },
  { label: "Docs", kind: "placeholder" },
  { label: "Dev", kind: "placeholder" },
] as const;

export const protocolStatus = {
  system: "Pre-launch",
  network: "Not configured",
  deployment: "Not deployed",
  audit: "Not published",
} as const;

export type AppNavigationItem = Readonly<{
  label: string;
  enabled: boolean;
  href: string;
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
  items: readonly AppNavigationItem[];
}>;

/**
 * Application navigation, grouped by what someone is trying to do.
 *
 * Ten flat peers described the protocol's facets rather than any intent, and
 * gave no clue that Positions is the container the others sit inside. Grouping
 * is deliberately the first step and changes no routes: it buys most of the
 * apparent simplification, and it can be reverted or re-cut without touching a
 * single page.
 *
 * Earn leads because staking is the one part of this protocol that reads as an
 * ordinary savings product -- deposit, choose what you are paid in, get paid.
 * Nobody arbitrages a basket by accident, but anyone can understand that.
 */
export const appNavigationGroups: readonly AppNavigationGroup[] = [
  {
    label: null,
    items: [{ label: "Overview", enabled: true, href: "/app" }],
  },
  {
    label: "Earn",
    items: [
      { label: "Earn", enabled: true, href: "/app/rewards", tabLabel: "Earn" },
      { label: "Liquidity", enabled: true, href: "/app/liquidity" },
    ],
  },
  {
    label: "Assets",
    items: [
      { label: "Baskets", enabled: true, href: "/app/baskets", tabLabel: "Baskets" },
      { label: "Dollar", enabled: true, href: "/app/dollar", tabLabel: "Dollar" },
    ],
  },
  {
    // These stay in the sidebar. Positions being the container the others sit
    // inside is an argument about the data model, not about how people navigate:
    // a position is something you go and look at. The overview's portfolio grid
    // is an additional route to them, not a replacement for a menu entry.
    label: "Manage",
    items: [
      { label: "Positions", enabled: true, href: "/app/positions" },
      { label: "Loans", enabled: true, href: "/app/loans" },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Wallet", enabled: true, href: "/app/wallet", tabLabel: "Wallet" },
      { label: "Activity", enabled: true, href: "/app/activity" },
      { label: "Settings", enabled: true, href: "/app/settings" },
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

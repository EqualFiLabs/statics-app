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

export const appNavigation = [
  { label: "Overview", enabled: true, href: "/app" },
  { label: "Dollar", enabled: true, href: "/app/dollar" },
  { label: "Baskets", enabled: true, href: "/app/baskets" },
  { label: "Positions", enabled: true, href: "/app/positions" },
  { label: "Loans", enabled: true, href: "/app/loans" },
  { label: "Rewards", enabled: true, href: "/app/rewards" },
  { label: "Liquidity", enabled: true, href: "/app/liquidity" },
  { label: "Activity", enabled: true, href: "/app/activity" },
  { label: "Settings", enabled: true, href: "/app/settings" },
] as const;

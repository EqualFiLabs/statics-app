import tokenLogoAssets from "@/lib/generated/token-logo-assets.json";

export const ETH_TOKEN_ICON_URI = "/icons/eth.svg";
export const SOL_TOKEN_ICON_URI = "/icons/sol.svg";

export function getNativeTokenLogoURI(symbol: string | undefined) {
  const normalized = symbol?.trim().toUpperCase();
  return normalized === "ETH"
    ? ETH_TOKEN_ICON_URI
    : normalized === "SOL"
      ? SOL_TOKEN_ICON_URI
      : undefined;
}

export function allowedTokenLogoURI(value: string | undefined) {
  if (!value) return null;
  if (value.startsWith("/icons/") || value.startsWith("/assets/token-logos/")) return value;
  return (tokenLogoAssets.logos as Readonly<Record<string, string>>)[value] ?? null;
}

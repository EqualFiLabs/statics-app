export type DollarProfileChoice = "ETH" | "WETH" | "USDG";

const validProfiles: ReadonlySet<string> = new Set(["ETH", "WETH", "USDG"]);

export function readDollarProfile(
  value: string | readonly string[] | undefined
): DollarProfileChoice {
  return typeof value === "string" && validProfiles.has(value)
    ? (value as DollarProfileChoice)
    : "ETH";
}

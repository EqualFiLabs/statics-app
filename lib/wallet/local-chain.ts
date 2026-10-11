export function localChainId(environment: Record<string, string | undefined>): number {
  const value = environment.NEXT_PUBLIC_ANVIL_CHAIN_ID?.trim();
  if (!value) return 31_337;
  if (value !== "31337" && value !== "4663") {
    throw new Error("NEXT_PUBLIC_ANVIL_CHAIN_ID must be 31337 or 4663.");
  }
  if (
    value === "4663" &&
    ((environment.NEXT_PUBLIC_APP_ENV ?? "development") !== "development" ||
      environment.NEXT_PUBLIC_APP_NETWORK !== "anvil")
  ) {
    throw new Error(
      "A chain-4663 local fork requires development with the anvil network selected."
    );
  }
  return Number(value);
}

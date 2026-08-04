export type WalletPreference = "auto" | "external" | "embedded" | "none";
export type SelectedWalletKind = "external" | "embedded" | null;

/**
 * Resolve the active signer without allowing either integration to silently
 * replace a wallet the user selected.
 *
 * `auto` is used only before the user has made a choice. Once a source is
 * selected, losing it produces no active wallet instead of falling through to
 * a different signer. `none` persists an explicit local disconnect.
 */
export function selectWalletKind({
  preference,
  externalAvailable,
  embeddedAvailable,
}: {
  preference: WalletPreference;
  externalAvailable: boolean;
  embeddedAvailable: boolean;
}): SelectedWalletKind {
  if (preference === "none") return null;
  if (preference === "external") return externalAvailable ? "external" : null;
  if (preference === "embedded") return embeddedAvailable ? "embedded" : null;
  if (externalAvailable) return "external";
  return embeddedAvailable ? "embedded" : null;
}

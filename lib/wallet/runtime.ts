import type { PrivyIdentityStatus, WalletRuntimeStatus } from "@/providers/wallet-context";
import type { SelectedWalletKind, WalletPreference } from "@/lib/wallet/selection";

export function parseWalletPreference(value: string | null): WalletPreference {
  return value === "external" || value === "embedded" || value === "none" ? value : "auto";
}

export function derivePrivyIdentityStatus({
  configured,
  ready,
  authenticated,
  hasError,
}: {
  configured: boolean;
  ready: boolean;
  authenticated: boolean;
  hasError: boolean;
}): PrivyIdentityStatus {
  if (!configured) return "unconfigured";
  if (hasError) return "degraded";
  if (!ready) return "loading";
  return authenticated ? "authenticated" : "signed-out";
}

export function deriveWalletRuntimeStatus({
  preferenceLoaded,
  connecting,
  address,
  selectedKind,
  hasError,
}: {
  preferenceLoaded: boolean;
  connecting: boolean;
  address: string | null;
  selectedKind: SelectedWalletKind;
  hasError: boolean;
}): WalletRuntimeStatus {
  if (!preferenceLoaded || connecting) return "loading";
  if (address && selectedKind) return "ready";
  return hasError ? "error" : "disconnected";
}

export function walletClientMatchesAddress(
  clientAddress: string | undefined,
  activeAddress: string | null
): boolean {
  return Boolean(
    clientAddress && activeAddress && clientAddress.toLowerCase() === activeAddress.toLowerCase()
  );
}

export function walletClientAccountAddress(
  account: string | { readonly address: string } | null | undefined
): string | undefined {
  return typeof account === "string" ? account : account?.address;
}

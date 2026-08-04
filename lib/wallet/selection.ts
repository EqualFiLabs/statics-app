import { getEmbeddedConnectedWallet, type ConnectedWallet } from "@privy-io/react-auth";

/**
 * Statics uses one EVM wallet for both its app context and Wagmi.
 *
 * An embedded wallet is the default whenever the authenticated user has one.
 * External wallets remain supported for users without an embedded wallet.
 */
export function selectStaticsWallet(wallets: ConnectedWallet[]): ConnectedWallet | undefined {
  return getEmbeddedConnectedWallet(wallets) ?? wallets[0];
}

/**
 * Keep Statics and Wagmi on the same connected wallet after a user explicitly
 * chooses one. A stale Wagmi address is ignored so an available embedded
 * wallet still recovers after an external wallet disappears.
 */
export function selectActiveStaticsWallet(
  wallets: ConnectedWallet[],
  activeAddress: string | undefined
): ConnectedWallet | undefined {
  const activeWallet = activeAddress
    ? wallets.find((wallet) => wallet.address.toLowerCase() === activeAddress.toLowerCase())
    : undefined;
  if (activeWallet) return activeWallet;
  return getEmbeddedConnectedWallet(wallets) ?? wallets[0];
}

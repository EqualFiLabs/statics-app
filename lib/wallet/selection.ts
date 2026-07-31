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

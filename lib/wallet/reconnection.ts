export type PrivyRecoveryResult = "activated-embedded" | "opened-email-login";

export async function recoverPrivyWallet<TWallet>({
  embeddedWallet,
  authenticated,
  activateEmbedded,
  logout,
  selectEmbedded,
  restoreLocalConnection,
  waitForEmbeddedWallet,
  openEmailLogin,
}: {
  embeddedWallet: TWallet | null | undefined;
  authenticated: boolean;
  activateEmbedded: (wallet: TWallet) => Promise<unknown>;
  logout: () => Promise<void>;
  selectEmbedded: (wallet: TWallet) => void;
  restoreLocalConnection: () => void;
  waitForEmbeddedWallet: () => void;
  openEmailLogin: () => void;
}): Promise<PrivyRecoveryResult> {
  if (embeddedWallet) {
    await activateEmbedded(embeddedWallet);
    selectEmbedded(embeddedWallet);
    restoreLocalConnection();
    return "activated-embedded";
  }

  // An external-wallet login is still an authenticated Privy session. End only
  // that session when the user explicitly asks for Privy so email login can
  // create or recover the embedded wallet without a manual cache reset.
  if (authenticated) await logout();
  waitForEmbeddedWallet();
  openEmailLogin();
  return "opened-email-login";
}

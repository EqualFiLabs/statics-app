import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [file] : [];
  });
}

describe("wallet runtime boundary", () => {
  it("keeps Privy, Wagmi, and Viem outside the marketing route", () => {
    const marketingFiles = [
      ...sourceFiles("app/(marketing)"),
      ...sourceFiles("components/landing"),
      "app/layout.tsx",
      "lib/site-config.ts",
    ];
    const source = marketingFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");

    expect(source).not.toMatch(/from ["'](?:@privy-io\/|wagmi|viem)/);
    expect(source).not.toMatch(/DAppProviders|wallet-context|wallet-config/);
  });

  it("keeps the configured provider order explicit", () => {
    const source = fs.readFileSync("providers/DAppProviders.tsx", "utf8");
    const queryProvider = source.indexOf("<QueryClientProvider");
    const configuredProviders = source.indexOf("<ConfiguredWalletProviders>");
    const privyProvider = source.indexOf("<PrivyProvider");
    const wagmiProvider = source.indexOf("<WagmiProvider");
    const bridge = source.indexOf("<WalletBridge>");

    expect(queryProvider).toBeGreaterThan(-1);
    expect(configuredProviders).toBeGreaterThan(queryProvider);
    expect(privyProvider).toBeGreaterThan(-1);
    expect(wagmiProvider).toBeGreaterThan(privyProvider);
    expect(bridge).toBeGreaterThan(wagmiProvider);
    expect(source).toContain('walletChainType: "ethereum-and-solana"');
    expect(source).toContain("defaultSolanaRpcsPlugin()");
    expect(source).toContain("<ProtocolQueryReconciler />");
    expect(source).toContain('promptExternalWallet({ walletChainType: "ethereum-only" })');
    expect(source).toContain("recoverPrivyWallet");
    expect(source).toContain("setLocallyDisconnected(true)");
    expect(source).not.toContain("setActiveWalletForWagmi");
    expect(source).not.toMatch(/addSigners|delegateWallet|policyIds/);
  });

  it("binds external wallet transactions to the requested supported chain", () => {
    const source = fs.readFileSync("providers/DAppProviders.tsx", "utf8");

    expect(source).toContain("const transactionNetwork = getFundingNetwork(request.chainId)");
    expect(source.match(/chain: transactionNetwork\.chain/g)).toHaveLength(2);
    expect(source).not.toContain("chain: undefined");
  });
});

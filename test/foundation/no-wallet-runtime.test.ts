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

  it("keeps native Wagmi outside the optional Privy capability branch", () => {
    const source = fs.readFileSync("providers/DAppProviders.tsx", "utf8");
    const queryProvider = source.indexOf("<QueryClientProvider");
    const wagmiProvider = source.indexOf("<WagmiProvider config={wagmiConfig}>");
    const configuredProviders = source.indexOf(
      "<ConfiguredWalletProviders>{children}</ConfiguredWalletProviders>",
      wagmiProvider
    );
    const externalOnlyRuntime = source.indexOf(
      "<WalletRuntimeBridge privy={unavailablePrivyRuntime}>{children}</WalletRuntimeBridge>",
      wagmiProvider
    );

    expect(queryProvider).toBeGreaterThan(-1);
    expect(wagmiProvider).toBeGreaterThan(queryProvider);
    expect(configuredProviders).toBeGreaterThan(wagmiProvider);
    expect(externalOnlyRuntime).toBeGreaterThan(wagmiProvider);
    expect(source).toContain('from "wagmi";');
    expect(source).not.toContain('from "@privy-io/wagmi"');
    expect(source).toContain("connectors: [injected({ shimDisconnect: true })]");
    expect(source).toContain('walletChainType: "ethereum-and-solana"');
    expect(source).toContain("defaultSolanaRpcsPlugin()");
    expect(source).toContain("<ProtocolQueryReconciler />");
    expect(source).not.toMatch(/addSigners|delegateWallet|policyIds/);
  });

  it("routes transaction clients through the reconciled active signer", () => {
    const source = sourceFiles("components")
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");

    expect(source).not.toContain("useWalletClient");
    expect(source).toContain("useActiveWalletClient");
  });
});

"use client";

import {
  getEmbeddedConnectedWallet,
  PrivyProvider,
  useActiveWallet,
  useCreateWallet,
  useExportWallet,
  usePrivy,
  useWallets,
  type ConnectedWallet,
  type User,
} from "@privy-io/react-auth";
import {
  defaultSolanaRpcsPlugin,
  toSolanaWalletConnectors,
  useCreateWallet as useCreateSolanaWallet,
  useSignTransaction as useSignSolanaTransaction,
  useWallets as useSolanaWallets,
} from "@privy-io/react-auth/solana";
import { createConfig, WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

import {
  createWalletTransports,
  getAddressExplorerUrl,
  readWalletEnvironment,
} from "@/lib/wallet-config";
import { fundingNetworks, getFundingNetwork, isFundingChainId } from "@/lib/funding-networks";
import { WalletContext, defaultWalletState, type WalletState } from "./wallet-context";
import {
  defaultSolanaWalletState,
  SolanaWalletContext,
  type SolanaWalletState,
} from "./solana-context";

const walletEnvironment = readWalletEnvironment({
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_APP_NETWORK: process.env.NEXT_PUBLIC_APP_NETWORK,
  NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  NEXT_PUBLIC_PRIVY_CLIENT_ID: process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID,
  NEXT_PUBLIC_ROBINHOOD_RPC_URL: process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL,
  NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL: process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL,
  NEXT_PUBLIC_ANVIL_RPC_URL: process.env.NEXT_PUBLIC_ANVIL_RPC_URL,
});
const transports = createWalletTransports(walletEnvironment);
const wagmiConfig = createConfig({
  chains: walletEnvironment.supportedChains,
  transports,
});
const privySupportedChains = [
  ...fundingNetworks.map((network) => network.chain),
  ...walletEnvironment.supportedChains,
].filter(
  (chain, index, chains) => chains.findIndex((candidate) => candidate.id === chain.id) === index
);
const fundingNetworkSummaries = fundingNetworks.map((network) => ({
  chainId: network.chain.id,
  label: network.label,
  nativeSymbol: network.chain.nativeCurrency.symbol,
  supportsUniswap: network.supportsUniswap,
}));
const FUNDING_CHAIN_STORAGE_KEY = "statics:funding-chain";

function selectWallet({ wallets }: { wallets: ConnectedWallet[]; user: User | null }) {
  return getEmbeddedConnectedWallet(wallets) ?? wallets[0];
}

function connectedWalletChainId(wallet: ConnectedWallet | undefined): number | null {
  if (!wallet?.chainId) return null;
  const parsed = Number(wallet.chainId.replace(/^eip155:/, ""));
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function WalletBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, error: privyError, login, logout } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const { wallet: activeWallet, setActiveWallet } = useActiveWallet();
  const { createWallet } = useCreateWallet();
  const { exportWallet } = useExportWallet();
  const wagmiAccount = useAccount();
  const { createWallet: createSolanaWallet } = useCreateSolanaWallet();
  const { signTransaction: signSolanaTransaction } = useSignSolanaTransaction();
  const { wallets: solanaWallets, ready: solanaWalletsReady } = useSolanaWallets();
  const [busyAction, setBusyAction] = useState<WalletState["busyAction"]>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fundingChainId, setFundingChainId] = useState(8_453);

  const activeEthereumWallet =
    activeWallet && "switchChain" in activeWallet ? activeWallet : undefined;
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  const selectedWallet = activeEthereumWallet ?? embeddedWallet ?? wallets[0];
  const address = selectedWallet?.address ?? null;
  const walletKind = selectedWallet
    ? selectedWallet.walletClientType === "privy" || selectedWallet.walletClientType === "privy-v2"
      ? "embedded"
      : "external"
    : null;
  const chainId =
    connectedWalletChainId(selectedWallet) ??
    (wagmiAccount.address?.toLowerCase() === address?.toLowerCase()
      ? (wagmiAccount.chainId ?? null)
      : null);
  const targetChain = walletEnvironment.defaultChain;
  const fundingNetwork = getFundingNetwork(fundingChainId) ?? getFundingNetwork(8_453)!;

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(FUNDING_CHAIN_STORAGE_KEY));
    if (Number.isSafeInteger(stored) && isFundingChainId(stored)) {
      setFundingChainId(stored);
    }
  }, []);

  const runAction = async (
    action: NonNullable<WalletState["busyAction"]>,
    operation: () => Promise<void>
  ) => {
    setActionError(null);
    setBusyAction(action);
    try {
      await operation();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The wallet request failed.");
    } finally {
      setBusyAction(null);
    }
  };

  let status: WalletState["status"] = "loading";
  if (privyError) status = "error";
  else if (ready && !authenticated) status = "signed-out";
  else if (ready && authenticated && walletsReady && !selectedWallet) status = "wallet-missing";
  else if (ready && authenticated && walletsReady && selectedWallet) status = "ready";

  const value = useMemo<WalletState>(
    () => ({
      status,
      authenticated,
      address,
      walletKind,
      networkName: targetChain.name,
      chainId,
      targetChainId: targetChain.id,
      isTargetChain: chainId === targetChain.id,
      fundingChainId,
      fundingNetworkName: fundingNetwork.label,
      fundingWalletOnSelectedChain: chainId === fundingChainId,
      fundingNetworks: fundingNetworkSummaries,
      explorerUrl: address ? getAddressExplorerUrl(targetChain, address) : null,
      error: actionError ?? privyError?.message ?? null,
      busyAction,
      login: () => login({ loginMethods: ["email", "wallet"] }),
      connectWallet: () => login({ loginMethods: ["wallet"] }),
      createWallet: () =>
        runAction("create", async () => {
          const wallet = await createWallet();
          const connectedWallet = wallets.find(
            (candidate) => candidate.address.toLowerCase() === wallet.address.toLowerCase()
          );
          if (connectedWallet) setActiveWallet(connectedWallet);
        }),
      logout: () => runAction("logout", logout),
      switchNetwork: () =>
        runAction("switch", async () => {
          if (!selectedWallet) throw new Error("Connect a wallet before switching networks.");
          await selectedWallet.switchChain(targetChain.id);
          setActiveWallet(selectedWallet);
        }),
      selectFundingNetwork: (nextChainId) =>
        runAction("funding-switch", async () => {
          const nextNetwork = getFundingNetwork(nextChainId);
          if (!nextNetwork) throw new Error("Choose a supported funding network.");
          setFundingChainId(nextChainId);
          window.localStorage.setItem(FUNDING_CHAIN_STORAGE_KEY, String(nextChainId));
          if (!selectedWallet) return;
          await selectedWallet.switchChain(nextChainId);
          setActiveWallet(selectedWallet);
        }),
      getEthereumProvider: async () => {
        if (!selectedWallet) return null;
        return selectedWallet.getEthereumProvider();
      },
      exportWallet: () =>
        runAction("export", async () => {
          if (!embeddedWallet) throw new Error("Only an embedded wallet can be exported here.");
          await exportWallet({ address: embeddedWallet.address });
        }),
      copyAddress: async () => {
        if (!address) return;
        await navigator.clipboard.writeText(address);
      },
    }),
    [
      actionError,
      address,
      authenticated,
      busyAction,
      chainId,
      createWallet,
      embeddedWallet,
      exportWallet,
      fundingChainId,
      fundingNetwork,
      login,
      logout,
      privyError,
      selectedWallet,
      setActiveWallet,
      status,
      targetChain,
      walletKind,
      wallets,
    ]
  );

  const solanaValue = useMemo<SolanaWalletState>(
    () => ({
      configured: true,
      ready: solanaWalletsReady,
      wallets: solanaWallets,
      createWallet: createSolanaWallet,
      signTransaction: signSolanaTransaction,
    }),
    [createSolanaWallet, signSolanaTransaction, solanaWallets, solanaWalletsReady]
  );

  return (
    <WalletContext.Provider value={value}>
      <SolanaWalletContext.Provider value={solanaValue}>{children}</SolanaWalletContext.Provider>
    </WalletContext.Provider>
  );
}

function ConfiguredWalletProviders({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={walletEnvironment.appId!}
      clientId={walletEnvironment.clientId ?? undefined}
      config={{
        loginMethods: ["wallet", "email"],
        supportedChains: privySupportedChains,
        defaultChain: walletEnvironment.defaultChain,
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
          solana: { createOnLogin: "off" },
          showWalletUIs: true,
        },
        externalWallets: {
          solana: { connectors: toSolanaWalletConnectors() },
        },
        appearance: {
          theme: "dark",
          accentColor: "#75f12d",
          logo: "/assets/statics-icon.png",
          walletChainType: "ethereum-and-solana",
        },
        plugins: [defaultSolanaRpcsPlugin()],
      }}
    >
      <WagmiProvider config={wagmiConfig} setActiveWalletForWagmi={selectWallet}>
        <WalletBridge>{children}</WalletBridge>
      </WagmiProvider>
    </PrivyProvider>
  );
}

function UnconfiguredWalletBridge({ children }: { children: React.ReactNode }) {
  const [fundingChainId, setFundingChainId] = useState(8_453);
  const fundingNetwork = getFundingNetwork(fundingChainId) ?? getFundingNetwork(8_453)!;
  const value = useMemo<WalletState>(
    () => ({
      ...defaultWalletState,
      fundingChainId,
      fundingNetworkName: fundingNetwork.label,
      fundingNetworks: fundingNetworkSummaries,
      selectFundingNetwork: async (nextChainId) => {
        const nextNetwork = getFundingNetwork(nextChainId);
        if (!nextNetwork) return;
        setFundingChainId(nextChainId);
      },
    }),
    [fundingChainId, fundingNetwork.label]
  );
  return (
    <WalletContext.Provider value={value}>
      <SolanaWalletContext.Provider value={defaultSolanaWalletState}>
        {children}
      </SolanaWalletContext.Provider>
    </WalletContext.Provider>
  );
}

export function DAppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {walletEnvironment.configured ? (
        <ConfiguredWalletProviders>{children}</ConfiguredWalletProviders>
      ) : (
        <UnconfiguredWalletBridge>{children}</UnconfiguredWalletBridge>
      )}
    </QueryClientProvider>
  );
}

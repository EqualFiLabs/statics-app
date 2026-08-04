"use client";

import {
  getEmbeddedConnectedWallet,
  PrivyProvider,
  useCreateWallet,
  useExportWallet,
  usePrivy,
  useWallets,
  type ConnectedWallet,
} from "@privy-io/react-auth";
import {
  defaultSolanaRpcsPlugin,
  toSolanaWalletConnectors,
  useCreateWallet as useCreateSolanaWallet,
  useSignTransaction as useSignSolanaTransaction,
  useWallets as useSolanaWallets,
} from "@privy-io/react-auth/solana";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createWalletClient,
  custom,
  getAddress,
  http,
  type Chain,
  type EIP1193Provider,
  type Transport,
} from "viem";
import {
  createConfig,
  useAccount,
  useConnect,
  useConnectorClient,
  useDisconnect,
  useSwitchChain,
  WagmiProvider,
} from "wagmi";
import { injected } from "wagmi/connectors";

import { fundingNetworks, getFundingNetwork, isFundingChainId } from "@/lib/funding-networks";
import { subscribeToProtocolReconciliation } from "@/lib/protocol/reconciliation";
import {
  createWalletTransports,
  getAddressExplorerUrl,
  readWalletEnvironment,
} from "@/lib/wallet-config";
import { selectWalletKind, type WalletPreference } from "@/lib/wallet/selection";
import {
  derivePrivyIdentityStatus,
  deriveWalletRuntimeStatus,
  parseWalletPreference,
  walletClientMatchesAddress,
} from "@/lib/wallet/runtime";
import {
  WalletContext,
  type ActiveWalletClient,
  type PrivyIdentityStatus,
  type WalletEthereumProvider,
  type WalletState,
} from "./wallet-context";
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

const walletChains = [
  walletEnvironment.defaultChain,
  ...walletEnvironment.supportedChains,
  ...fundingNetworks.map((network) => network.chain),
].filter(
  (chain, index, chains) => chains.findIndex((candidate) => candidate.id === chain.id) === index
) as [Chain, ...Chain[]];
const configuredTransports = createWalletTransports(walletEnvironment);
const walletTransports = Object.fromEntries(
  walletChains.map((chain) => [
    chain.id,
    configuredTransports[chain.id] ?? http(chain.rpcUrls.default.http[0]),
  ])
) as Record<number, Transport>;
const wagmiConfig = createConfig({
  ssr: true,
  chains: walletChains,
  connectors: [injected({ shimDisconnect: true })],
  transports: walletTransports,
});
const privySupportedChains = walletChains;
const fundingNetworkSummaries = fundingNetworks.map((network) => ({
  chainId: network.chain.id,
  label: network.label,
  nativeSymbol: network.chain.nativeCurrency.symbol,
  supportsUniswap: network.supportsUniswap,
}));
const FUNDING_CHAIN_STORAGE_KEY = "statics:funding-chain";
const ACTIVE_WALLET_STORAGE_KEY = "statics:active-wallet-source";

type PrivyRuntime = Readonly<{
  configured: boolean;
  ready: boolean;
  authenticated: boolean;
  error: Error | null;
  embeddedWallet: ConnectedWallet | null;
  login: () => void;
  logout: () => Promise<void>;
  createWallet: () => Promise<unknown>;
  exportWallet: (address: string) => Promise<void>;
  solana: SolanaWalletState;
}>;

const unavailablePrivyRuntime: PrivyRuntime = {
  configured: false,
  ready: true,
  authenticated: false,
  error: null,
  embeddedWallet: null,
  login: () => undefined,
  logout: async () => undefined,
  createWallet: async () => undefined,
  exportWallet: async () => undefined,
  solana: defaultSolanaWalletState,
};

function connectedWalletChainId(wallet: ConnectedWallet | null): number | null {
  if (!wallet?.chainId) return null;
  const parsed = Number(wallet.chainId.replace(/^eip155:/, ""));
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function isEthereumProvider(provider: unknown): provider is WalletEthereumProvider {
  return Boolean(
    provider &&
    typeof provider === "object" &&
    "request" in provider &&
    typeof (provider as { request?: unknown }).request === "function"
  );
}

function PrivyRuntimeBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, error, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { exportWallet } = useExportWallet();
  const { createWallet: createSolanaWallet } = useCreateSolanaWallet();
  const { signTransaction: signSolanaTransaction } = useSignSolanaTransaction();
  const { wallets: solanaWallets, ready: solanaWalletsReady } = useSolanaWallets();

  const runtime = useMemo<PrivyRuntime>(
    () => ({
      configured: true,
      ready,
      authenticated,
      error: error ?? null,
      embeddedWallet: getEmbeddedConnectedWallet(wallets) ?? null,
      login: () => login({ loginMethods: ["email", "wallet"] }),
      logout,
      createWallet,
      exportWallet: async (address) => {
        await exportWallet({ address });
      },
      solana: {
        configured: true,
        ready: solanaWalletsReady,
        wallets: solanaWallets,
        createWallet: createSolanaWallet,
        signTransaction: signSolanaTransaction,
      },
    }),
    [
      authenticated,
      createSolanaWallet,
      createWallet,
      error,
      exportWallet,
      login,
      logout,
      ready,
      signSolanaTransaction,
      solanaWallets,
      solanaWalletsReady,
      wallets,
    ]
  );

  return <WalletRuntimeBridge privy={runtime}>{children}</WalletRuntimeBridge>;
}

function WalletRuntimeBridge({
  children,
  privy,
}: {
  children: React.ReactNode;
  privy: PrivyRuntime;
}) {
  const queryClient = useQueryClient();
  const account = useAccount();
  const connectorClient = useConnectorClient();
  const { connectors, connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const [busyAction, setBusyAction] = useState<WalletState["busyAction"]>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [identityActionError, setIdentityActionError] = useState<string | null>(null);
  const [fundingChainId, setFundingChainId] = useState(8_453);
  const [preference, setPreference] = useState<WalletPreference>("auto");
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [embeddedWalletClient, setEmbeddedWalletClient] = useState<ActiveWalletClient | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storedFundingChain = Number(window.localStorage.getItem(FUNDING_CHAIN_STORAGE_KEY));
      if (Number.isSafeInteger(storedFundingChain) && isFundingChainId(storedFundingChain)) {
        setFundingChainId(storedFundingChain);
      }
      setPreference(parseWalletPreference(window.localStorage.getItem(ACTIVE_WALLET_STORAGE_KEY)));
      setPreferenceLoaded(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const persistPreference = useCallback((next: WalletPreference) => {
    setPreference(next);
    if (next === "auto") window.localStorage.removeItem(ACTIVE_WALLET_STORAGE_KEY);
    else window.localStorage.setItem(ACTIVE_WALLET_STORAGE_KEY, next);
  }, []);

  const embeddedWallet = privy.embeddedWallet;
  const selectedKind = selectWalletKind({
    preference,
    externalAvailable: account.isConnected && Boolean(account.address),
    embeddedAvailable: Boolean(embeddedWallet),
  });
  const address =
    selectedKind === "external"
      ? (account.address ?? null)
      : selectedKind === "embedded"
        ? (embeddedWallet?.address ?? null)
        : null;
  const chainId =
    selectedKind === "external"
      ? (account.chainId ?? null)
      : selectedKind === "embedded"
        ? connectedWalletChainId(embeddedWallet)
        : null;
  const targetChain = walletEnvironment.defaultChain;
  const fundingNetwork = getFundingNetwork(fundingChainId) ?? getFundingNetwork(8_453)!;

  const getEthereumProvider = useCallback(async (): Promise<WalletEthereumProvider | null> => {
    if (selectedKind === "embedded") {
      const provider = await embeddedWallet?.getEthereumProvider();
      return isEthereumProvider(provider) ? provider : null;
    }
    if (selectedKind === "external") {
      const provider = await account.connector?.getProvider();
      return isEthereumProvider(provider) ? provider : null;
    }
    return null;
  }, [account.connector, embeddedWallet, selectedKind]);

  useEffect(() => {
    let active = true;
    if (selectedKind !== "embedded" || !address || chainId === null) {
      const timeout = window.setTimeout(() => setEmbeddedWalletClient(null), 0);
      return () => window.clearTimeout(timeout);
    }
    const chain = walletChains.find((candidate) => candidate.id === chainId);
    if (!chain) {
      const timeout = window.setTimeout(() => setEmbeddedWalletClient(null), 0);
      return () => window.clearTimeout(timeout);
    }
    void getEthereumProvider()
      .then((provider) => {
        if (!active || !provider) return;
        setEmbeddedWalletClient(
          createWalletClient({
            account: getAddress(address),
            chain,
            transport: custom(provider as EIP1193Provider),
          }) as ActiveWalletClient
        );
      })
      .catch(() => {
        if (active) setEmbeddedWalletClient(null);
      });
    return () => {
      active = false;
    };
  }, [address, chainId, getEthereumProvider, selectedKind]);

  const externalWalletClient =
    selectedKind === "external" &&
    walletClientMatchesAddress(connectorClient.data?.account?.address, address)
      ? (connectorClient.data as ActiveWalletClient)
      : null;
  const walletClient = selectedKind === "external" ? externalWalletClient : embeddedWalletClient;

  useEffect(() => {
    if (!preferenceLoaded) return;
    void queryClient.invalidateQueries();
  }, [address, preferenceLoaded, queryClient]);

  const runWalletAction = useCallback(
    async (action: NonNullable<WalletState["busyAction"]>, operation: () => Promise<void>) => {
      setWalletError(null);
      setBusyAction(action);
      try {
        await operation();
      } catch (error) {
        setWalletError(error instanceof Error ? error.message : "The wallet request failed.");
      } finally {
        setBusyAction(null);
      }
    },
    []
  );

  const runIdentityAction = useCallback(
    async (action: NonNullable<WalletState["busyAction"]>, operation: () => Promise<void>) => {
      setIdentityActionError(null);
      setBusyAction(action);
      try {
        await operation();
      } catch (error) {
        setIdentityActionError(
          error instanceof Error ? error.message : "The Privy account request failed."
        );
      } finally {
        setBusyAction(null);
      }
    },
    []
  );

  const walletOptions = useMemo<WalletState["walletOptions"]>(() => {
    const externalOptions = connectors.map((connector) => ({
      id: connector.uid,
      name: connector.name === "Injected" ? "Browser wallet" : connector.name,
      kind: "external" as const,
      connected: account.isConnected && account.connector?.uid === connector.uid,
    }));
    return embeddedWallet
      ? [
          ...externalOptions,
          {
            id: "embedded",
            name: "Privy embedded wallet",
            kind: "embedded" as const,
            connected: selectedKind === "embedded",
          },
        ]
      : externalOptions;
  }, [account.connector?.uid, account.isConnected, connectors, embeddedWallet, selectedKind]);

  const identityStatus: PrivyIdentityStatus = derivePrivyIdentityStatus({
    configured: privy.configured,
    ready: privy.ready,
    authenticated: privy.authenticated,
    hasError: Boolean(privy.error),
  });
  const status = deriveWalletRuntimeStatus({
    preferenceLoaded,
    connecting: account.isConnecting || account.isReconnecting,
    address,
    selectedKind,
    hasError: Boolean(walletError),
  });

  const value = useMemo<WalletState>(
    () => ({
      status,
      identityStatus,
      authenticated: privy.authenticated,
      address,
      walletKind: selectedKind,
      walletClient,
      networkName: targetChain.name,
      chainId,
      targetChainId: targetChain.id,
      isTargetChain: chainId === targetChain.id,
      fundingChainId,
      fundingNetworkName: fundingNetwork.label,
      fundingWalletOnSelectedChain: chainId === fundingChainId,
      fundingNetworks: fundingNetworkSummaries,
      explorerUrl: address ? getAddressExplorerUrl(targetChain, address) : null,
      error: walletError,
      identityError: identityActionError ?? privy.error?.message ?? null,
      busyAction,
      walletPickerOpen,
      walletOptions,
      login: () => {
        setIdentityActionError(null);
        privy.login();
      },
      connectWallet: () => {
        setWalletError(null);
        setWalletPickerOpen(true);
      },
      closeWalletPicker: () => setWalletPickerOpen(false),
      connectWalletOption: (id) =>
        runWalletAction("connect", async () => {
          if (id === "embedded") {
            if (!embeddedWallet) throw new Error("The embedded wallet is unavailable.");
            persistPreference("embedded");
            setWalletPickerOpen(false);
            return;
          }
          const connector = connectors.find((candidate) => candidate.uid === id);
          if (!connector) throw new Error("That wallet connector is unavailable.");
          if (!account.isConnected || account.connector?.uid !== connector.uid) {
            await connectAsync({ connector });
          }
          persistPreference("external");
          setWalletPickerOpen(false);
        }),
      createWallet: () =>
        runIdentityAction("create", async () => {
          if (!privy.configured) throw new Error("Privy embedded wallets are not configured.");
          if (!privy.authenticated) throw new Error("Sign in before creating an embedded wallet.");
          await privy.createWallet();
          persistPreference("embedded");
        }),
      disconnectWallet: () =>
        runWalletAction("disconnect", async () => {
          persistPreference("none");
          setWalletPickerOpen(false);
          if (selectedKind === "external" && account.connector) {
            await disconnectAsync({ connector: account.connector });
          }
        }),
      signOut: () => runIdentityAction("sign-out", privy.logout),
      switchNetwork: () =>
        runWalletAction("switch", async () => {
          if (selectedKind === "external") {
            await switchChainAsync({ chainId: targetChain.id });
            return;
          }
          if (selectedKind === "embedded" && embeddedWallet) {
            await embeddedWallet.switchChain(targetChain.id);
            return;
          }
          throw new Error("Connect a wallet before switching networks.");
        }),
      selectFundingNetwork: (nextChainId) =>
        runWalletAction("funding-switch", async () => {
          const nextNetwork = getFundingNetwork(nextChainId);
          if (!nextNetwork) throw new Error("Choose a supported funding network.");
          setFundingChainId(nextChainId);
          window.localStorage.setItem(FUNDING_CHAIN_STORAGE_KEY, String(nextChainId));
          if (selectedKind === "external") {
            await switchChainAsync({ chainId: nextChainId });
          } else if (selectedKind === "embedded" && embeddedWallet) {
            await embeddedWallet.switchChain(nextChainId);
          }
        }),
      getEthereumProvider,
      exportWallet: () =>
        runIdentityAction("export", async () => {
          if (!embeddedWallet) throw new Error("Only an embedded wallet can be exported here.");
          await privy.exportWallet(embeddedWallet.address);
        }),
      copyAddress: async () => {
        if (!address) return;
        await navigator.clipboard.writeText(address);
      },
    }),
    [
      account.connector,
      account.isConnected,
      address,
      busyAction,
      chainId,
      connectAsync,
      connectors,
      disconnectAsync,
      embeddedWallet,
      fundingChainId,
      fundingNetwork.label,
      getEthereumProvider,
      identityActionError,
      identityStatus,
      persistPreference,
      privy,
      runIdentityAction,
      runWalletAction,
      selectedKind,
      status,
      switchChainAsync,
      targetChain,
      walletClient,
      walletError,
      walletOptions,
      walletPickerOpen,
    ]
  );

  return (
    <WalletContext.Provider value={value}>
      <SolanaWalletContext.Provider value={privy.solana}>{children}</SolanaWalletContext.Provider>
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
      <PrivyRuntimeBridge>{children}</PrivyRuntimeBridge>
    </PrivyProvider>
  );
}

function ProtocolQueryReconciler() {
  const queryClient = useQueryClient();

  useEffect(
    () => subscribeToProtocolReconciliation(() => queryClient.refetchQueries({ type: "active" })),
    [queryClient]
  );

  return null;
}

export function DAppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ProtocolQueryReconciler />
      <WagmiProvider config={wagmiConfig}>
        {walletEnvironment.privyConfigured ? (
          <ConfiguredWalletProviders>{children}</ConfiguredWalletProviders>
        ) : (
          <WalletRuntimeBridge privy={unavailablePrivyRuntime}>{children}</WalletRuntimeBridge>
        )}
      </WagmiProvider>
    </QueryClientProvider>
  );
}

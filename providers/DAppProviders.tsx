"use client";

import {
  getEmbeddedConnectedWallet,
  PrivyProvider,
  useConnectWallet,
  useCreateWallet,
  useExportWallet,
  usePrivy,
  useSendTransaction,
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
import { createConfig, useSetActiveWallet, WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createWalletClient, custom, getAddress } from "viem";
import { useAccount } from "wagmi";

import {
  createWalletTransports,
  getAddressExplorerUrl,
  getStaticsChain,
  readWalletEnvironment,
} from "@/lib/wallet-config";
import { fundingNetworks, getFundingNetwork, isFundingChainId } from "@/lib/funding-networks";
import { selectActiveStaticsWallet } from "@/lib/wallet/selection";
import { recoverPrivyWallet } from "@/lib/wallet/reconnection";
import {
  queryMatchesProtocolReconciliation,
  subscribeToProtocolReconciliation,
} from "@/lib/protocol/reconciliation";
import { WalletContext, defaultWalletState, type WalletState } from "./wallet-context";
import { DeploymentProvider, useDeployment } from "./deployment-context";
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

function connectedWalletChainId(wallet: ConnectedWallet | undefined): number | null {
  if (!wallet?.chainId) return null;
  const parsed = Number(wallet.chainId.replace(/^eip155:/, ""));
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function WalletBridge({ children }: { children: React.ReactNode }) {
  const { active } = useDeployment();
  const { ready, authenticated, error: privyError, login, logout } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { exportWallet } = useExportWallet();
  const { sendTransaction: sendEmbeddedTransaction } = useSendTransaction();
  const wagmiAccount = useAccount();
  const { setActiveWallet } = useSetActiveWallet();
  const { createWallet: createSolanaWallet } = useCreateSolanaWallet();
  const { signTransaction: signSolanaTransaction } = useSignSolanaTransaction();
  const { wallets: solanaWallets, ready: solanaWalletsReady } = useSolanaWallets();
  const [busyAction, setBusyAction] = useState<WalletState["busyAction"]>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fundingChainId, setFundingChainId] = useState(8_453);
  const [locallyDisconnected, setLocallyDisconnected] = useState(false);
  const [preferredWalletAddress, setPreferredWalletAddress] = useState<string>();
  const [waitingForPrivyWallet, setWaitingForPrivyWallet] = useState(false);
  const [requestedExternalAddress, setRequestedExternalAddress] = useState<string | null>(null);
  const { connectWallet: promptExternalWallet } = useConnectWallet({
    onSuccess: ({ wallet }) => {
      if (wallet.type === "ethereum") setRequestedExternalAddress(wallet.address);
    },
    onError: () => setActionError("The external wallet connection was not completed."),
  });

  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  const selectedWallet = locallyDisconnected
    ? undefined
    : selectActiveStaticsWallet(wallets, preferredWalletAddress ?? wagmiAccount.address);
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
  const targetChain = getStaticsChain(active.descriptor.chainId) ?? walletEnvironment.defaultChain;
  const fundingNetwork = getFundingNetwork(fundingChainId) ?? getFundingNetwork(8_453)!;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = Number(window.localStorage.getItem(FUNDING_CHAIN_STORAGE_KEY));
      if (Number.isSafeInteger(stored) && isFundingChainId(stored)) {
        setFundingChainId(stored);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!requestedExternalAddress) return;
    const requestedWallet = wallets.find(
      (wallet) => wallet.address.toLowerCase() === requestedExternalAddress.toLowerCase()
    );
    if (!requestedWallet) return;

    let cancelled = false;
    void setActiveWallet(requestedWallet)
      .then(() => {
        if (cancelled) return;
        setPreferredWalletAddress(requestedWallet.address);
        setWaitingForPrivyWallet(false);
        setLocallyDisconnected(false);
        setRequestedExternalAddress(null);
      })
      .catch(() => {
        if (cancelled) return;
        setActionError("The external wallet could not be activated.");
        setRequestedExternalAddress(null);
      });
    return () => {
      cancelled = true;
    };
  }, [requestedExternalAddress, setActiveWallet, wallets]);

  useEffect(() => {
    if (!waitingForPrivyWallet || !authenticated || !embeddedWallet) return;

    let cancelled = false;
    void setActiveWallet(embeddedWallet)
      .then(() => {
        if (cancelled) return;
        setPreferredWalletAddress(embeddedWallet.address);
        setWaitingForPrivyWallet(false);
        setLocallyDisconnected(false);
      })
      .catch(() => {
        if (cancelled) return;
        setWaitingForPrivyWallet(false);
        setActionError("The Privy embedded wallet could not be activated.");
      });
    return () => {
      cancelled = true;
    };
  }, [authenticated, embeddedWallet, setActiveWallet, waitingForPrivyWallet]);

  const runAction = useCallback(
    async (action: NonNullable<WalletState["busyAction"]>, operation: () => Promise<void>) => {
      setActionError(null);
      setBusyAction(action);
      try {
        await operation();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "The wallet request failed.");
      } finally {
        setBusyAction(null);
      }
    },
    []
  );

  const reconnectPrivyWallet = useCallback(
    () =>
      runAction("connect", async () => {
        await recoverPrivyWallet({
          embeddedWallet,
          authenticated,
          activateEmbedded: setActiveWallet,
          logout,
          selectEmbedded: (wallet) => setPreferredWalletAddress(wallet.address),
          restoreLocalConnection: () => setLocallyDisconnected(false),
          waitForEmbeddedWallet: () => setWaitingForPrivyWallet(true),
          openEmailLogin: () => login({ loginMethods: ["email"] }),
        });
      }),
    [authenticated, embeddedWallet, login, logout, runAction, setActiveWallet]
  );

  let status: WalletState["status"] = "loading";
  if (locallyDisconnected) status = "signed-out";
  else if (privyError) status = "error";
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
      locallyDisconnected,
      login: () => {
        if (locallyDisconnected) {
          void reconnectPrivyWallet();
          return;
        }
        login({ loginMethods: ["email", "wallet"] });
      },
      connectWallet: () => {
        if (locallyDisconnected) {
          return promptExternalWallet({ walletChainType: "ethereum-only" });
        }
        login({ loginMethods: ["wallet"] });
      },
      connectExternalWallet: () => {
        setActionError(null);
        promptExternalWallet({ walletChainType: "ethereum-only" });
      },
      disconnectWallet: () => {
        setWaitingForPrivyWallet(false);
        setLocallyDisconnected(true);
      },
      reconnectWallet: reconnectPrivyWallet,
      createWallet: () =>
        runAction("create", async () => {
          await createWallet();
        }),
      switchNetwork: () =>
        runAction("switch", async () => {
          if (!selectedWallet) throw new Error("Connect a wallet before switching networks.");
          await selectedWallet.switchChain(targetChain.id);
        }),
      selectFundingNetwork: (nextChainId) =>
        runAction("funding-switch", async () => {
          const nextNetwork = getFundingNetwork(nextChainId);
          if (!nextNetwork) throw new Error("Choose a supported funding network.");
          setFundingChainId(nextChainId);
          window.localStorage.setItem(FUNDING_CHAIN_STORAGE_KEY, String(nextChainId));
          if (!selectedWallet) return;
          await selectedWallet.switchChain(nextChainId);
        }),
      getEthereumProvider: async () => {
        if (!selectedWallet) return null;
        return selectedWallet.getEthereumProvider();
      },
      sendEvmTransaction: async (request) => {
        if (!selectedWallet || !address) throw new Error("Connect a wallet before continuing.");
        if (getAddress(address) !== getAddress(request.wallet)) {
          throw new Error("The transaction was prepared for a different wallet.");
        }
        if (chainId !== request.chainId) {
          throw new Error("Switch the connected wallet to the transaction network.");
        }

        if (walletKind === "embedded") {
          const result = await sendEmbeddedTransaction(
            {
              from: request.wallet,
              to: request.to,
              data: request.data,
              value: request.value,
              gasLimit: request.gasLimit,
              chainId: request.chainId,
            },
            {
              address,
              uiOptions: {
                showWalletUIs: true,
                description: request.presentation.description,
                buttonText: request.presentation.buttonText,
                transactionInfo: {
                  title: "Transaction details",
                  action: request.presentation.action,
                  contractInfo: { name: request.presentation.contractName },
                },
                successHeader: `${request.presentation.action} submitted`,
                successDescription: "The app will wait for onchain confirmation before continuing.",
                isCancellable: true,
              },
            }
          );
          return result.hash;
        }

        const transactionNetwork = getFundingNetwork(request.chainId);
        if (!transactionNetwork) throw new Error("The transaction network is not supported.");

        const provider = await selectedWallet.getEthereumProvider();
        const client = createWalletClient({
          account: request.wallet,
          chain: transactionNetwork.chain,
          transport: custom(provider),
        });
        return client.sendTransaction({
          account: request.wallet,
          chain: transactionNetwork.chain,
          to: request.to,
          data: request.data,
          value: request.value,
          gas: request.gasLimit,
        });
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
      locallyDisconnected,
      promptExternalWallet,
      privyError,
      reconnectPrivyWallet,
      runAction,
      selectedWallet,
      sendEmbeddedTransaction,
      status,
      targetChain,
      walletKind,
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
          extendedCalldataDecoding: true,
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
      <WagmiProvider config={wagmiConfig}>
        <WalletBridge>{children}</WalletBridge>
      </WagmiProvider>
    </PrivyProvider>
  );
}

function UnconfiguredWalletBridge({ children }: { children: React.ReactNode }) {
  const { active } = useDeployment();
  const [fundingChainId, setFundingChainId] = useState(8_453);
  const fundingNetwork = getFundingNetwork(fundingChainId) ?? getFundingNetwork(8_453)!;
  const value = useMemo<WalletState>(
    () => ({
      ...defaultWalletState,
      networkName: active.descriptor.network,
      targetChainId: active.descriptor.chainId,
      fundingChainId,
      fundingNetworkName: fundingNetwork.label,
      fundingNetworks: fundingNetworkSummaries,
      selectFundingNetwork: async (nextChainId) => {
        const nextNetwork = getFundingNetwork(nextChainId);
        if (!nextNetwork) return;
        setFundingChainId(nextChainId);
      },
    }),
    [active.descriptor.chainId, active.descriptor.network, fundingChainId, fundingNetwork.label]
  );
  return (
    <WalletContext.Provider value={value}>
      <SolanaWalletContext.Provider value={defaultSolanaWalletState}>
        {children}
      </SolanaWalletContext.Provider>
    </WalletContext.Provider>
  );
}

function ProtocolQueryReconciler() {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      subscribeToProtocolReconciliation((detail) =>
        queryClient.refetchQueries({
          type: "active",
          predicate: (query) => queryMatchesProtocolReconciliation(query.queryKey, detail),
        })
      ),
    [queryClient]
  );

  return null;
}

export function DAppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ProtocolQueryReconciler />
      <DeploymentProvider>
        {walletEnvironment.configured ? (
          <ConfiguredWalletProviders>{children}</ConfiguredWalletProviders>
        ) : (
          <UnconfiguredWalletBridge>{children}</UnconfiguredWalletBridge>
        )}
      </DeploymentProvider>
    </QueryClientProvider>
  );
}

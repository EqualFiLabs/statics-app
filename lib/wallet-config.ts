import { defineChain, http, type Chain, type Transport } from "viem";

export type WalletAppEnvironment = "development" | "staging" | "production";
export type WalletNetwork = "robinhood" | "robinhood-testnet" | "anvil";

const ROBINHOOD_TESTNET_RPC = "https://rpc.testnet.chain.robinhood.com";
const ROBINHOOD_MAINNET_RPC = "https://rpc.mainnet.chain.robinhood.com";

export const robinhoodMainnet = defineChain({
  id: 4_663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [ROBINHOOD_MAINNET_RPC] },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Explorer",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

export const robinhoodTestnet = defineChain({
  id: 46_630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [ROBINHOOD_TESTNET_RPC] },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Testnet Explorer",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
  testnet: true,
});

export const anvil = defineChain({
  id: 31_337,
  name: "Local Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
  testnet: true,
});

function parseEnvironment(value: string | undefined): WalletAppEnvironment {
  if (!value) return "development";
  if (value === "development" || value === "staging" || value === "production") return value;
  throw new Error("NEXT_PUBLIC_APP_ENV must be development, staging, or production.");
}

function parseNetwork(
  value: string | undefined,
  appEnvironment: WalletAppEnvironment
): WalletNetwork {
  const network = value || "robinhood-testnet";
  if (network !== "robinhood" && network !== "robinhood-testnet" && network !== "anvil") {
    throw new Error("NEXT_PUBLIC_APP_NETWORK must be robinhood, robinhood-testnet, or anvil.");
  }
  if (network === "anvil" && appEnvironment !== "development") {
    throw new Error("Anvil is only available when NEXT_PUBLIC_APP_ENV is development.");
  }
  return network;
}

function parsePublicRpc(value: string | undefined, variableName: string): string | null {
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be an absolute HTTP(S) URL.`);
  }

  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
    throw new Error(`${variableName} must be a credential-free HTTP(S) URL.`);
  }
  return url.toString();
}

export type WalletEnvironment = Readonly<{
  appEnvironment: WalletAppEnvironment;
  network: WalletNetwork;
  appId: string | null;
  clientId: string | null;
  robinhoodRpcUrl: string;
  robinhoodTestnetRpcUrl: string;
  anvilRpcUrl: string;
  defaultChain: Chain;
  supportedChains: readonly [Chain, ...Chain[]];
  configured: boolean;
}>;

export function readWalletEnvironment(
  environment: Record<string, string | undefined> = process.env
): WalletEnvironment {
  const appEnvironment = parseEnvironment(environment.NEXT_PUBLIC_APP_ENV);
  const network = parseNetwork(environment.NEXT_PUBLIC_APP_NETWORK, appEnvironment);
  const appId = environment.NEXT_PUBLIC_PRIVY_APP_ID?.trim() || null;
  const clientId = environment.NEXT_PUBLIC_PRIVY_CLIENT_ID?.trim() || null;
  const configuredRobinhoodRpc = parsePublicRpc(
    environment.NEXT_PUBLIC_ROBINHOOD_RPC_URL,
    "NEXT_PUBLIC_ROBINHOOD_RPC_URL"
  );
  const configuredRobinhoodTestnetRpc = parsePublicRpc(
    environment.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL,
    "NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL"
  );
  const configuredAnvilRpc = parsePublicRpc(
    environment.NEXT_PUBLIC_ANVIL_RPC_URL,
    "NEXT_PUBLIC_ANVIL_RPC_URL"
  );

  if (appEnvironment !== "development" && !appId) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is required outside development.");
  }
  if (appEnvironment !== "development" && network === "robinhood" && !configuredRobinhoodRpc) {
    throw new Error("NEXT_PUBLIC_ROBINHOOD_RPC_URL is required for Robinhood mainnet.");
  }
  if (
    appEnvironment !== "development" &&
    network === "robinhood-testnet" &&
    !configuredRobinhoodTestnetRpc
  ) {
    throw new Error("NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL is required for Robinhood testnet.");
  }

  const defaultChain =
    network === "anvil" ? anvil : network === "robinhood" ? robinhoodMainnet : robinhoodTestnet;
  return {
    appEnvironment,
    network,
    appId,
    clientId,
    robinhoodRpcUrl: configuredRobinhoodRpc ?? ROBINHOOD_MAINNET_RPC,
    robinhoodTestnetRpcUrl: configuredRobinhoodTestnetRpc ?? ROBINHOOD_TESTNET_RPC,
    anvilRpcUrl: configuredAnvilRpc ?? "http://127.0.0.1:8545/",
    defaultChain,
    supportedChains:
      appEnvironment === "development"
        ? ([
            defaultChain,
            ...[robinhoodMainnet, robinhoodTestnet, anvil].filter(
              (chain) => chain.id !== defaultChain.id
            ),
          ] as [Chain, ...Chain[]])
        : ([defaultChain] as const),
    configured: Boolean(appId),
  };
}

export function createWalletTransports(environment: WalletEnvironment): Record<number, Transport> {
  const transports: Record<number, Transport> = {
    [robinhoodMainnet.id]: http(environment.robinhoodRpcUrl),
    [robinhoodTestnet.id]: http(environment.robinhoodTestnetRpcUrl),
  };
  if (environment.appEnvironment === "development") {
    transports[anvil.id] = http(environment.anvilRpcUrl);
  }
  return transports;
}

export function getAddressExplorerUrl(chain: Chain, address: string): string | null {
  const explorer = chain.blockExplorers?.default.url;
  return explorer ? `${explorer}/address/${address}` : null;
}

export function getTransactionExplorerUrl(chainId: number, hash: string): string | null {
  const chain =
    chainId === robinhoodMainnet.id
      ? robinhoodMainnet
      : chainId === robinhoodTestnet.id
        ? robinhoodTestnet
        : null;
  return chain ? `${chain.blockExplorers.default.url}/tx/${hash}` : null;
}

export function getAddressExplorerUrlForChain(chainId: number, address: string): string | null {
  const chain =
    chainId === robinhoodMainnet.id
      ? robinhoodMainnet
      : chainId === robinhoodTestnet.id
        ? robinhoodTestnet
        : null;
  return chain ? `${chain.blockExplorers.default.url}/address/${address}` : null;
}

import { defineChain, http, type Chain, type Transport } from "viem";

export type WalletAppEnvironment = "development" | "staging" | "production";
export type WalletNetwork = "robinhood" | "robinhood-testnet" | "anvil";

// Robinhood reads go through the same-origin server proxy. The upstream RPC
// URL and credentials remain server-only; these paths are safe to expose.
const ROBINHOOD_MAINNET_RPC_PROXY = "/api/rpc/4663";
const ROBINHOOD_TESTNET_RPC_PROXY = "/api/rpc/46630";

export const robinhoodMainnet = defineChain({
  id: 4_663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [ROBINHOOD_MAINNET_RPC_PROXY] },
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
    default: { http: [ROBINHOOD_TESTNET_RPC_PROXY] },
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
    throw new Error("Local chains are only available when NEXT_PUBLIC_APP_ENV is development.");
  }
  return network;
}

function isLoopbackUrl(value: string): boolean {
  const hostname = new URL(value).hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
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

function chainWithRpc(chain: Chain, rpcUrl: string): Chain {
  return {
    ...chain,
    rpcUrls: {
      ...chain.rpcUrls,
      default: { http: [rpcUrl] },
    },
  };
}

export function readWalletEnvironment(
  environment: Record<string, string | undefined> = process.env
): WalletEnvironment {
  const appEnvironment = parseEnvironment(environment.NEXT_PUBLIC_APP_ENV);
  const network = parseNetwork(environment.NEXT_PUBLIC_APP_NETWORK, appEnvironment);
  const appId = environment.NEXT_PUBLIC_PRIVY_APP_ID?.trim() || null;
  const clientId = environment.NEXT_PUBLIC_PRIVY_CLIENT_ID?.trim() || null;
  const configuredAnvilRpc = parsePublicRpc(
    environment.NEXT_PUBLIC_ANVIL_RPC_URL,
    "NEXT_PUBLIC_ANVIL_RPC_URL"
  );

  if (appEnvironment !== "development" && !appId) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is required outside development.");
  }
  if (network === "anvil" && configuredAnvilRpc && !isLoopbackUrl(configuredAnvilRpc)) {
    throw new Error("NEXT_PUBLIC_ANVIL_RPC_URL must be loopback-only.");
  }

  const anvilRpcUrl = configuredAnvilRpc ?? "http://127.0.0.1:8545/";
  const configuredAnvil = chainWithRpc(anvil, anvilRpcUrl);
  const defaultChain =
    network === "anvil"
      ? configuredAnvil
      : network === "robinhood"
        ? robinhoodMainnet
        : robinhoodTestnet;
  const publicRobinhoodChains = [robinhoodMainnet, robinhoodTestnet];
  return {
    appEnvironment,
    network,
    appId,
    clientId,
    robinhoodRpcUrl: ROBINHOOD_MAINNET_RPC_PROXY,
    robinhoodTestnetRpcUrl: ROBINHOOD_TESTNET_RPC_PROXY,
    anvilRpcUrl,
    defaultChain,
    supportedChains: [
      defaultChain,
      ...publicRobinhoodChains.filter((chain) => chain.id !== defaultChain.id),
      ...(appEnvironment === "development" && defaultChain.id !== anvil.id
        ? [configuredAnvil]
        : []),
    ] as [Chain, ...Chain[]],
    configured: Boolean(appId),
  };
}

export function createWalletTransports(environment: WalletEnvironment): Record<number, Transport> {
  // These transports serve authoritative reads, simulations, and wallet
  // writes. Never fail over critical traffic to a public RPC with unknown
  // freshness, rate limits, or CORS behavior. Non-critical discovery uses the
  // Ponder HTTP API and its explicit onchain fallback in the caller.
  const batchedHttp = (url: string) => http(url, { batch: { batchSize: 50, wait: 8 } });
  const transports: Record<number, Transport> = {
    [robinhoodMainnet.id]: batchedHttp(environment.robinhoodRpcUrl),
    [robinhoodTestnet.id]: batchedHttp(environment.robinhoodTestnetRpcUrl),
  };
  if (environment.appEnvironment === "development") {
    transports[anvil.id] = batchedHttp(environment.anvilRpcUrl);
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

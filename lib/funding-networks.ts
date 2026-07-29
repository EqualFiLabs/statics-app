import type { Chain } from "viem";
import {
  arbitrum,
  avalanche,
  base,
  blast,
  bsc,
  celo,
  linea,
  mainnet,
  monad,
  optimism,
  polygon,
  soneium,
  tempo,
  unichain,
  worldchain,
  xLayer,
  zksync,
  zora,
} from "wagmi/chains";

import {
  anvil,
  robinhoodMainnet,
  robinhoodTestnet,
  readWalletEnvironment,
} from "@/lib/wallet-config";

export type FundingNetwork = Readonly<{
  chain: Chain;
  key: string;
  label: string;
  supportsUniswap: boolean;
}>;

/**
 * Local Anvil, offered only in development.
 *
 * Without it the wallet cannot be pointed at the chain the local stack runs on,
 * so balances, NFTs and transfers are untestable against the deployment that
 * actually has fixtures in it. Gated because a public build offering a
 * localhost RPC would be nonsense.
 *
 * Uniswap support is false: the routing APIs the swap panel calls are public
 * services that know nothing about a local chain, so offering swaps here would
 * fail in a way that looks like a bug in the app.
 */
const developmentFundingNetworks: readonly FundingNetwork[] =
  readWalletEnvironment().appEnvironment === "development"
    ? [{ key: "anvil", label: "Local Anvil", chain: anvil, supportsUniswap: false }]
    : [];

export const fundingNetworks: readonly FundingNetwork[] = [
  ...developmentFundingNetworks,
  { key: "ethereum", label: "Ethereum", chain: mainnet, supportsUniswap: true },
  { key: "optimism", label: "OP Mainnet", chain: optimism, supportsUniswap: true },
  { key: "bnb", label: "BNB Smart Chain", chain: bsc, supportsUniswap: true },
  { key: "unichain", label: "Unichain", chain: unichain, supportsUniswap: true },
  { key: "polygon", label: "Polygon", chain: polygon, supportsUniswap: true },
  { key: "monad", label: "Monad", chain: monad, supportsUniswap: true },
  { key: "x-layer", label: "X Layer", chain: xLayer, supportsUniswap: true },
  { key: "zksync", label: "zkSync", chain: zksync, supportsUniswap: true },
  { key: "world-chain", label: "World Chain", chain: worldchain, supportsUniswap: true },
  { key: "soneium", label: "Soneium", chain: soneium, supportsUniswap: true },
  { key: "tempo", label: "Tempo", chain: tempo, supportsUniswap: true },
  {
    key: "robinhood-testnet",
    label: "Robinhood Testnet",
    chain: robinhoodTestnet,
    supportsUniswap: false,
  },
  { key: "robinhood", label: "Robinhood Chain", chain: robinhoodMainnet, supportsUniswap: true },
  { key: "base", label: "Base", chain: base, supportsUniswap: true },
  { key: "arbitrum", label: "Arbitrum", chain: arbitrum, supportsUniswap: true },
  { key: "celo", label: "Celo", chain: celo, supportsUniswap: true },
  { key: "avalanche", label: "Avalanche", chain: avalanche, supportsUniswap: true },
  { key: "linea", label: "Linea", chain: linea, supportsUniswap: true },
  { key: "blast", label: "Blast", chain: blast, supportsUniswap: true },
  { key: "zora", label: "Zora", chain: zora, supportsUniswap: true },
] as const;

const fundingNetworksById = new Map(fundingNetworks.map((network) => [network.chain.id, network]));

export function getFundingNetwork(chainId: number): FundingNetwork | null {
  return fundingNetworksById.get(chainId) ?? null;
}

export function isFundingChainId(chainId: number): boolean {
  return fundingNetworksById.has(chainId);
}

const RPC_ENV_BY_CHAIN: Record<number, string> = {
  4_663: "STATICS_ROBINHOOD_MAINNET_RPC_URL",
  46_630: "STATICS_ROBINHOOD_TESTNET_RPC_URL",
};

const WALLET_RPC_ENV_BY_CHAIN: Record<number, string> = {
  4_663: "STATICS_ROBINHOOD_MAINNET_WALLET_RPC_URL",
  46_630: "STATICS_ROBINHOOD_TESTNET_WALLET_RPC_URL",
};

function configuredRpcUrl(
  chainId: number,
  variablesByChain: Record<number, string>,
  environment: Record<string, string | undefined>
): string {
  const variableName = variablesByChain[chainId];
  if (!variableName) throw new Error("Unsupported Robinhood chain.");
  const value = environment[variableName]?.trim();
  if (!value) throw new Error(`${variableName} is not configured on the server.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be an absolute HTTP(S) URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${variableName} must be an HTTP(S) URL.`);
  }
  return url.toString();
}

export function robinhoodRpcUrl(
  chainId: number,
  environment: Record<string, string | undefined> = process.env
): string {
  return configuredRpcUrl(chainId, RPC_ENV_BY_CHAIN, environment);
}

export function robinhoodWalletRpcUrl(
  chainId: number,
  environment: Record<string, string | undefined> = process.env
): string {
  return configuredRpcUrl(chainId, WALLET_RPC_ENV_BY_CHAIN, environment);
}

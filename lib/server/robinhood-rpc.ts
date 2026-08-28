const RPC_ENV_BY_CHAIN: Record<number, string> = {
  4_663: "STATICS_ROBINHOOD_MAINNET_RPC_URL",
  46_630: "STATICS_ROBINHOOD_TESTNET_RPC_URL",
};

export function robinhoodRpcUrl(
  chainId: number,
  environment: Record<string, string | undefined> = process.env
): string {
  const variableName = RPC_ENV_BY_CHAIN[chainId];
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

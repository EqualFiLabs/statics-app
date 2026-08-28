function configuredUrls(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

export function rpcUrlsForChain(chainId: number): string | string[] {
  const urls = configuredUrls(process.env[`PONDER_RPC_URLS_${chainId}`]);
  if (urls.length > 1) return urls;
  if (urls.length === 1) return urls[0]!;

  const fallback = process.env[`PONDER_RPC_URL_${chainId}`]?.trim();
  if (!fallback) {
    throw new Error(`PONDER_RPC_URLS_${chainId} or PONDER_RPC_URL_${chainId} is required.`);
  }
  return fallback;
}

type Environment = Record<string, string | undefined>;

export function staticsMainnetIndexerUrl(
  path: string,
  environment: Environment = process.env
): URL {
  const raw = environment.NEXT_PUBLIC_STATICS_MAINNET_INDEXER_URL?.trim();
  if (!raw) throw new Error("NEXT_PUBLIC_STATICS_MAINNET_INDEXER_URL is not configured.");
  const base = new URL(raw);
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new Error("The Statics indexer URL must use HTTP(S).");
  }
  base.pathname = `${base.pathname.replace(/\/+$/, "")}/`;
  return new URL(path.replace(/^\/+/, ""), base);
}

import { getAddress, type Address } from "viem";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGES = 100;

type IdPage = Readonly<{
  items: readonly Readonly<{ id: string }>[];
  nextCursor: string | null;
}>;

function configuredIndexerUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_STATICS_INDEXER_URL?.trim();
  if (!value) return null;
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error("NEXT_PUBLIC_STATICS_INDEXER_URL must be a valid URL.");
  }
}

function parseId(value: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error("The Statics indexer returned an invalid ID.");
  return BigInt(value);
}

async function loadIds(path: string, indexerUrl = configuredIndexerUrl()): Promise<bigint[]> {
  if (!indexerUrl) throw new Error("No Statics indexer is configured.");
  const values: bigint[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(`${indexerUrl}${path}`);
    url.searchParams.set("limit", String(DEFAULT_PAGE_SIZE));
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(4_000) });
    if (!response.ok) throw new Error(`Statics indexer request failed (${response.status}).`);
    const body = (await response.json()) as IdPage;
    if (
      !Array.isArray(body.items) ||
      !(body.nextCursor === null || typeof body.nextCursor === "string")
    ) {
      throw new Error("The Statics indexer returned an invalid page.");
    }
    values.push(...body.items.map((item) => parseId(item.id)));
    if (!body.nextCursor) return [...new Set(values.map(String))].map(BigInt);
    if (body.nextCursor === cursor)
      throw new Error("The Statics indexer returned a stalled cursor.");
    cursor = body.nextCursor;
  }
  throw new Error("The Statics indexer exceeded its pagination limit.");
}

export async function loadRecoverableLoanIds(
  asOf: bigint,
  indexerUrl?: string | null
): Promise<bigint[]> {
  return loadIds(
    `/loans/recoverable?asOf=${asOf.toString()}`,
    indexerUrl === undefined ? configuredIndexerUrl() : indexerUrl
  );
}

export async function loadWalletV4PositionIds(
  owner: Address,
  indexerUrl?: string | null
): Promise<bigint[]> {
  return loadIds(
    `/wallets/${getAddress(owner)}/v4-positions`,
    indexerUrl === undefined ? configuredIndexerUrl() : indexerUrl
  );
}

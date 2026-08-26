"use client";

import { parseAbi, type Address, type PublicClient } from "viem";

/**
 * Resolves the artwork for an NFT, when it has any.
 *
 * Statics Operators NFTs return self-contained onchain JSON and SVG metadata.
 * PositionNFT metadata is intentionally text-only, while other collections can
 * omit metadata or depend on an unavailable gateway, so no resolution step
 * throws and callers retain a deliberate placeholder.
 *
 * Metadata can arrive three ways and all three are common:
 *   data:  -- encoded inline, typical of fully onchain collections
 *   ipfs:  -- needs a gateway
 *   http   -- fetched directly
 */

export const tokenUriAbi = parseAbi(["function tokenURI(uint256 tokenId) view returns (string)"]);

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

/** Rewrites ipfs:// to a gateway and leaves anything else alone. */
export function resolveUri(uri: string): string {
  const trimmed = uri.trim();
  if (trimmed.startsWith("ipfs://")) {
    return `${IPFS_GATEWAY}${trimmed.slice("ipfs://".length).replace(/^ipfs\//, "")}`;
  }
  return trimmed;
}

function decodeDataUri(uri: string): unknown {
  const comma = uri.indexOf(",");
  if (comma === -1) return null;
  const meta = uri.slice(0, comma);
  const payload = uri.slice(comma + 1);
  try {
    const decoded = meta.includes(";base64") ? atob(payload) : decodeURIComponent(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function imageFromMetadata(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null) return null;
  const candidate =
    (metadata as { image?: unknown }).image ?? (metadata as { image_url?: unknown }).image_url;
  return typeof candidate === "string" && candidate.trim() ? resolveUri(candidate) : null;
}

/** One entry of an ERC-721 metadata `attributes` array. */
export type NftTrait = Readonly<{
  label: string;
  value: string;
  /** Set when the trait declares `display_type: "number"`, as tiers do. */
  max: number | null;
}>;

export type NftMetadata = Readonly<{
  image: string | null;
  traits: readonly NftTrait[];
}>;

const EMPTY_METADATA: NftMetadata = { image: null, traits: [] };

/**
 * Reads the `attributes` array, tolerating every shape a collection might use.
 *
 * Statics Operators returns eight string traits plus a numeric Activation Tier
 * carrying a `max_value`. Arbitrary collections return anything at all, so a
 * malformed entry is skipped rather than failing the whole list -- artwork must
 * still render when the traits beside it are unusable.
 */
function traitsFromMetadata(metadata: unknown): readonly NftTrait[] {
  if (typeof metadata !== "object" || metadata === null) return [];
  const attributes = (metadata as { attributes?: unknown }).attributes;
  if (!Array.isArray(attributes)) return [];

  const traits: NftTrait[] = [];
  for (const entry of attributes) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const label = typeof record.trait_type === "string" ? record.trait_type.trim() : "";
    const rawValue = record.value;
    if (!label) continue;
    if (typeof rawValue !== "string" && typeof rawValue !== "number") continue;
    const value = String(rawValue).trim();
    if (!value) continue;
    const rawMax = record.max_value;
    traits.push({
      label,
      value,
      max: typeof rawMax === "number" && Number.isFinite(rawMax) ? rawMax : null,
    });
  }
  return traits;
}

/**
 * Reads a token's metadata once and returns both its artwork and its traits.
 *
 * The traits come free with the image: the metadata document is already
 * decoded to find `image`, so surfacing `attributes` costs no extra RPC and no
 * extra fetch. Never throws, for the same reason `resolveNftImage` does not.
 */
export async function resolveNftMetadata(
  publicClient: PublicClient,
  contract: Address,
  tokenId: bigint,
  signal?: AbortSignal
): Promise<NftMetadata> {
  let uri: string;
  try {
    uri = await publicClient.readContract({
      address: contract,
      abi: tokenUriAbi,
      functionName: "tokenURI",
      args: [tokenId],
    });
  } catch {
    return EMPTY_METADATA;
  }

  // Missing metadata is valid for arbitrary user-added collections.
  if (!uri || !uri.trim()) return EMPTY_METADATA;

  if (uri.startsWith("data:")) {
    const metadata = decodeDataUri(uri);
    return { image: imageFromMetadata(metadata), traits: traitsFromMetadata(metadata) };
  }

  const resolved = resolveUri(uri);
  if (!/^https?:\/\//i.test(resolved)) return EMPTY_METADATA;

  try {
    const response = await fetch(resolved, { signal });
    if (!response.ok) return EMPTY_METADATA;
    const contentType = response.headers.get("content-type") ?? "";
    // Some collections point tokenURI straight at an image rather than JSON.
    if (contentType.startsWith("image/")) return { image: resolved, traits: [] };
    const metadata: unknown = await response.json();
    return { image: imageFromMetadata(metadata), traits: traitsFromMetadata(metadata) };
  } catch {
    return EMPTY_METADATA;
  }
}

/**
 * Reads a token's metadata and returns its image URL, or null.
 *
 * Never throws. An NFT without artwork is a normal state, and a card that fails
 * to render because a gateway is down would be worse than one showing a
 * placeholder.
 */
export async function resolveNftImage(
  publicClient: PublicClient,
  contract: Address,
  tokenId: bigint,
  signal?: AbortSignal
): Promise<string | null> {
  const metadata = await resolveNftMetadata(publicClient, contract, tokenId, signal);
  return metadata.image;
}

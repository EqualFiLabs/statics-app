"use client";

import { parseAbi, type Address, type PublicClient } from "viem";

/**
 * Resolves the artwork for an NFT, when it has any.
 *
 * Statics positions return self-contained onchain JSON and SVG metadata. Other
 * collections can still omit metadata or depend on an unavailable gateway, so
 * no resolution step throws and callers retain a deliberate placeholder.
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
  let uri: string;
  try {
    uri = await publicClient.readContract({
      address: contract,
      abi: tokenUriAbi,
      functionName: "tokenURI",
      args: [tokenId],
    });
  } catch {
    return null;
  }

  // Missing metadata is valid for arbitrary user-added collections.
  if (!uri || !uri.trim()) return null;

  if (uri.startsWith("data:")) return imageFromMetadata(decodeDataUri(uri));

  const resolved = resolveUri(uri);
  if (!/^https?:\/\//i.test(resolved)) return null;

  try {
    const response = await fetch(resolved, { signal });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    // Some collections point tokenURI straight at an image rather than JSON.
    if (contentType.startsWith("image/")) return resolved;
    return imageFromMetadata(await response.json());
  } catch {
    return null;
  }
}

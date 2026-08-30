import { getAddress, type Address } from "viem";

import operatorCatalog from "@/lib/generated/operator-assets.json";

export type NftTrait = Readonly<{
  label: string;
  value: string;
  max: number | null;
}>;

const operatorSignalColors = ["#8CFF00", "#00E5FF", "#FFB000", "#FF3344", "#B55CFF", "#FFFFFF"];

export type OperatorArtwork = Readonly<{
  src: string;
  accent: string;
}>;

export function operatorArtwork(
  chainId: number,
  contract: Address,
  tokenId: bigint
): OperatorArtwork | null {
  if (
    chainId !== operatorCatalog.chainId ||
    getAddress(contract) !== getAddress(operatorCatalog.collection) ||
    tokenId < 1n ||
    tokenId > BigInt(operatorCatalog.maximumSupply)
  ) {
    return null;
  }
  const id = Number(tokenId);
  const signal = Number(operatorCatalog.signalVariants[id - 1]);
  return {
    src: `${operatorCatalog.assetBasePath}/${id}.svg`,
    accent: operatorSignalColors[signal] ?? operatorSignalColors[0],
  };
}

export async function loadOperatorTraits(
  chainId: number,
  contract: Address,
  tokenId: bigint,
  signal?: AbortSignal
): Promise<readonly NftTrait[]> {
  const artwork = operatorArtwork(chainId, contract, tokenId);
  if (!artwork) return [];
  try {
    const response = await fetch(artwork.src, { signal });
    if (!response.ok) return [];
    const svg = await response.text();
    const encoded = svg.match(
      /<metadata id="statics-operator-traits">([A-Za-z0-9+/=]+)<\/metadata>/
    )?.[1];
    if (!encoded) return [];
    const decoded: unknown = JSON.parse(atob(encoded));
    if (!Array.isArray(decoded)) return [];
    return decoded.filter(
      (trait): trait is NftTrait =>
        typeof trait === "object" &&
        trait !== null &&
        typeof trait.label === "string" &&
        typeof trait.value === "string" &&
        trait.max === null
    );
  } catch {
    return [];
  }
}

const positionMark =
  '<path fill="#fefefe" d="M33 34h94v40H75v37h51v40H33z"/>' +
  '<path fill="#fefefe" d="M132 34h91v40h-91z"/>' +
  '<path fill="#fefefe" d="M131 111h92v72h-40v-32h-52z"/>' +
  '<path fill="#fefefe" d="M33 186h94v40H33z"/>' +
  '<path fill="#fefefe" d="M132 186h47v40h-47z"/>' +
  '<path fill="#82ca17" d="M183 186h40v40h-40z"/>';

/** Exact local port of LibPositionSVG for deterministic Statics PositionNFT artwork. */
export function positionArtworkDataUri(positionId: bigint): string {
  const id = positionId.toString();
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img">' +
    `<title>Statics Position #${id}</title>` +
    '<rect width="256" height="256" fill="#fefefe"/>' +
    '<rect x="15" y="15" width="226" height="226" fill="#000000"/>' +
    '<g transform="translate(32 12) scale(.75)" shape-rendering="crispEdges">' +
    positionMark +
    "</g>" +
    `<text x="128" y="225" fill="#fefefe" font-family="monospace" font-size="14" font-weight="700" text-anchor="middle">POSITION #${id}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

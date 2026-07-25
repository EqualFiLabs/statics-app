"use client";

import { PublicKey } from "@solana/web3.js";

import { SOLANA_USDC_MINT, SOL_MINT } from "@/lib/portal/solana";
import { SOL_TOKEN_ICON_URI } from "@/lib/token-icons";
import { TOKEN_PROGRAM_ID } from "@/lib/solana-wallet";

export type SolanaToken = Readonly<{
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tokenProgramId?: string;
  isDefault?: boolean;
}>;

const storageKey = "statics:wallet:solana-tokens:mainnet";
const changeEvent = "statics-solana-wallet-tokens-changed";

export const DEFAULT_SOLANA_TOKENS: SolanaToken[] = [
  {
    mint: SOL_MINT,
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI: SOL_TOKEN_ICON_URI,
    isDefault: true,
  },
  {
    mint: SOLANA_USDC_MINT,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    tokenProgramId: TOKEN_PROGRAM_ID.toBase58(),
    isDefault: true,
  },
];

export function validSolanaPublicKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}

export function loadSolanaTokens(): SolanaToken[] {
  if (typeof window === "undefined") return DEFAULT_SOLANA_TOKENS;
  let stored: SolanaToken[] = [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    if (Array.isArray(parsed)) {
      stored = parsed.flatMap((item): SolanaToken[] => {
        if (!item || typeof item !== "object") return [];
        const token = item as Record<string, unknown>;
        if (
          !validSolanaPublicKey(token.mint) ||
          typeof token.symbol !== "string" ||
          typeof token.name !== "string" ||
          !Number.isInteger(token.decimals)
        ) {
          return [];
        }
        return [
          {
            mint: token.mint,
            symbol: token.symbol,
            name: token.name,
            decimals: Number(token.decimals),
            ...(typeof token.logoURI === "string" ? { logoURI: token.logoURI } : {}),
            ...(validSolanaPublicKey(token.tokenProgramId)
              ? { tokenProgramId: token.tokenProgramId }
              : {}),
          },
        ];
      });
    }
  } catch {
    stored = [];
  }
  return [...DEFAULT_SOLANA_TOKENS, ...stored].filter(
    (token, index, tokens) =>
      tokens.findIndex((candidate) => candidate.mint === token.mint) === index
  );
}

export function saveSolanaTokens(tokens: readonly SolanaToken[]) {
  window.localStorage.setItem(
    storageKey,
    JSON.stringify(tokens.filter((token) => !token.isDefault))
  );
  window.dispatchEvent(new CustomEvent(changeEvent));
}

export function subscribeSolanaTokens(listener: () => void) {
  window.addEventListener(changeEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(changeEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

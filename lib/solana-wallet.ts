"use client";

import { Buffer } from "buffer";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

export const SOLANA_MAINNET_CHAIN = "solana:mainnet";
export const SOLANA_MAINNET_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL?.trim() ||
  (process.env.NEXT_PUBLIC_PRIVY_APP_ID
    ? `https://solana-mainnet.rpc.privy.systems?privyAppId=${encodeURIComponent(process.env.NEXT_PUBLIC_PRIVY_APP_ID)}`
    : "https://api.mainnet-beta.solana.com");
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPF4wj6Eh4E6J7eiVn13");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

export function findAssociatedTokenAddress(input: {
  owner: PublicKey;
  mint: PublicKey;
  tokenProgramId: PublicKey;
}) {
  return PublicKey.findProgramAddressSync(
    [input.owner.toBuffer(), input.tokenProgramId.toBuffer(), input.mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

export function createAssociatedTokenInstruction(input: {
  payer: PublicKey;
  owner: PublicKey;
  mint: PublicKey;
  associatedToken: PublicKey;
  tokenProgramId: PublicKey;
}) {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: input.payer, isSigner: true, isWritable: true },
      { pubkey: input.associatedToken, isSigner: false, isWritable: true },
      { pubkey: input.owner, isSigner: false, isWritable: false },
      { pubkey: input.mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: input.tokenProgramId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}

export function createTransferCheckedInstruction(input: {
  source: PublicKey;
  mint: PublicKey;
  destination: PublicKey;
  owner: PublicKey;
  amount: bigint;
  decimals: number;
  tokenProgramId: PublicKey;
}) {
  const data = Buffer.alloc(10);
  data[0] = 12;
  data.writeBigUInt64LE(input.amount, 1);
  data[9] = input.decimals;
  return new TransactionInstruction({
    programId: input.tokenProgramId,
    keys: [
      { pubkey: input.source, isSigner: false, isWritable: true },
      { pubkey: input.mint, isSigner: false, isWritable: false },
      { pubkey: input.destination, isSigner: false, isWritable: true },
      { pubkey: input.owner, isSigner: true, isWritable: false },
    ],
    data,
  });
}

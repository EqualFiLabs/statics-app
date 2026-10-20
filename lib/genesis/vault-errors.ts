import { decodeErrorResult, parseAbi, type Hex } from "viem";
import { staticsGenesisAbi, staticsGenesisVaultAbi } from "@statics-protocol/sdk";
import { staticsGenesisCreditAbi } from "@statics-protocol/sdk/genesis-credit";

export const genesisVaultRecoveryErrors = parseAbi([
  "error GenesisNotInVault(uint256 tokenId)",
  "error GenesisLocked(uint256 genesisId)",
  "error CreditAlreadyActive(uint256 genesisId)",
  "error NotGenesisOwner(uint256 tokenId,address caller,address owner)",
  "error ERC721InvalidApprover(address approver)",
  "error ERC721IncorrectOwner(address sender,uint256 tokenId,address owner)",
]);

/** viem's raw call errors can carry encoded revert data inside nested causes. */
export function genesisVaultErrorName(error: unknown): string | null {
  const seen = new Set<unknown>();
  let cause = error;
  while (cause && typeof cause === "object" && !seen.has(cause)) {
    seen.add(cause);
    const entry = cause as { data?: unknown; raw?: unknown; cause?: unknown };
    for (const value of [entry.data, entry.raw]) {
      if (typeof value !== "string" || !/^0x[0-9a-fA-F]{8,}$/.test(value)) continue;
      try {
        return decodeErrorResult({
          abi: [
            ...genesisVaultRecoveryErrors,
            ...staticsGenesisVaultAbi,
            ...staticsGenesisAbi,
            ...staticsGenesisCreditAbi,
          ],
          data: value as Hex,
        }).errorName;
      } catch {
        /* Try the next cause. */
      }
    }
    cause = entry.cause;
  }
  return null;
}

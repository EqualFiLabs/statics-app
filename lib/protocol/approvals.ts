import { maxUint48, maxUint160, maxUint256, parseAbi } from "viem";

export const MAX_ERC20_ALLOWANCE = maxUint256;
export const MAX_PERMIT2_ALLOWANCE = maxUint160;
export const MAX_PERMIT2_EXPIRATION = Number(maxUint48);
export const operatorApprovalAbi = parseAbi([
  "function isApprovedForAll(address owner,address operator) view returns (bool)",
  "function setApprovalForAll(address operator,bool approved)",
]);

export function hasUsablePermit2Allowance(
  allowance: bigint,
  expiration: number,
  required: bigint,
  currentTimestamp: number
): boolean {
  return allowance >= required && expiration > currentTimestamp;
}

export function approvalStatusLabel(
  kind: "erc20" | "permit2" | "operator" | "erc721-token",
  allowance: bigint,
  expiration?: number,
  currentTimestamp?: number
): "Maximum" | "Custom" | "Revoked" {
  if (
    allowance === 0n ||
    ((kind === "operator" || kind === "erc721-token") && allowance !== 1n) ||
    (kind === "permit2" &&
      expiration !== undefined &&
      currentTimestamp !== undefined &&
      expiration <= currentTimestamp)
  ) {
    return "Revoked";
  }
  if (
    (kind === "erc20" && allowance === MAX_ERC20_ALLOWANCE) ||
    (kind === "permit2" &&
      allowance === MAX_PERMIT2_ALLOWANCE &&
      expiration === MAX_PERMIT2_EXPIRATION) ||
    ((kind === "operator" || kind === "erc721-token") && allowance === 1n)
  ) {
    return "Maximum";
  }
  return "Custom";
}

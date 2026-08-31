import { getAddress, isHex, size, zeroAddress, type Address, type Hex } from "viem";

type Environment = Record<string, string | undefined>;

export function configuredAddress(
  name: string,
  environment: Environment = process.env
): Address | undefined {
  const value = environment[name]?.trim();
  if (!value) return undefined;
  const address = getAddress(value);
  return address === zeroAddress ? undefined : address;
}

export function configuredCanonicalPool(
  poolManager: Address | undefined,
  environment: Environment = process.env
): Hex | undefined {
  const value = environment.PONDER_CANONICAL_POOL_ID?.trim();
  if (!poolManager && !value) return undefined;
  if (!poolManager || !value) {
    throw new Error(
      "PONDER_POOL_MANAGER_ADDRESS and PONDER_CANONICAL_POOL_ID must be configured together."
    );
  }
  if (!isHex(value, { strict: true }) || size(value) !== 32) {
    throw new Error("PONDER_CANONICAL_POOL_ID must be a 32-byte hex value.");
  }
  return value;
}

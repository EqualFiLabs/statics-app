export interface ManifestToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoUri?: string;
}

export interface ManifestPool {
  poolId: string;
  poolKey: {
    currency0: string;
    currency1: string;
    fee: number;
    tickSpacing: number;
    hooks: string;
  };
  token0: ManifestToken;
  token1: ManifestToken;
  enabled: boolean;
  registrationBlock: string;
}

export interface IndexedPool {
  poolId: string;
  poolKey: ManifestPool["poolKey"];
  createdAtBlock: string;
  token0: ManifestToken;
  token1: ManifestToken;
}

export function listIndexedPools(options: {
  indexerUrl: string;
  deploymentId: string;
  fetch?: typeof fetch;
}): Promise<IndexedPool[]>;

export function unlistedPools(
  manifest: { supportedPools: readonly ManifestPool[] },
  indexed: readonly IndexedPool[]
): IndexedPool[];

export function addPools<
  T extends {
    supportedPools: ManifestPool[];
    deploymentStartBlock: string;
    contracts: { publicHook: { address: string } };
  },
>(manifest: T, poolIds: readonly string[], indexed: readonly IndexedPool[]): T;

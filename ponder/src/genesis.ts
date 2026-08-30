import { getAddress, zeroAddress, type Address } from "viem";

const GENESIS_SUPPLY = 5_555n;

export type GenesisNftRow = {
  key: string;
  deploymentId: string;
  id: bigint;
  owner: Address;
  tier: number;
  multiplierBps: number;
  linkedPositionId: bigint;
  registered: boolean;
  effectiveWeight: bigint;
  updatedAtBlock: bigint;
};

type GenesisNftUpsertMutation = {
  type: "upsert";
  row: GenesisNftRow;
  update: Partial<GenesisNftRow>;
};

export type GenesisNftMutation = { type: "delete"; key: string } | GenesisNftUpsertMutation;

const genesisKey = (deploymentId: string, genesisId: bigint) => `${deploymentId}:${genesisId}`;

export function genesisTransferMutation(input: {
  deploymentId: string;
  genesisId: bigint;
  to: Address;
  vault?: Address;
  blockNumber: bigint;
}): GenesisNftMutation {
  const key = genesisKey(input.deploymentId, input.genesisId);
  if (
    input.to === zeroAddress ||
    (input.vault !== undefined && input.to.toLowerCase() === input.vault.toLowerCase())
  ) {
    return { type: "delete", key };
  }

  const owner = getAddress(input.to);
  return {
    type: "upsert",
    row: {
      key,
      deploymentId: input.deploymentId,
      id: input.genesisId,
      owner,
      tier: 0,
      multiplierBps: 10_000,
      linkedPositionId: 0n,
      registered: false,
      effectiveWeight: 0n,
      updatedAtBlock: input.blockNumber,
    },
    update: {
      owner,
      tier: 0,
      multiplierBps: 10_000,
      linkedPositionId: 0n,
      updatedAtBlock: input.blockNumber,
    },
  };
}

export function genesisWeightChangedMutation(input: {
  deploymentId: string;
  genesisId: bigint;
  vault: Address;
  newWeight: bigint;
  blockNumber: bigint;
}): GenesisNftUpsertMutation {
  // StaticsGenesis notifies the activation registry before ERC-721 emits Transfer. A vault exit
  // therefore changes distributor weight one log before the ownership row becomes circulating.
  return {
    type: "upsert",
    row: {
      key: genesisKey(input.deploymentId, input.genesisId),
      deploymentId: input.deploymentId,
      id: input.genesisId,
      owner: getAddress(input.vault),
      tier: 0,
      multiplierBps: 10_000,
      linkedPositionId: 0n,
      registered: true,
      effectiveWeight: input.newWeight,
      updatedAtBlock: input.blockNumber,
    },
    update: {
      registered: true,
      effectiveWeight: input.newWeight,
      updatedAtBlock: input.blockNumber,
    },
  };
}

export function nextAvailableGenesisId(circulatingIds: readonly bigint[]): bigint | null {
  const circulating = new Set(circulatingIds.map(String));
  for (let id = 1n; id <= GENESIS_SUPPLY; id += 1n) {
    if (!circulating.has(id.toString())) return id;
  }
  return null;
}

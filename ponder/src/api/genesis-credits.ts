export type RecoverableGenesisCreditRecord = Readonly<{
  deploymentId: string;
  genesisId: bigint;
  owner: `0x${string}`;
  principal: bigint;
  maturity: bigint;
  recoverableAt: bigint;
}>;

export function recoverableGenesisCreditPage(
  rows: readonly RecoverableGenesisCreditRecord[],
  deploymentId: string,
  asOf: bigint,
  limit: number
): Readonly<{
  items: readonly RecoverableGenesisCreditRecord[];
  hasNextPage: boolean;
}> {
  const matching = rows.filter(
    (row) => row.deploymentId === deploymentId && row.recoverableAt < asOf
  );
  return { items: matching.slice(0, limit), hasNextPage: matching.length > limit };
}

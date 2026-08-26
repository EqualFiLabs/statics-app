export type ActiveGenesisCreditRow = Readonly<{
  key: string;
  deploymentId: string;
  genesisId: bigint;
  owner: `0x${string}`;
  principal: bigint;
  maturity: bigint;
  recoverableAt: bigint;
  updatedAtBlock: bigint;
}>;

type OpenedTransition = Readonly<{
  type: "opened";
  deploymentId: string;
  genesisId: bigint;
  owner: `0x${string}`;
  principal: bigint;
  maturity: bigint;
  recoverableAt: bigint;
  blockNumber: bigint;
}>;

type ExtendedTransition = Readonly<{
  type: "extended";
  deploymentId: string;
  genesisId: bigint;
  maturity: bigint;
  recoverableAt: bigint;
  blockNumber: bigint;
}>;

type ClosedTransition = Readonly<{
  type: "repaid" | "recovered";
  deploymentId: string;
  genesisId: bigint;
}>;

export type ActiveGenesisCreditMutation =
  | Readonly<{ type: "insert"; row: ActiveGenesisCreditRow }>
  | Readonly<{
      type: "update";
      key: string;
      values: Pick<ActiveGenesisCreditRow, "maturity" | "recoverableAt" | "updatedAtBlock">;
    }>
  | Readonly<{ type: "delete"; key: string }>;

export function activeGenesisCreditMutation(
  transition: OpenedTransition | ExtendedTransition | ClosedTransition
): ActiveGenesisCreditMutation {
  const key = `${transition.deploymentId}:${transition.genesisId}`;
  if (transition.type === "opened") {
    return {
      type: "insert",
      row: {
        key,
        deploymentId: transition.deploymentId,
        genesisId: transition.genesisId,
        owner: transition.owner,
        principal: transition.principal,
        maturity: transition.maturity,
        recoverableAt: transition.recoverableAt,
        updatedAtBlock: transition.blockNumber,
      },
    };
  }
  if (transition.type === "extended") {
    return {
      type: "update",
      key,
      values: {
        maturity: transition.maturity,
        recoverableAt: transition.recoverableAt,
        updatedAtBlock: transition.blockNumber,
      },
    };
  }
  return { type: "delete", key };
}

export type LocalControlCommand =
  | { action: "status" }
  | {
      action: "fund-wallet";
      address: `0x${string}`;
      eth: string;
      weth: string;
    }
  | { action: "advance"; seconds: number }
  | { action: "generate-rewards"; positionId: string; shares: string }
  | {
      action: "generate-lp-fees";
      positionId: string;
      tokenId: string;
      amount: string;
    }
  | { action: "seed-recovery"; loanId: string };

export function parseLocalControlCommand(
  action: string | undefined,
  arguments_: string[]
): LocalControlCommand;

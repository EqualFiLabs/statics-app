export type LocalControlCommand =
  | { action: "status" }
  | {
      action: "fund-wallet";
      address: `0x${string}`;
      eth: string;
      weth: string;
    }
  | { action: "advance"; seconds: number };

export function parseLocalControlCommand(
  action: string | undefined,
  arguments_: string[]
): LocalControlCommand;

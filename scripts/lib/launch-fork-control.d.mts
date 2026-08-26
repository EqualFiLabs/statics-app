export type LaunchForkCommand =
  | { action: "status" }
  | { action: "advance-time"; seconds: number }
  | {
      action: "fund-wallet";
      wallet: `0x${string}`;
      eth: string;
      weth: string;
      statics: string;
    }
  | { action: "generate-volume"; eth: string; cycles: number };

export const LAUNCH_FORK_RPC_PORT: 8545;

export function parseLaunchForkControl(action: string, arguments_: string[]): LaunchForkCommand;
export function validateLaunchForkCommand(command: unknown): LaunchForkCommand;

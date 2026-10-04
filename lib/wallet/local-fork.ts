import { type Hex } from "viem";

import type { LaunchDeployment } from "@/lib/deployments/types";

export async function verifyLocalForkWalletProvider(
  provider: unknown,
  deployment: LaunchDeployment
): Promise<void> {
  if (deployment.source !== "development-fixture") return;
  const request = (
    provider as {
      request: (request: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
    }
  ).request.bind(provider);
  const chainId = await request({ method: "eth_chainId" });
  if (Number(BigInt(chainId as Hex)) !== deployment.descriptor.chainId) {
    throw new Error("The wallet provider is not connected to Local Anvil.");
  }
}

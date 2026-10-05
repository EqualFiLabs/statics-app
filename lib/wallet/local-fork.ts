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
  // Mainnet and its fork share a chain ID. Check the wallet's endpoint before
  // local writes so an external wallet still using mainnet cannot sign them.
  if (deployment.descriptor.chainId === 4_663) {
    const client = await request({ method: "web3_clientVersion" });
    if (typeof client !== "string" || !/^anvil\b/i.test(client)) {
      throw new Error("Point your wallet's Robinhood RPC at the local Anvil fork before signing.");
    }
  }
}

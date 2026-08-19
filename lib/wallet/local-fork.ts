import { keccak256, type Hex } from "viem";

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
  const expected = deployment.runtimeCodeHashes.statics;
  if (!expected) throw new Error("The local fork manifest is missing the STATICS runtime hash.");
  const chainId = await request({ method: "eth_chainId" });
  if (Number(BigInt(chainId as Hex)) !== deployment.descriptor.chainId) {
    throw new Error("The wallet provider is not connected to the local Robinhood fork.");
  }
  const code = await request({
    method: "eth_getCode",
    params: [deployment.contracts.statics, "latest"],
  });
  if (
    typeof code !== "string" ||
    code === "0x" ||
    keccak256(code as Hex).toLowerCase() !== expected.toLowerCase()
  ) {
    throw new Error(
      "The wallet is using public Robinhood instead of this local fork. Point its Robinhood RPC to the local session before continuing."
    );
  }
}

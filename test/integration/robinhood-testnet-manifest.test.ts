import { createPublicClient, http } from "viem";
import { describe, expect, it } from "vitest";

import manifest from "@/deployments/46630.json";
import { verifyDollarDeployment } from "@/lib/dollar/deployment";
import { parseDeploymentManifest, type DeploymentManifest } from "@/lib/dollar/manifest";

const rpcUrl = process.env.STATICS_LIVE_RPC_URL?.trim();

describe("Robinhood testnet rehearsal manifest", () => {
  it.skipIf(!rpcUrl)("matches live runtime code and permanent bindings", async () => {
    const deployment = parseDeploymentManifest(manifest as DeploymentManifest);
    const publicClient = createPublicClient({ transport: http(rpcUrl) });

    await expect(verifyDollarDeployment(publicClient, deployment)).resolves.toBeUndefined();
  });
});

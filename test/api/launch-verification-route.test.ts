import { getAddress, zeroAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DeploymentOption, LaunchDeployment } from "@/lib/deployments/types";

const mocks = vi.hoisted(() => ({
  registry: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("@/lib/deployments/registry", () => ({ deploymentRegistry: mocks.registry }));
vi.mock("@/lib/server/launch-verification", () => ({
  verifyLaunchDeploymentOnServer: mocks.verify,
}));

import { POST } from "@/app/api/deployments/launch-verification/route";

const address = getAddress("0x1111111111111111111111111111111111111111");
const deployment = {
  kind: "launch",
  descriptor: {
    deploymentId: "robinhood-genesis",
    label: "Genesis",
    network: "Robinhood Chain",
    chainId: 4_663,
    stage: "launch",
    capabilities: [],
    available: true,
  },
  deploymentStartBlock: 1n,
  protocolCommit: "commit",
  source: "checked-in-manifest",
  contracts: {
    statics: address,
    genesis: address,
    vault: address,
    activationRegistry: address,
    feeReceiver: address,
    launchDistributor: address,
    weth: address,
    poolManager: address,
    stateView: address,
    quoter: address,
    universalRouter: address,
    permit2: address,
  },
  runtimeCodeHashes: {},
  market: {
    poolId: `0x${"12".repeat(32)}`,
    poolKey: { currency0: address, currency1: address, fee: 0, tickSpacing: 1, hooks: zeroAddress },
  },
} as const satisfies LaunchDeployment;
const option = {
  networkId: "robinhood",
  descriptor: deployment.descriptor,
  launch: deployment,
  protocol: null,
} satisfies DeploymentOption;

function request(body: unknown, origin = "https://staticsprotocol.com") {
  return new Request("https://staticsprotocol.com/api/deployments/launch-verification", {
    method: "POST",
    headers: { "content-type": "application/json", host: "staticsprotocol.com", origin },
    body: JSON.stringify(body),
  });
}

describe("launch verification route", () => {
  beforeEach(() => {
    mocks.registry.mockReset().mockReturnValue([option]);
    mocks.verify.mockReset().mockReturnValue({
      status: "miss",
      verification: Promise.resolve(),
    });
  });

  it("verifies only a known checked-in deployment", async () => {
    const response = await POST(request({ chainId: 4_663, deploymentId: "robinhood-genesis" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-statics-verification-cache")).toBe("miss");
    await expect(response.json()).resolves.toMatchObject({ verified: true });
  });

  it("rejects unknown deployments without calling the RPC", async () => {
    const response = await POST(request({ chainId: 4_663, deploymentId: "unknown" }));
    expect(response.status).toBe(404);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests", async () => {
    const response = await POST(
      request({ chainId: 4_663, deploymentId: "robinhood-genesis" }, "https://attacker.example")
    );
    expect(response.status).toBe(403);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});

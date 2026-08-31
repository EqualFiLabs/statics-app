import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LaunchDeployment } from "@/lib/deployments/types";

const mocks = vi.hoisted(() => ({ cached: vi.fn() }));

vi.mock("@/lib/deployments/verify-launch", () => ({
  verifyLaunchDeploymentCached: (...args: unknown[]) => mocks.cached(...args),
}));

import { verifyLaunchDeploymentForRead } from "@/lib/deployments/verify-launch-read";

const deployment = {
  descriptor: { deploymentId: "robinhood-genesis", chainId: 4_663 },
  source: "checked-in-manifest",
} as unknown as LaunchDeployment;
const publicClient = {} as PublicClient;

describe("read-only launch verification", () => {
  beforeEach(() => {
    mocks.cached.mockReset().mockResolvedValue(undefined);
    vi.unstubAllGlobals();
  });

  it("uses the shared server verifier for checked-in deployments", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ verified: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetch);

    await verifyLaunchDeploymentForRead(publicClient, deployment);

    expect(fetch).toHaveBeenCalledWith(
      "/api/deployments/launch-verification",
      expect.objectContaining({
        body: JSON.stringify({ chainId: 4_663, deploymentId: "robinhood-genesis" }),
        method: "POST",
      })
    );
    expect(mocks.cached).not.toHaveBeenCalled();
  });

  it("keeps development fixtures on the configured local client", async () => {
    const local = { ...deployment, source: "development-fixture" } as LaunchDeployment;
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await verifyLaunchDeploymentForRead(publicClient, local);

    expect(mocks.cached).toHaveBeenCalledWith(publicClient, local);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces a server verification failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Launch deployment verification failed." }), {
          status: 502,
          headers: { "content-type": "application/json" },
        })
      )
    );

    await expect(verifyLaunchDeploymentForRead(publicClient, deployment)).rejects.toThrow(
      "Launch deployment verification failed"
    );
  });
});

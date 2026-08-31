import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LaunchDeployment } from "@/lib/deployments/types";

const mocks = vi.hoisted(() => ({
  getChainId: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("viem", async () => {
  const actual = await vi.importActual<typeof import("viem")>("viem");
  return {
    ...actual,
    createPublicClient: () => ({ getChainId: mocks.getChainId }),
    http: vi.fn(() => ({})),
  };
});
vi.mock("@/lib/deployments/verify-launch", () => ({
  verifyLaunchDeployment: (...args: unknown[]) => mocks.verify(...args),
}));
vi.mock("@/lib/server/robinhood-rpc", () => ({
  robinhoodRpcUrl: () => "https://rpc.example",
}));

import {
  resetLaunchVerificationCacheForTests,
  verifyLaunchDeploymentOnServer,
} from "@/lib/server/launch-verification";

const deployment = {
  descriptor: { deploymentId: "launch", chainId: 4_663 },
  protocolCommit: "commit",
  runtimeCodeHashes: { statics: "0x1234" },
} as unknown as LaunchDeployment;

describe("server launch verification cache", () => {
  beforeEach(() => {
    resetLaunchVerificationCacheForTests();
    mocks.getChainId.mockReset().mockResolvedValue(4_663);
    mocks.verify.mockReset().mockResolvedValue(undefined);
  });

  it("deduplicates verification across callers and reports cache status", async () => {
    const first = verifyLaunchDeploymentOnServer(deployment);
    const second = verifyLaunchDeploymentOnServer(deployment);

    expect(first.status).toBe("miss");
    expect(second.status).toBe("hit");
    await Promise.all([first.verification, second.verification]);
    expect(mocks.getChainId).toHaveBeenCalledTimes(1);
    expect(mocks.verify).toHaveBeenCalledTimes(1);
  });

  it("evicts a failed verification so the next request can retry", async () => {
    mocks.verify.mockRejectedValueOnce(new Error("binding mismatch"));
    const failed = verifyLaunchDeploymentOnServer(deployment);
    await expect(failed.verification).rejects.toThrow("binding mismatch");

    const retry = verifyLaunchDeploymentOnServer(deployment);
    expect(retry.status).toBe("miss");
    await expect(retry.verification).resolves.toBeUndefined();
    expect(mocks.verify).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the authenticated endpoint is on the wrong chain", async () => {
    mocks.getChainId.mockResolvedValue(46_630);
    await expect(verifyLaunchDeploymentOnServer(deployment).verification).rejects.toThrow(
      "RPC chain does not match"
    );
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});

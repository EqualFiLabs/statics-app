import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/rewards/RewardsPage", () => ({ RewardsPage: () => null }));
import EarnFeatureRoute from "@/app/(dapp)/app/rewards/[feature]/page";

const pool = `0x${"1".repeat(64)}`,
  asset = `0x${"2".repeat(40)}`;
const visit = (feature: string, search: Record<string, string> = {}) =>
  EarnFeatureRoute({
    params: Promise.resolve({ feature }),
    searchParams: Promise.resolve(search),
  });

beforeEach(() => {
  mocks.redirect.mockClear();
});

describe("retired Bribes route", () => {
  it("sends the allocator share to Allocations, keeping position and pool", async () => {
    await expect(
      visit("bribes", { share: "allocator", positionId: "4", poolId: pool, asset })
    ).rejects.toThrow(`redirect:/app/rewards/allocations?positionId=4&poolId=${pool}`);
  });

  it("sends the LP share and bare links to Liquidity rewards, keeping filters", async () => {
    await expect(visit("bribes", { share: "lp", poolId: pool, asset })).rejects.toThrow(
      `redirect:/app/rewards/gauge?poolId=${pool}&asset=${asset}`
    );
    await expect(visit("bribes")).rejects.toThrow("redirect:/app/rewards/gauge");
  });

  it("still serves current features and rejects unknown ones", async () => {
    await expect(visit("allocations")).resolves.toBeTruthy();
    await expect(visit("nope")).rejects.toThrow("redirect:/app/rewards");
  });
});

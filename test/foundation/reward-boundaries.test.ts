import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("reward surface boundaries", () => {
  const genesisSource = readFileSync("components/genesis/GenesisPage.tsx", "utf8");
  const positionSource = readFileSync("components/positions/PositionDetailPage.tsx", "utf8");
  const rewardsSource = readFileSync("components/rewards/RewardsPage.tsx", "utf8");

  it("keeps reward configuration on positions and claims on Earn", () => {
    expect(positionSource).toContain("buildOptInRewardAssetsCall");
    expect(positionSource).toContain("/app/rewards?positionId=");
    expect(positionSource).not.toContain("buildClaimRewardsCall");

    expect(rewardsSource).toContain("buildClaimRewardsCall");
    expect(rewardsSource).not.toContain("RewardAssetPicker");
  });

  it("keeps specialized liquidity earnings discoverable without duplicating LP controls", () => {
    expect(rewardsSource).toContain('href="/app/liquidity"');
    expect(rewardsSource).not.toContain("buildClaimLiquidityRewardsCall");
  });

  it("simulates owner-gated Genesis reward reads from the connected wallet", () => {
    expect(genesisSource).toMatch(
      /readContract\(\{\s*account: wallet,\s*address: deployment\.contracts\.diamond,\s*abi: staticsAbi,\s*functionName: "positionRewardAssets"/
    );
  });
});

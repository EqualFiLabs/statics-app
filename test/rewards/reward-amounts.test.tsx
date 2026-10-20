import { getAddress, type Address } from "viem";
import { describe, expect, it } from "vitest";

import { RewardAmounts } from "@/components/rewards/RewardAmounts";
import { parsePhaseOneDeploymentManifest } from "@/lib/deployments/phase-one-manifest";
import type { PhaseOneDeployment } from "@/lib/deployments/types";
import { runtimeManifests } from "@/test/fixtures/public-manifests";
import { render, screen } from "@/test/render";

const deployment = parsePhaseOneDeploymentManifest(
  runtimeManifests().phaseOne["robinhood-phase-one"]!
);
const weth = deployment.contracts.weth;
const usdc = getAddress(`0x${"a".repeat(40)}`);
const withPool: PhaseOneDeployment = {
  ...deployment,
  supportedPools: [
    {
      token0: { address: weth, symbol: "WETH", decimals: 18 },
      token1: { address: usdc, symbol: "USDC", decimals: 6 },
    } as PhaseOneDeployment["supportedPools"][number],
  ],
};

describe("Earn reward amounts", () => {
  it("formats configured WETH without a WETH pool, preserving tiny positive rewards", () => {
    render(
      <RewardAmounts deployment={deployment} amounts={[{ asset: weth, amount: 96_857_866_694n }]} />
    );

    expect(screen.getByText("<0.000001")).toBeInTheDocument();
    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(
      screen.getByTitle(`0.000000096857866694 ETH · ${weth}`).nextElementSibling
    ).toHaveTextContent("0.000000096857866694 ETH");
    expect(screen.queryByText(/raw units/i)).not.toBeInTheDocument();
  });

  it("uses the same ETH label for a pool's WETH and case-insensitive reward addresses", () => {
    render(
      <RewardAmounts
        deployment={withPool}
        amounts={[{ asset: weth.toLowerCase() as Address, amount: 10n ** 18n }]}
      />
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(screen.getByTitle(`1 ETH · ${weth.toLowerCase()}`).nextElementSibling).toHaveTextContent(
      "1 ETH"
    );
    expect(screen.queryByText("WETH")).not.toBeInTheDocument();
  });

  it("preserves reviewed decimals for other pool reward tokens", () => {
    render(<RewardAmounts deployment={withPool} amounts={[{ asset: usdc, amount: 1_234_567n }]} />);

    expect(screen.getByTitle(`1.234567 USDC · ${usdc}`).nextElementSibling).toHaveTextContent(
      "1.234567 USDC"
    );
  });

  it("preserves the STATICS fallback without a pool", () => {
    render(
      <RewardAmounts
        deployment={deployment}
        amounts={[{ asset: deployment.contracts.statics, amount: 2n * 10n ** 18n }]}
      />
    );

    expect(
      screen.getByTitle(`2 STATICS · ${deployment.contracts.statics}`).nextElementSibling
    ).toHaveTextContent("2 STATICS");
  });

  it("continues showing raw units for genuinely unknown assets", () => {
    render(<RewardAmounts deployment={deployment} amounts={[{ asset: usdc, amount: 123n }]} />);

    expect(screen.getByTitle(`123 raw units · ${usdc}`).nextElementSibling).toHaveTextContent(
      "123 raw units"
    );
    expect(screen.getByText(/raw units \(0x/)).toBeInTheDocument();
    expect(screen.queryByText("ETH")).not.toBeInTheDocument();
  });
});

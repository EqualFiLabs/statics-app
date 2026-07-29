import { describe, expect, it } from "vitest";

import { readDollarDeployment } from "@/lib/dollar/deployment";
import { defaultWalletTokens } from "@/lib/wallet-tokens";

describe("default Statics wallet tokens", () => {
  it("uses the deployed Dollar ticker", () => {
    const deployment = readDollarDeployment({
      NEXT_PUBLIC_APP_ENV: "production",
      NEXT_PUBLIC_STATICS_CHAIN_ID: "46630",
    });
    expect(deployment.status).toBe("configured");
    if (deployment.status !== "configured") return;
    const dollar = defaultWalletTokens(deployment.deployment.chainId, deployment).find(
      (token) =>
        token.address.toLowerCase() === deployment.deployment.contracts.dollar.toLowerCase()
    );
    expect(dollar?.symbol).toBe("USDstx");
  });
});

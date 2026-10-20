import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { publicDeploymentSnapshot } from "@/lib/deployments/public-manifests";
import { DeploymentProvider, useDeployment } from "@/providers/deployment-context";
import { runtimeManifests } from "@/test/fixtures/public-manifests";

function Current() {
  const { active, selectNetwork } = useDeployment();
  return (
    <>
      <output>{active.phaseOne?.contracts.diamond ?? active.networkId}</output>
      <button onClick={() => selectNetwork("robinhood")}>Mainnet</button>
      <button onClick={() => selectNetwork("robinhood-testnet")}>Testnet</button>
    </>
  );
}

describe("runtime deployment provider", () => {
  it("uses the server snapshot and pins it through navigation and reviewed actions until reload", () => {
    const snapshot = publicDeploymentSnapshot(runtimeManifests(), "runtime-manifest");
    const { rerender, unmount } = render(
      <DeploymentProvider deploymentSnapshot={snapshot}>
        <Current />
      </DeploymentProvider>
    );
    act(() => screen.getByRole("button", { name: "Mainnet" }).click());
    expect(screen.getByRole("status")).toHaveTextContent(`0x${"1".repeat(40)}`);
    const changed = runtimeManifests();
    changed.phaseOne["robinhood-phase-one"].contracts.diamond.address = `0x${"6".repeat(40)}`;
    const next = publicDeploymentSnapshot(changed, "runtime-manifest");
    rerender(
      <DeploymentProvider deploymentSnapshot={next}>
        <Current />
      </DeploymentProvider>
    );
    expect(screen.getByRole("status")).toHaveTextContent(`0x${"1".repeat(40)}`);
    act(() => screen.getByRole("button", { name: "Testnet" }).click());
    act(() => screen.getByRole("button", { name: "Mainnet" }).click());
    expect(screen.getByRole("status")).toHaveTextContent(`0x${"1".repeat(40)}`);
    unmount();
    render(
      <DeploymentProvider deploymentSnapshot={next}>
        <Current />
      </DeploymentProvider>
    );
    act(() => screen.getByRole("button", { name: "Mainnet" }).click());
    expect(screen.getByRole("status")).toHaveTextContent(`0x${"6".repeat(40)}`);
  });
});

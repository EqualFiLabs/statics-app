import genesis from "@/deployments/robinhood-genesis.json";
import {
  checkedInDeploymentSnapshot,
  type PublicDeploymentManifests,
} from "@/lib/deployments/public-manifests";
import type { PhaseOneDeploymentManifest } from "@/lib/deployments/phase-one-manifest";

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K] };

export function runtimeManifests(): Mutable<PublicDeploymentManifests> {
  const phaseOne: PhaseOneDeploymentManifest = {
    schemaVersion: 1,
    deploymentId: "robinhood-phase-one",
    network: "Robinhood Chain",
    chainId: 4663,
    deploymentStartBlock: "90000000",
    protocolCommit: "1".repeat(40),
    sdkCommit: "2".repeat(40),
    installedPhase: 1,
    contracts: {
      diamond: { address: `0x${"1".repeat(40)}` },
      timelock: { address: `0x${"2".repeat(40)}` },
      publicHook: { address: `0x${"3".repeat(40)}` },
      liquidityManager: { address: `0x${"4".repeat(40)}` },
      statics: genesis.contracts.statics,
      weth: genesis.contracts.weth,
      poolManager: genesis.contracts.poolManager,
      positionManager: { address: `0x${"5".repeat(40)}` },
      permit2: genesis.contracts.permit2,
      quoter: genesis.contracts.quoter,
      stateView: genesis.contracts.stateView,
      universalRouter: genesis.contracts.universalRouter,
    },
    supportedPools: [],
  };
  return JSON.parse(
    JSON.stringify({
      ...checkedInDeploymentSnapshot().manifests,
      phaseOne: { "robinhood-phase-one": phaseOne },
    })
  ) as Mutable<PublicDeploymentManifests>;
}

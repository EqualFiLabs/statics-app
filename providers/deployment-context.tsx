"use client";

import { createContext, useContext, useMemo, useState } from "react";

import { defaultNetworkId, deploymentRegistry, findDeployment } from "@/lib/deployments/registry";
import type { PublicDeploymentSnapshot } from "@/lib/deployments/public-manifests";
import type { DeploymentOption, StaticsNetworkId } from "@/lib/deployments/types";

export type DeploymentContextValue = Readonly<{
  active: DeploymentOption;
  options: readonly DeploymentOption[];
  selectNetwork: (networkId: StaticsNetworkId) => void;
}>;

const options = deploymentRegistry();
const initial =
  findDeployment(options, defaultNetworkId()) ??
  options[0] ??
  (() => {
    throw new Error("At least one Statics deployment option is required.");
  })();

export const DeploymentContext = createContext<DeploymentContextValue>({
  active: initial,
  options,
  selectNetwork: () => undefined,
});

export function DeploymentProvider({
  children,
  deploymentSnapshot,
}: {
  children: React.ReactNode;
  deploymentSnapshot?: PublicDeploymentSnapshot;
}) {
  // Pin configuration for this page session, including every reviewed transaction.
  const [sessionOptions] = useState(() => deploymentRegistry(undefined, deploymentSnapshot));
  const [active, setActive] = useState(
    () => findDeployment(sessionOptions, defaultNetworkId()) ?? sessionOptions[0]!
  );

  const value = useMemo<DeploymentContextValue>(
    () => ({
      active,
      options: sessionOptions,
      selectNetwork: (networkId) => {
        const selected = sessionOptions.find((option) => option.networkId === networkId);
        if (!selected) return;
        setActive(selected);
      },
    }),
    [active, sessionOptions]
  );
  return <DeploymentContext.Provider value={value}>{children}</DeploymentContext.Provider>;
}

export function useDeployment(): DeploymentContextValue {
  return useContext(DeploymentContext);
}

"use client";

import { createContext, useContext, useMemo, useState } from "react";

import {
  defaultDeploymentId,
  deploymentRegistry,
  findDeployment,
} from "@/lib/deployments/registry";
import type { DeploymentOption } from "@/lib/deployments/types";

export type DeploymentContextValue = Readonly<{
  active: DeploymentOption;
  options: readonly DeploymentOption[];
  selectNetwork: (chainId: number) => void;
}>;

const options = deploymentRegistry();
const initial =
  findDeployment(options, defaultDeploymentId()) ??
  options[0] ??
  (() => {
    throw new Error("At least one Statics deployment option is required.");
  })();

export const DeploymentContext = createContext<DeploymentContextValue>({
  active: initial,
  options,
  selectNetwork: () => undefined,
});

export function DeploymentProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(initial);

  const value = useMemo<DeploymentContextValue>(
    () => ({
      active,
      options,
      selectNetwork: (chainId) => {
        const selected = options.find((option) => option.descriptor.chainId === chainId);
        if (!selected) return;
        setActive(selected);
      },
    }),
    [active]
  );
  return <DeploymentContext.Provider value={value}>{children}</DeploymentContext.Provider>;
}

export function useDeployment(): DeploymentContextValue {
  return useContext(DeploymentContext);
}

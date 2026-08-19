"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  DEPLOYMENT_STORAGE_KEY,
  defaultDeploymentId,
  deploymentRegistry,
  findDeployment,
} from "@/lib/deployments/registry";
import type { DeploymentOption } from "@/lib/deployments/types";

export type DeploymentContextValue = Readonly<{
  active: DeploymentOption;
  options: readonly DeploymentOption[];
  selectDeployment: (deploymentId: string) => void;
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
  selectDeployment: () => undefined,
});

function requestedDeploymentId(): string | null {
  const url = new URL(window.location.href);
  return url.searchParams.get("deployment") || window.localStorage.getItem(DEPLOYMENT_STORAGE_KEY);
}

export function DeploymentProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(initial);

  useEffect(() => {
    const requested = requestedDeploymentId();
    const selected = requested ? findDeployment(options, requested) : null;
    if (selected) setActive(selected);
  }, []);

  const value = useMemo<DeploymentContextValue>(
    () => ({
      active,
      options,
      selectDeployment: (deploymentId) => {
        const selected = findDeployment(options, deploymentId);
        if (!selected) return;
        setActive(selected);
        window.localStorage.setItem(DEPLOYMENT_STORAGE_KEY, deploymentId);
        const url = new URL(window.location.href);
        url.searchParams.set("deployment", deploymentId);
        window.history.replaceState(window.history.state, "", url);
      },
    }),
    [active]
  );
  return <DeploymentContext.Provider value={value}>{children}</DeploymentContext.Provider>;
}

export function useDeployment(): DeploymentContextValue {
  return useContext(DeploymentContext);
}

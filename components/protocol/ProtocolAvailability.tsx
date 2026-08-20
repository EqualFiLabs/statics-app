"use client";

import { deploymentManifests } from "@/deployments/manifests";
import { parseDeploymentManifest } from "@/lib/dollar/manifest";
import { useDeployment } from "@/providers/deployment-context";
import { useTranslations } from "next-intl";

const previewDeployment = parseDeploymentManifest(deploymentManifests[46_630]!);

export function useProtocolSurface() {
  const { active } = useDeployment();
  const t = useTranslations("surface");
  return {
    available: Boolean(active.protocol),
    deployment: active.protocol?.protocol ?? previewDeployment,
    reason: t("actionUnavailable", { network: active.descriptor.network }),
  } as const;
}

export function ProtocolActionScope({ children }: { children: React.ReactNode }) {
  const { available, reason } = useProtocolSurface();
  return (
    <div
      className={`protocol-action-scope${available ? "" : " is-disabled"}`}
      aria-disabled={available ? undefined : "true"}
      title={available ? undefined : reason}
    >
      <fieldset disabled={!available}>{children}</fieldset>
    </div>
  );
}

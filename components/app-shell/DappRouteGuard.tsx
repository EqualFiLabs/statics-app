"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { isDappRouteAllowed } from "@/lib/dapp-navigation";
import { useDeployment } from "@/providers/deployment-context";

export function DappRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/app";
  const router = useRouter();
  const { active } = useDeployment();
  const allowed = isDappRouteAllowed(pathname, active.descriptor);

  useEffect(() => {
    if (!allowed) router.replace("/app");
  }, [allowed, router]);

  if (!allowed) return <p className="dapp-loading">Loading the application…</p>;
  return children;
}

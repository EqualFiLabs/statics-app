"use client";

import { PoolSwapFee } from "./PoolSwapFee";
import { usePoolFeeRates } from "@/hooks/usePoolFeeRates";

export function IndexedPoolSwapFee({
  deploymentId,
  poolId,
  lpFee,
  className,
}: {
  deploymentId: string;
  poolId: string;
  lpFee: number;
  className?: string;
}) {
  const fees = usePoolFeeRates(deploymentId);
  return (
    <PoolSwapFee
      source="phase-one"
      lpFee={lpFee}
      className={className}
      hook={fees.data?.get(poolId.toLowerCase()) ?? null}
    />
  );
}

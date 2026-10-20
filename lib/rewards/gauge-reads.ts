import { queryOptions } from "@tanstack/react-query";
import { staticsRangeGaugeAbi } from "@statics-protocol/sdk/phase-one";
import { getAddress, type Address, type Hex, type PublicClient } from "viem";
import type { PhaseOneDeployment } from "@/lib/deployments/types";

/** Bound individual metadata RPCs, including the two reads needed for each pool. */
const readers = new WeakMap<object, ReturnType<typeof createReader>>();
function createReader() {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(read: () => Promise<T>): Promise<T> => {
    if (active >= 4) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await read();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}
export function boundedGaugeRead<T>(client: PublicClient, read: () => Promise<T>): Promise<T> {
  let reader = readers.get(client);
  if (!reader) {
    reader = createReader();
    readers.set(client, reader);
  }
  return reader(read);
}

/** Reward settlement and range presentation reuse the same receipt-refreshed leg cache. */
export function liquidityLegQuery(input: {
  publicClient: PublicClient;
  deployment: PhaseOneDeployment;
  account: Address | null;
  positionId: bigint;
  poolId: Hex;
}) {
  const { publicClient, deployment, account, positionId, poolId } = input;
  return queryOptions({
    queryKey: [
      "phase-one-gauges",
      deployment.descriptor.deploymentId,
      account ? getAddress(account) : "disconnected",
      String(positionId),
      "liquidity-leg",
      poolId.toLowerCase(),
      deployment.descriptor.chainId,
      deployment.contracts.diamond.toLowerCase(),
    ],
    staleTime: 30_000,
    retry: false,
    queryFn: () =>
      boundedGaugeRead(publicClient, () =>
        publicClient.readContract({
          address: deployment.contracts.diamond,
          abi: staticsRangeGaugeAbi,
          functionName: "lpLeg",
          args: [positionId, poolId],
          account: account ?? undefined,
        })
      ),
  });
}

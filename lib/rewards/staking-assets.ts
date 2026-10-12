import { zeroAddress, type Address } from "viem";

import type { PhaseOneDeployment } from "@/lib/deployments/types";

export type StakingRewardAssetOption = Readonly<{
  address: Address;
  symbol: string;
  name: string;
}>;

/** Native pool revenue and WETH revenue share the configured WETH reward book. */
export function stakingRewardAssets(
  deployment: PhaseOneDeployment,
  assets: readonly Address[]
): Address[] {
  const normalized = assets.map((asset) =>
    asset.toLowerCase() === zeroAddress ? deployment.contracts.weth : asset
  );
  return [...new Map(normalized.map((asset) => [asset.toLowerCase(), asset])).values()];
}

/** ETH is one user choice; reward selection always uses its ERC-20 reward address. */
export function stakingRewardAssetOptions(
  deployment: PhaseOneDeployment,
  held: readonly Address[] = [],
  unknownName?: string
): StakingRewardAssetOption[] {
  const options = new Map<string, StakingRewardAssetOption>();
  const tokens = [
    { address: deployment.contracts.statics, symbol: "STATICS", name: "Statics" },
    ...deployment.supportedPools.flatMap((pool) => [pool.token0, pool.token1]),
    { address: deployment.contracts.weth, symbol: "ETH", name: "Ether" },
  ];
  for (const token of tokens) {
    const [address] = stakingRewardAssets(deployment, [token.address]);
    const isEther = address.toLowerCase() === deployment.contracts.weth.toLowerCase();
    options.set(address.toLowerCase(), {
      address,
      symbol: isEther ? "ETH" : token.symbol,
      name: isEther ? "Ether" : token.name,
    });
  }
  for (const address of stakingRewardAssets(deployment, held)) {
    if (!options.has(address.toLowerCase())) {
      const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
      options.set(address.toLowerCase(), { address, symbol: short, name: unknownName ?? short });
    }
  }
  return [...options.values()];
}

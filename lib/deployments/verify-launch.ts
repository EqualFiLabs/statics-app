import { getAddress, keccak256, type Address, type PublicClient } from "viem";

import {
  genesisActivationRegistryAbi,
  genesisLaunchDistributorAbi,
  staticsFeeReceiverAbi,
  staticsGenesisAbi,
  staticsGenesisVaultAbi,
} from "@statics-protocol/sdk";

import type { LaunchDeployment } from "@/lib/deployments/types";

function same(left: Address, right: Address): boolean {
  return getAddress(left) === getAddress(right);
}

function requireAddress(actual: Address, expected: Address, label: string): void {
  if (!same(actual, expected)) throw new Error(`${label} does not match the reviewed manifest.`);
}

export async function verifyLaunchDeployment(
  publicClient: PublicClient,
  deployment: LaunchDeployment
): Promise<void> {
  if (publicClient.chain && publicClient.chain.id !== deployment.descriptor.chainId) {
    throw new Error("The RPC chain does not match the selected Statics deployment.");
  }

  await Promise.all(
    Object.entries(deployment.runtimeCodeHashes).map(async ([name, expected]) => {
      const address = deployment.contracts[name as keyof typeof deployment.contracts];
      const code = await publicClient.getCode({ address });
      if (!code || code === "0x" || keccak256(code).toLowerCase() !== expected!.toLowerCase()) {
        throw new Error(`${name} runtime code does not match the reviewed launch manifest.`);
      }
    })
  );

  const [
    genesisVault,
    genesisRegistry,
    vaultStatics,
    vaultGenesis,
    vaultFinalized,
    registryStatics,
    registryGenesis,
    registryConsumer,
    receiverStatics,
    receiverNumeraire,
    receiverInitializer,
    receiverPoolId,
    receiverDistributor,
    distributorReceiver,
    distributorGenesis,
    distributorRegistry,
    distributorStatics,
    distributorNumeraire,
    distributorVault,
  ] = await Promise.all([
    publicClient.readContract({
      address: deployment.contracts.genesis,
      abi: staticsGenesisAbi,
      functionName: "vault",
    }),
    publicClient.readContract({
      address: deployment.contracts.genesis,
      abi: staticsGenesisAbi,
      functionName: "activationRegistry",
    }),
    publicClient.readContract({
      address: deployment.contracts.vault,
      abi: staticsGenesisVaultAbi,
      functionName: "statics",
    }),
    publicClient.readContract({
      address: deployment.contracts.vault,
      abi: staticsGenesisVaultAbi,
      functionName: "genesis",
    }),
    publicClient.readContract({
      address: deployment.contracts.vault,
      abi: staticsGenesisVaultAbi,
      functionName: "finalized",
    }),
    publicClient.readContract({
      address: deployment.contracts.activationRegistry,
      abi: genesisActivationRegistryAbi,
      functionName: "statics",
    }),
    publicClient.readContract({
      address: deployment.contracts.activationRegistry,
      abi: genesisActivationRegistryAbi,
      functionName: "genesisCollection",
    }),
    publicClient.readContract({
      address: deployment.contracts.activationRegistry,
      abi: genesisActivationRegistryAbi,
      functionName: "activeConsumer",
    }),
    publicClient.readContract({
      address: deployment.contracts.feeReceiver,
      abi: staticsFeeReceiverAbi,
      functionName: "statics",
    }),
    publicClient.readContract({
      address: deployment.contracts.feeReceiver,
      abi: staticsFeeReceiverAbi,
      functionName: "numeraire",
    }),
    publicClient.readContract({
      address: deployment.contracts.feeReceiver,
      abi: staticsFeeReceiverAbi,
      functionName: "poolInitializer",
    }),
    publicClient.readContract({
      address: deployment.contracts.feeReceiver,
      abi: staticsFeeReceiverAbi,
      functionName: "poolId",
    }),
    publicClient.readContract({
      address: deployment.contracts.feeReceiver,
      abi: staticsFeeReceiverAbi,
      functionName: "activeDistributor",
    }),
    publicClient.readContract({
      address: deployment.contracts.launchDistributor,
      abi: genesisLaunchDistributorAbi,
      functionName: "feeReceiver",
    }),
    publicClient.readContract({
      address: deployment.contracts.launchDistributor,
      abi: genesisLaunchDistributorAbi,
      functionName: "genesis",
    }),
    publicClient.readContract({
      address: deployment.contracts.launchDistributor,
      abi: genesisLaunchDistributorAbi,
      functionName: "activationRegistry",
    }),
    publicClient.readContract({
      address: deployment.contracts.launchDistributor,
      abi: genesisLaunchDistributorAbi,
      functionName: "statics",
    }),
    publicClient.readContract({
      address: deployment.contracts.launchDistributor,
      abi: genesisLaunchDistributorAbi,
      functionName: "numeraire",
    }),
    publicClient.readContract({
      address: deployment.contracts.launchDistributor,
      abi: genesisLaunchDistributorAbi,
      functionName: "vault",
    }),
  ]);

  requireAddress(genesisVault, deployment.contracts.vault, "Genesis Vault binding");
  requireAddress(
    genesisRegistry,
    deployment.contracts.activationRegistry,
    "Genesis Registry binding"
  );
  requireAddress(vaultStatics, deployment.contracts.statics, "Vault STATICS binding");
  requireAddress(vaultGenesis, deployment.contracts.genesis, "Vault Genesis binding");
  if (!vaultFinalized) throw new Error("The Genesis Vault launch is not finalized.");
  requireAddress(registryStatics, deployment.contracts.statics, "Registry STATICS binding");
  requireAddress(registryGenesis, deployment.contracts.genesis, "Registry Genesis binding");
  requireAddress(
    registryConsumer,
    deployment.contracts.launchDistributor,
    "Registry consumer binding"
  );
  requireAddress(receiverStatics, deployment.contracts.statics, "Fee Receiver STATICS binding");
  requireAddress(receiverNumeraire, deployment.contracts.weth, "Fee Receiver WETH binding");
  requireAddress(
    receiverInitializer,
    deployment.market.poolKey.hooks,
    "Fee Receiver market binding"
  );
  if (receiverPoolId.toLowerCase() !== deployment.market.poolId.toLowerCase()) {
    throw new Error("Fee Receiver PoolId does not match the reviewed manifest.");
  }
  requireAddress(
    receiverDistributor,
    deployment.contracts.launchDistributor,
    "Fee Receiver distributor binding"
  );
  requireAddress(
    distributorReceiver,
    deployment.contracts.feeReceiver,
    "Distributor Fee Receiver binding"
  );
  requireAddress(distributorGenesis, deployment.contracts.genesis, "Distributor Genesis binding");
  requireAddress(
    distributorRegistry,
    deployment.contracts.activationRegistry,
    "Distributor Registry binding"
  );
  requireAddress(distributorStatics, deployment.contracts.statics, "Distributor STATICS binding");
  requireAddress(distributorNumeraire, deployment.contracts.weth, "Distributor WETH binding");
  requireAddress(distributorVault, deployment.contracts.vault, "Distributor Vault binding");
}

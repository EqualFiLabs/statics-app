"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  getAddress,
  type Address,
} from "viem";

import {
  basketTokenAbi,
  buildTestnetFaucetClaimCall,
  staticsTestnetFaucetAbi,
} from "@statics-protocol/sdk";

import { readClientDollarDeployment, verifyDollarDeployment } from "@/lib/dollar/deployment";
import { describeDollarError } from "@/lib/dollar/transactions";
import { getFundingNetwork } from "@/lib/funding-networks";
import { executeProtocolTransaction } from "@/lib/protocol/transactions";
import { useWalletState } from "@/providers/wallet-context";

const deploymentState = readClientDollarDeployment();

type FaucetAsset = {
  address: Address;
  amount: bigint;
  inventory: bigint;
  walletBalance: bigint;
  symbol: string;
  decimals: number;
};

type FaucetSnapshot = {
  assets: FaucetAsset[];
  nextClaimAt: bigint;
  blockTimestamp: bigint;
};

function display(value: bigint, decimals: number): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const short = fraction.slice(0, 4).replace(/0+$/, "");
  return short ? `${whole}.${short}` : whole;
}

export function TestnetFaucetCard() {
  const wallet = useWalletState();
  const deployment = deploymentState.status === "configured" ? deploymentState.deployment : null;
  const faucet = deployment?.faucet;
  const [snapshot, setSnapshot] = useState<FaucetSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visible = deployment?.chainId === 46_630 && wallet.fundingChainId === deployment.chainId;

  const readSnapshot = useCallback(async () => {
    if (!deployment || !faucet || !wallet.address || !wallet.fundingWalletOnSelectedChain) {
      setSnapshot(null);
      return null;
    }
    const provider = await wallet.getEthereumProvider();
    const network = getFundingNetwork(deployment.chainId);
    if (!provider || !network) throw new Error("Robinhood testnet wallet is unavailable.");
    const publicClient = createPublicClient({ chain: network.chain, transport: custom(provider) });
    await verifyDollarDeployment(publicClient, deployment);
    const account = getAddress(wallet.address);
    const [assetCount, nextClaimAt, block] = await Promise.all([
      publicClient.readContract({
        address: faucet.address,
        abi: staticsTestnetFaucetAbi,
        functionName: "ASSET_COUNT",
      }),
      publicClient.readContract({
        address: faucet.address,
        abi: staticsTestnetFaucetAbi,
        functionName: "nextClaimAt",
        args: [account],
      }),
      publicClient.getBlock(),
    ]);
    const entries = await Promise.all(
      Array.from({ length: Number(assetCount) }, async (_, index) => {
        const [address, amount] = await publicClient.readContract({
          address: faucet.address,
          abi: staticsTestnetFaucetAbi,
          functionName: "asset",
          args: [BigInt(index)],
        });
        const [symbol, decimals, inventory, walletBalance] = await Promise.all([
          publicClient.readContract({
            address,
            abi: basketTokenAbi,
            functionName: "symbol",
          }),
          publicClient.readContract({
            address,
            abi: basketTokenAbi,
            functionName: "decimals",
          }),
          publicClient.readContract({
            address,
            abi: basketTokenAbi,
            functionName: "balanceOf",
            args: [faucet.address],
          }),
          publicClient.readContract({
            address,
            abi: basketTokenAbi,
            functionName: "balanceOf",
            args: [account],
          }),
        ]);
        return { address, amount, inventory, walletBalance, symbol, decimals };
      })
    );
    const next = { assets: entries, nextClaimAt, blockTimestamp: block.timestamp };
    setSnapshot(next);
    return next;
  }, [deployment, faucet, wallet]);

  useEffect(() => {
    if (!visible || !faucet || !wallet.address || !wallet.fundingWalletOnSelectedChain) {
      const timeout = window.setTimeout(() => setSnapshot(null), 0);
      return () => window.clearTimeout(timeout);
    }
    let active = true;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      void readSnapshot()
        .catch((cause) => {
          if (active) setError(describeDollarError(cause));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [faucet, readSnapshot, visible, wallet.address, wallet.fundingWalletOnSelectedChain]);

  const underfunded = snapshot?.assets.some((asset) => asset.inventory < asset.amount) ?? false;
  const coolingDown =
    snapshot !== null &&
    snapshot.nextClaimAt !== 0n &&
    snapshot.blockTimestamp < snapshot.nextClaimAt;

  useEffect(() => {
    if (!visible || !coolingDown || !snapshot) return;
    const remainingMilliseconds = (snapshot.nextClaimAt - snapshot.blockTimestamp) * 1_000n;
    const timeout = window.setTimeout(
      () => void readSnapshot().catch((cause) => setError(describeDollarError(cause))),
      Number(remainingMilliseconds)
    );
    return () => window.clearTimeout(timeout);
  }, [coolingDown, readSnapshot, snapshot, visible]);

  if (!visible) return null;

  const claim = async () => {
    if (!deployment || !faucet || pending) return;
    if (!wallet.address) {
      wallet.login();
      return;
    }
    if (!wallet.fundingWalletOnSelectedChain) {
      await wallet.selectFundingNetwork(deployment.chainId);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const provider = await wallet.getEthereumProvider();
      const network = getFundingNetwork(deployment.chainId);
      if (!provider || !network) throw new Error("Robinhood testnet wallet is unavailable.");
      const account = getAddress(wallet.address);
      const publicClient = createPublicClient({
        chain: network.chain,
        transport: custom(provider),
      });
      const walletClient = createWalletClient({
        account,
        chain: network.chain,
        transport: custom(provider),
      });
      const before = snapshot ?? (await readSnapshot());
      if (!before) throw new Error("Faucet inventory is unavailable.");
      if (before.assets.some((asset) => asset.inventory < asset.amount)) {
        throw new Error("The faucet does not have a complete claim bundle.");
      }
      await executeProtocolTransaction({
        publicClient,
        wallet: account,
        chainId: deployment.chainId,
        kind: "claim-testnet-fixtures",
        label: "Claim Statics testnet assets",
        amount: before.assets
          .map((asset) => `${display(asset.amount, asset.decimals)} ${asset.symbol}`)
          .join(" + "),
        to: faucet.address,
        data: buildTestnetFaucetClaimCall(),
        sendTransaction: ({ to, data, value }) =>
          walletClient.sendTransaction({ account, chain: network.chain, to, data, value }),
        describeError: describeDollarError,
        verifyConfirmation: async () => {
          const next = await readSnapshot();
          if (
            !next ||
            next.nextClaimAt <= before.blockTimestamp ||
            next.assets.some(
              (asset, index) =>
                asset.walletBalance < before.assets[index]!.walletBalance + asset.amount
            )
          ) {
            throw new Error("The confirmed faucet claim could not be verified.");
          }
        },
      });
    } catch (cause) {
      setError(describeDollarError(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="testnet-faucet" aria-labelledby="testnet-faucet-title">
      <div>
        <p className="dapp-section-label">Robinhood testnet</p>
        <h2 id="testnet-faucet-title">Testnet asset faucet</h2>
        <p>Claim the USDG, STATICS, and stock-token fixtures needed to exercise the beta.</p>
      </div>
      {!faucet ? (
        <p className="dollar-action-reason">Faucet deployment has not been recorded yet.</p>
      ) : snapshot ? (
        <ul>
          {snapshot.assets.map((asset) => (
            <li key={asset.address}>
              <strong>{asset.symbol}</strong>
              <span>{display(asset.amount, asset.decimals)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>{loading ? "Reading faucet inventory…" : "Connect to read faucet inventory."}</p>
      )}
      {coolingDown && snapshot && (
        <p className="dollar-action-reason">
          Next claim after {new Date(Number(snapshot.nextClaimAt) * 1_000).toLocaleString()}.
        </p>
      )}
      {underfunded && (
        <p className="dapp-inline-error" role="alert">
          The faucet needs a complete refill before another claim.
        </p>
      )}
      {error && (
        <p className="dapp-inline-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="dollar-submit"
        type="button"
        onClick={() => void claim()}
        disabled={!faucet || pending || loading || coolingDown || underfunded}
      >
        {pending ? "Claiming…" : wallet.address ? "Claim testnet assets" : "Sign in to claim"}
      </button>
    </section>
  );
}

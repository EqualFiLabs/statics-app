"use client";

import { useState } from "react";
import type { Address } from "viem";

import { getAddressExplorerUrlForChain } from "@/lib/wallet-config";
import { useDeployment } from "@/providers/deployment-context";

export function AddressDisplay({
  address,
  chainId,
  label,
}: {
  address: Address;
  chainId: number;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { active } = useDeployment();
  const localFork = active.launch?.source === "development-fixture";
  const explorerUrl = localFork ? null : getAddressExplorerUrlForChain(chainId, address);
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <span className="protocol-address">
      {label && <span>{label}</span>}
      {explorerUrl ? (
        <a href={explorerUrl} target="_blank" rel="noreferrer" title={address}>
          {short} ↗
        </a>
      ) : (
        <code title={address}>{short}</code>
      )}
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(address).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1_500);
          });
        }}
        aria-label={`Copy ${label || "address"}`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

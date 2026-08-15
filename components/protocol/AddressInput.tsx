"use client";

import type { Address } from "viem";
import { useTranslations } from "next-intl";

import { AddressDisplay } from "@/components/protocol/AddressDisplay";
import { parseRecipientAddress } from "@/lib/protocol/ux";

export function AddressInput({
  id,
  label,
  value,
  onChange,
  chainId,
  placeholder = "0x…",
  rejectZero = true,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  chainId: number;
  placeholder?: string;
  rejectZero?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("common");
  const parsed: Address | null = parseRecipientAddress(value, rejectZero);
  const invalid = value.trim().length > 0 && !parsed;

  return (
    <label className="basket-field" htmlFor={id}>
      <span>{label}</span>
      <div className="protocol-address-input">
        <input
          id={id}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value.trim())}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => void navigator.clipboard.readText().then((text) => onChange(text.trim()))}
        >
          {t("paste")}
        </button>
      </div>
      {invalid && <small className="dapp-inline-error">{t("invalidEvmAddress")}</small>}
      {parsed && <AddressDisplay address={parsed} chainId={chainId} label={t("recipient")} />}
    </label>
  );
}

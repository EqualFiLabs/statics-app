"use client";

import { useId, type CSSProperties } from "react";
import { useTranslations } from "next-intl";

const PERCENTAGE_STEPS = [0, 25, 50, 75, 100] as const;

function boundedPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function amountPercentage(
  amount: bigint,
  maximum: bigint,
  maximumSelection = maximum
): number {
  if (amount <= 0n || maximum <= 0n) return 0;
  if (maximumSelection > 0n && amount === maximumSelection) return 100;
  return boundedPercentage(Number((amount * 100n) / maximum));
}

export function PercentageSlider({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
}) {
  const id = useId();
  const t = useTranslations("common");
  const percentage = boundedPercentage(value);
  const valueText = percentage === 100 ? t("max") : `${percentage}%`;

  return (
    <div className="protocol-percentage-slider">
      <span className="protocol-percentage-heading">
        <span>{label}</span>
        <output htmlFor={id}>{valueText}</output>
      </span>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={25}
        value={percentage}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={valueText}
        style={{ "--percentage-slider-value": `${percentage}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="protocol-percentage-marks" aria-hidden="true">
        {PERCENTAGE_STEPS.map((step) => (
          <span key={step}>{step === 100 ? "Max" : step}</span>
        ))}
      </span>
    </div>
  );
}

export function AmountPercentageSlider({
  amount,
  maximum,
  maximumSelection = maximum,
  onSelect,
  label,
  disabled = false,
}: {
  amount: bigint;
  maximum: bigint;
  maximumSelection?: bigint;
  onSelect: (percent: number) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <PercentageSlider
      value={amountPercentage(amount, maximum, maximumSelection)}
      onChange={onSelect}
      label={label}
      disabled={disabled}
    />
  );
}

"use client";

import type { CSSProperties } from "react";

const UTILIZATION_STEPS = [0, 25, 50, 75, 100] as const;

export function BorrowUtilizationSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const valueText = value === 100 ? "Maximum" : `${value}%`;

  return (
    <label className="borrow-utilization-slider">
      <span className="borrow-utilization-heading">
        <span>Use of available borrowed principal</span>
        <output htmlFor="borrow-liquidity-utilization">{valueText}</output>
      </span>
      <input
        id="borrow-liquidity-utilization"
        type="range"
        min={0}
        max={100}
        step={25}
        value={value}
        aria-label="Use of available borrowed principal"
        aria-valuetext={valueText}
        style={{ "--borrow-utilization": `${value}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="borrow-utilization-marks" aria-hidden="true">
        {UTILIZATION_STEPS.map((step) => (
          <span key={step}>{step === 100 ? "Max" : step}</span>
        ))}
      </span>
    </label>
  );
}

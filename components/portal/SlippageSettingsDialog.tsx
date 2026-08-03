"use client";

import { useEffect, useState } from "react";

import {
  MAX_PORTAL_SLIPPAGE_PERCENT,
  MIN_PORTAL_SLIPPAGE_PERCENT,
  PORTAL_SLIPPAGE_PRESETS,
  parseSlippagePercent,
} from "@/lib/portal/slippage";

/**
 * The current tolerance, sitting just above the amount field it applies to.
 *
 * It reads as a label rather than a control until you need it, which keeps the
 * common case (leaving it alone) quiet while putting the number where someone
 * would look for it before entering an amount.
 */
export function SlippageInlineControl({ value, onEdit }: { value: number; onEdit: () => void }) {
  return (
    <div className="portal-slippage-inline">
      <button
        className="portal-quote-edit"
        type="button"
        aria-label={`Edit slippage, currently ${value}%`}
        onClick={onEdit}
      >
        <span>Slippage {value}%</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Slippage editor, opened from the gear in the Portal header or the pencil
 * above an amount field.
 *
 * Presets apply immediately and close, because picking one is the whole
 * decision. A custom value waits for Apply, so a half-typed "1" on the way to
 * "1.5" never becomes the live setting.
 */
export function SlippageSettingsDialog({
  value,
  onApply,
  onClose,
}: {
  value: number;
  onApply: (percent: number) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState(String(value));
  const parsed = parseSlippagePercent(custom);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  const apply = (next: number) => {
    onApply(next);
    onClose();
  };

  return (
    <div className="wallet-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="wallet-dialog portal-slippage-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-slippage-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="wallet-dialog-close"
          type="button"
          onClick={onClose}
          aria-label="Close slippage settings"
        >
          ×
        </button>
        <div className="wallet-dialog-content">
          <h2 id="portal-slippage-title">Slippage</h2>
          <p className="portal-slippage-help">
            The most the price may move against you before the trade is cancelled.
          </p>

          <div className="portal-slippage-presets">
            {PORTAL_SLIPPAGE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={value === preset}
                onClick={() => apply(preset)}
              >
                {preset}%
              </button>
            ))}
          </div>

          <label className="portal-field">
            <span>Custom</span>
            <div className="portal-slippage-custom">
              <input
                inputMode="decimal"
                value={custom}
                aria-label="Custom slippage percent"
                aria-invalid={parsed === null}
                onChange={(event) => setCustom(event.target.value.replace(/[^\d.]/g, ""))}
              />
              <span aria-hidden="true">%</span>
            </div>
          </label>

          {parsed === null ? (
            <p className="portal-error" role="alert">
              Enter a value between {MIN_PORTAL_SLIPPAGE_PERCENT}% and {MAX_PORTAL_SLIPPAGE_PERCENT}
              %.
            </p>
          ) : (
            parsed > 2 && (
              <p className="portal-slippage-warning" role="status">
                A high tolerance can fill at a noticeably worse price.
              </p>
            )
          )}

          <div className="portal-slippage-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="portal-primary-action"
              disabled={parsed === null}
              onClick={() => parsed !== null && apply(parsed)}
            >
              Apply
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

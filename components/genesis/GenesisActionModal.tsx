"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { ReviewDrawer } from "@/components/rewards/ReviewDrawer";
import { BrowserCaliburActivationPanel } from "@/components/genesis/BrowserCaliburActivationPanel";

const BatchModalContext = createContext<{
  target: HTMLDivElement | null;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setAvailable: Dispatch<SetStateAction<boolean>>;
} | null>(null);

/** Keep wallet settings reachable independently of portfolio loading or holdings. */
export function GenesisActionModal({
  canConfigureCalibur,
  enabled = true,
  children,
}: {
  canConfigureCalibur: boolean;
  enabled?: boolean;
  children: ReactNode | ((controls: ReactNode) => ReactNode);
}) {
  const t = useTranslations("operators.bulk");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(false);
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const context = useMemo(() => ({ target, setBusy, setAvailable }), [target]);

  const controls =
    enabled && (canConfigureCalibur || available) ? (
      <div className="genesis-tools">
        <button
          type="button"
          className="ui-button ui-button--secondary ui-button--sm"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          {t("title")}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        {open && (
          <ReviewDrawer
            title={t("title")}
            variant="modal"
            className="genesis-action-modal"
            busy={busy}
            headerActions={
              canConfigureCalibur ? <BrowserCaliburActivationPanel disabled={busy} /> : null
            }
            onClose={() => setOpen(false)}
          >
            {!available && <p className="genesis-note">{t("minimumOperators")}</p>}
            <div ref={setTarget} className="genesis-modal-content" />
          </ReviewDrawer>
        )}
      </div>
    ) : null;

  return (
    <BatchModalContext.Provider value={context}>
      {typeof children === "function" ? (
        children(controls)
      ) : (
        <>
          {controls}
          {children}
        </>
      )}
    </BatchModalContext.Provider>
  );
}

/** Present each deployment's form in the shared dialog without moving its action state. */
export function GenesisBatchContent({ busy, children }: { busy: boolean; children: ReactNode }) {
  const context = useContext(BatchModalContext);
  const setAvailable = context?.setAvailable;
  const setBusy = context?.setBusy;
  useLayoutEffect(() => {
    setAvailable?.(true);
    return () => setAvailable?.(false);
  }, [setAvailable]);
  useLayoutEffect(() => {
    setBusy?.(busy);
    return () => setBusy?.(false);
  }, [busy, setBusy]);
  return context?.target ? createPortal(children, context.target) : null;
}

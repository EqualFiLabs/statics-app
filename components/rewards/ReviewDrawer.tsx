"use client";
import { useEffect, useLayoutEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import styles from "./earn.module.css";

export function ReviewDrawer({
  title,
  busy = false,
  onClose,
  children,
  variant = "drawer",
}: {
  title: string;
  busy?: boolean;
  /** "modal" centers a compact dialog; "fullscreen" fills the viewport. */
  variant?: "drawer" | "modal" | "fullscreen";
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("earnUx"),
    titleId = useId();
  const root = useRef<HTMLDivElement>(null),
    current = useRef({ busy, onClose });
  useLayoutEffect(() => {
    current.current = { busy, onClose };
  }, [busy, onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const overlay = root.current?.parentElement;
    const siblings = Array.from(overlay?.parentElement?.children ?? []).filter(
      (node) =>
        node !== overlay &&
        node.id !== "headlessui-portal-root" &&
        !node.querySelector("#privy-dialog")
    ) as HTMLElement[];
    const inert = siblings.map((node) => ({ node, previous: node.inert }));
    for (const { node } of inert) node.inert = true;
    root.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      // A nested wallet dialog owns its keyboard interaction while signing.
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("#headlessui-portal-root, #privy-dialog")) return;
      const walletDialog = document.querySelector<HTMLElement>("#privy-dialog");
      if (
        walletDialog &&
        !walletDialog.hidden &&
        walletDialog.getAttribute("aria-hidden") !== "true"
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!current.current.busy) current.current.onClose();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        root.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),summary,[tabindex="0"]'
        ) ?? []
      ).filter(
        (node) =>
          !node.hidden &&
          node.getAttribute("aria-hidden") !== "true" &&
          !Array.from(root.current?.querySelectorAll("details:not([open])") ?? []).some(
            (details) => details.contains(node) && node !== details.querySelector("summary")
          )
      );
      const first = controls[0],
        last = controls.at(-1);
      if (!first) {
        event.preventDefault();
        root.current?.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === root.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === root.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.body.style.overflow = overflow;
      for (const { node, previous } of inert) node.inert = previous;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <div
      className={`${styles.overlay} ${variant === "modal" ? styles.overlayCentered : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={root}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={
          variant === "modal"
            ? styles.modal
            : `${styles.drawer} ${variant === "fullscreen" ? styles.fullScreenDialog : ""}`
        }
      >
        <header className={styles.drawerHeader}>
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="ui-button ui-button--ghost"
            disabled={busy}
            onClick={onClose}
            aria-label={t("close")}
          >
            ×
          </button>
        </header>
        <div className={styles.drawerBody}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

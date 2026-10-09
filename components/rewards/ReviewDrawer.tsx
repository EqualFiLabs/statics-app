"use client";
import { useEffect, useLayoutEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import styles from "./earn.module.css";

/**
 * Open dialogs, oldest first. Dialogs can stack (a pool directory with an allocation dialog
 * over it); only the topmost one handles Escape and traps Tab. The newer overlay is appended
 * later in the document, so it renders above and marks the older one inert while open.
 */
const openDialogs: symbol[] = [];

export function ReviewDrawer({
  title,
  busy = false,
  onClose,
  children,
  variant = "drawer",
  className = "",
}: {
  title: string;
  busy?: boolean;
  /** "modal" centers a compact dialog; "fullscreen" fills the viewport. */
  variant?: "drawer" | "modal" | "fullscreen";
  /** Extra class for the dialog element. */
  className?: string;
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
  // The opener, read before content can autofocus one of its own controls.
  const [opener] = useState(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)
  );
  useEffect(() => {
    const token = Symbol("dialog");
    openDialogs.push(token);
    const previous = opener;
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
    // Content may focus its own first control (an autofocused input); otherwise focus the dialog.
    if (!root.current?.contains(document.activeElement)) root.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (openDialogs.at(-1) !== token) return;
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
      openDialogs.splice(openDialogs.indexOf(token), 1);
      document.removeEventListener("keydown", keydown, true);
      document.body.style.overflow = overflow;
      for (const { node, previous } of inert) node.inert = previous;
      // Return focus to the opener unless something outside the dialog already took it, such
      // as a field the closing action revealed and focused.
      const active = document.activeElement;
      if (previous?.isConnected && (!active || active === document.body || !active.isConnected))
        previous.focus();
    };
  }, [opener]);
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
        className={`${
          variant === "modal"
            ? styles.modal
            : `${styles.drawer} ${variant === "fullscreen" ? styles.fullScreenDialog : ""}`
        } ${className}`}
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

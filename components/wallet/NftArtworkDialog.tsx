"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export function NftArtworkDialog({
  name,
  src,
  onClose,
}: Readonly<{
  name: string;
  src: string;
  onClose: () => void;
}>) {
  const t = useTranslations("nftArtwork");
  const tCommon = useTranslations("common");
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === "Tab") {
        // The close control is deliberately the viewer's only interactive
        // element. Keep focus there instead of letting it reach the page behind
        // the modal.
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = priorOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      returnFocus?.focus();
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="wallet-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="wallet-dialog nft-artwork-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          className="wallet-dialog-close"
          type="button"
          onClick={onClose}
          aria-label={tCommon("close")}
        >
          ×
        </button>
        <div className="wallet-dialog-content nft-artwork-dialog-content">
          <h2 id={titleId}>{t("title", { name })}</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- the same
              arbitrary, already-resolved URI used by the NFT thumbnail is
              reused here without imposing a remote-host allow list. */}
          <img className="nft-artwork-full" src={src} alt={t("alt", { name })} />
        </div>
      </section>
    </div>,
    document.body
  );
}

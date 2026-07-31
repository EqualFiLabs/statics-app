"use client";

import { useTranslations } from "next-intl";

import { glossary, type TermKey } from "@/lib/vocabulary";

type TermProps = {
  name: TermKey;
  /** Render the plural label. */
  plural?: boolean;
  /**
   * Show the protocol's own name alongside the consumer label. Use on
   * reference screens (Settings, docs links) where the mapping matters --
   * not in the middle of a flow, where it is noise.
   */
  showProtocol?: boolean;
};

/**
 * Renders a glossary term using its consumer label, keeping the plain-language
 * explanation on hover and (optionally) the protocol's own name visible.
 *
 * <abbr> is deliberate: the tooltip is the definition, not the expansion of an
 * acronym, but it is the one element that carries "this word has a meaning you
 * can ask for" to both pointer and assistive-tech users.
 */
export function Term({ name, plural = false, showProtocol = false }: TermProps) {
  const t = useTranslations("glossary");
  const label = t(`${name}.${plural ? "plural" : "label"}`);
  const explanation = t(`${name}.plain`);
  const protocolName = glossary[name].protocol;

  return (
    <>
      <abbr className="ui-term" title={explanation}>
        {label}
      </abbr>
      {showProtocol && protocolName !== label && (
        <span className="ui-term-protocol"> ({protocolName})</span>
      )}
    </>
  );
}

import { explain, glossary, protocolTerm, term, termPlural, type TermKey } from "@/lib/vocabulary";

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
  const label = plural ? termPlural(name) : term(name);

  return (
    <>
      <abbr className="ui-term" title={explain(name)}>
        {label}
      </abbr>
      {showProtocol && glossary[name].protocol !== label && (
        <span className="ui-term-protocol"> ({protocolTerm(name)})</span>
      )}
    </>
  );
}

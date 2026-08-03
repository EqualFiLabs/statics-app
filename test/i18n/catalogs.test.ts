import { describe, expect, it } from "vitest";

import english from "@/messages/en.json";
import spanish from "@/messages/es.json";
import chinese from "@/messages/zh-CN.json";

type CatalogValue = string | { readonly [key: string]: CatalogValue };

function flattenCatalog(catalog: CatalogValue, prefix = ""): Record<string, string> {
  if (typeof catalog === "string") return { [prefix]: catalog };
  return Object.fromEntries(
    Object.entries(catalog).flatMap(([key, value]) =>
      Object.entries(flattenCatalog(value, prefix ? `${prefix}.${key}` : key))
    )
  );
}

function variables(message: string): string[] {
  return [...message.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\b/g)].map((match) => match[1]).sort();
}

describe("translation catalogs", () => {
  const catalogs = {
    en: flattenCatalog(english),
    es: flattenCatalog(spanish),
    "zh-CN": flattenCatalog(chinese),
  };
  const englishKeys = Object.keys(catalogs.en).sort();

  it("keeps every locale structurally aligned with English", () => {
    for (const [locale, catalog] of Object.entries(catalogs)) {
      expect(Object.keys(catalog).sort(), locale).toEqual(englishKeys);
    }
  });

  it("preserves interpolation variables in every translation", () => {
    for (const key of englishKeys) {
      const expected = variables(catalogs.en[key]);
      for (const [locale, catalog] of Object.entries(catalogs)) {
        expect(variables(catalog[key]), `${locale}:${key}`).toEqual(expected);
      }
    }
  });
});

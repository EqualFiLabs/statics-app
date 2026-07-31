export const supportedLocales = ["en", "es", "zh-CN"] as const;

export type AppLocale = (typeof supportedLocales)[number];

export const defaultLocale: AppLocale = "en";
export const localeCookieName = "statics-locale";

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && supportedLocales.includes(value as AppLocale);
}

function matchLanguageTag(tag: string): AppLocale | null {
  const normalized = tag.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (normalized === "es" || normalized.startsWith("es-")) return "es";
  if (
    normalized === "zh" ||
    normalized === "zh-cn" ||
    normalized === "zh-sg" ||
    normalized.startsWith("zh-hans")
  ) {
    return "zh-CN";
  }
  return null;
}

export function resolveRequestLocale(
  cookieLocale: string | undefined,
  acceptLanguage: string | null
): AppLocale {
  if (isAppLocale(cookieLocale)) return cookieLocale;
  if (!acceptLanguage) return defaultLocale;

  const preferences = acceptLanguage
    .split(",")
    .map((entry, order) => {
      const [tag, ...parameters] = entry.trim().split(";");
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
      const parsedQuality = qualityParameter
        ? Number.parseFloat(qualityParameter.trim().slice(2))
        : 1;
      return {
        tag,
        order,
        quality: Number.isFinite(parsedQuality) ? parsedQuality : 0,
      };
    })
    .filter((entry) => entry.quality > 0)
    .sort((left, right) => right.quality - left.quality || left.order - right.order);

  for (const preference of preferences) {
    const locale = matchLanguageTag(preference.tag);
    if (locale) return locale;
  }
  return defaultLocale;
}

export const localeLabels: Readonly<Record<AppLocale, string>> = {
  en: "English",
  es: "Español",
  "zh-CN": "简体中文",
};

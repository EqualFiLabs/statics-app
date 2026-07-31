import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { localeCookieName, resolveRequestLocale } from "./config";

export default getRequestConfig(async () => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = resolveRequestLocale(
    cookieStore.get(localeCookieName)?.value,
    headerStore.get("accept-language")
  );

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

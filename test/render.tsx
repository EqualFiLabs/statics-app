import type { ReactElement, ReactNode } from "react";
import { render as testingLibraryRender, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";

import english from "@/messages/en.json";

function EnglishMessages({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={english}>
      {children}
    </NextIntlClientProvider>
  );
}

export function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return testingLibraryRender(ui, { wrapper: EnglishMessages, ...options });
}

export function renderWithLocale(
  ui: ReactElement,
  locale: string,
  messages: AbstractIntlMessages,
  options?: Omit<RenderOptions, "wrapper">
) {
  function LocaleMessages({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    );
  }

  return testingLibraryRender(ui, { wrapper: LocaleMessages, ...options });
}

export * from "@testing-library/react";

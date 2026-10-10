import { useState, type ReactElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as testingLibraryRender, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";

import english from "@/messages/en.json";

function TestQueries({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function EnglishMessages({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={english}>
      <TestQueries>{children}</TestQueries>
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
        <TestQueries>{children}</TestQueries>
      </NextIntlClientProvider>
    );
  }

  return testingLibraryRender(ui, { wrapper: LocaleMessages, ...options });
}

export * from "@testing-library/react";

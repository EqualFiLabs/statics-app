import { render, screen } from "@/test/render";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { Term } from "@/components/common/Term";
import chinese from "@/messages/zh-CN.json";

describe("Term", () => {
  it("localizes consumer vocabulary while preserving protocol terminology", () => {
    render(
      <NextIntlClientProvider locale="zh-CN" messages={chinese}>
        <Term name="position" showProtocol />
      </NextIntlClientProvider>
    );

    expect(screen.getByTitle(/Statics/)).toHaveTextContent("头寸");
    expect(screen.getByText(/\(PositionNFT\)/)).toBeInTheDocument();
  });
});

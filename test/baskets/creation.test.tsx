import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BasketCreatePage } from "@/components/baskets/BasketCreatePage";

describe("basket launch policy", () => {
  it("offers no public basket creation transaction", () => {
    render(<BasketCreatePage />);

    expect(
      screen.getByRole("heading", { name: "Basket launches are steward-controlled" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create basket/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse baskets" })).toHaveAttribute(
      "href",
      "/app/baskets"
    );
  });
});

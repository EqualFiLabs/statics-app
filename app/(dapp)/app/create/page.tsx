import type { Metadata } from "next";

import { BasketCreatePage } from "@/components/baskets/BasketCreatePage";

export const metadata: Metadata = {
  title: "Create Basket | Statics",
  description: "Review a permissionless Statics basket configuration before creation.",
};

export default function BasketCreateRoute() {
  return <BasketCreatePage />;
}

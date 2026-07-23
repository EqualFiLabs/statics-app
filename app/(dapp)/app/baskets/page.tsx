import type { Metadata } from "next";

import { BasketListPage } from "@/components/baskets/BasketListPage";

export const metadata: Metadata = {
  title: "Baskets | Statics",
  description: "Discover and inspect current Statics basket state.",
};

export default function BasketsRoute() {
  return <BasketListPage />;
}

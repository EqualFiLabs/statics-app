import { notFound } from "next/navigation";

import { AtomicConformancePage } from "@/components/genesis/AtomicConformancePage";

export default function Page() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "development") notFound();
  return <AtomicConformancePage />;
}

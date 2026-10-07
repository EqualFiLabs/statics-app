import { redirect } from "next/navigation";
import { RewardsPage } from "@/components/rewards/RewardsPage";
import { earnViews } from "@/lib/rewards/earn";
export default async function EarnFeatureRoute({
  params,
}: {
  params: Promise<{ feature: string }>;
}) {
  const { feature } = await params;
  const view = earnViews.find((view) => view === feature);
  if (!view) redirect("/app/rewards");
  return <RewardsPage earnView={view} />;
}

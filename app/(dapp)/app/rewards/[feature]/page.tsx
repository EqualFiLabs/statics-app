import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { RewardsPage } from "@/components/rewards/RewardsPage";
import { earnViews } from "@/lib/rewards/earn";

/**
 * The Bribes view was retired. Its LP share now lives in Liquidity rewards and its allocator
 * share in Allocations; old links keep their position and pool focus.
 */
function retiredBribesTarget(search: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const key of ["positionId", "poolId", "asset"] as const) {
    const value = search[key];
    if (typeof value === "string") params.set(key, value);
  }
  const target = search.share === "allocator" ? "allocations" : "gauge";
  // Allocations has no asset filter.
  if (target === "allocations") params.delete("asset");
  return `/app/rewards/${target}${params.size ? `?${params}` : ""}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ feature: string }>;
}): Promise<Metadata> {
  const { feature } = await params;
  const view = earnViews.find((view) => view === feature);
  const page = await getTranslations("pageMetadata.earn");
  if (!view) return { title: page("title"), description: page("description") };
  const t = await getTranslations("earnUx");
  return { title: page("viewTitle", { view: t(view) }), description: page("description") };
}

export default async function EarnFeatureRoute({
  params,
  searchParams,
}: {
  params: Promise<{ feature: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { feature } = await params;
  if (feature === "bribes") redirect(retiredBribesTarget(await searchParams));
  const view = earnViews.find((view) => view === feature);
  if (!view) redirect("/app/rewards");
  return <RewardsPage earnView={view} />;
}

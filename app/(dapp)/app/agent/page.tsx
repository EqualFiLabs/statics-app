import { notFound } from "next/navigation";
import { AgentPanel } from "@/components/agent/AgentPanel";
export const metadata = {
  title: "Agent",
  description: "Prepare staking actions, manage delegation and recover activity.",
};
export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ positionId?: string; amount?: string }>;
}) {
  if (process.env.NEXT_PUBLIC_AGENT_ENABLED !== "true") notFound();
  const params = await searchParams;
  return <AgentPanel positionId={params.positionId} amount={params.amount} />;
}

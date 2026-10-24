import { proxyAgent } from "@/lib/server/agent-proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxyAgent(request, (await context.params).path);
}
export { handle as GET, handle as POST, handle as PUT };

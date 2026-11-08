export async function proxyAgent(request: Request, path: readonly string[]): Promise<Response> {
  if (process.env.NEXT_PUBLIC_AGENT_ENABLED !== "true")
    return Response.json({ error: "Agent pilot is unavailable." }, { status: 404 });
  const base = process.env.AGENT_SERVICE_URL;
  const key = process.env.AGENT_APP_CONNECTION_KEY;
  if (!base || !key)
    return Response.json({ error: "Agent connection is unavailable." }, { status: 503 });
  const token = request.headers.get("authorization");
  if (!token?.startsWith("Bearer "))
    return Response.json({ error: "Sign in to use the agent." }, { status: 401 });
  if (path[0] !== "v1" || path.some((part) => !/^[a-zA-Z0-9-]+$/.test(part)))
    return Response.json({ error: "Unknown agent operation." }, { status: 404 });
  const url = new URL(base);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))
  )
    return Response.json({ error: "Agent connection is unavailable." }, { status: 503 });
  url.pathname = `/${path.join("/")}`;
  url.search = new URL(request.url).search;
  const headers: Record<string, string> = {
    authorization: token,
    "content-type": "application/json",
    "x-agent-app": "statics",
    "x-agent-app-key": key,
    "x-agent-wallet": request.headers.get("x-agent-wallet") ?? "",
    "x-agent-chain": request.headers.get("x-agent-chain") ?? "",
  };
  try {
    let body: string | undefined;
    if (request.method !== "GET" && request.body) {
      const reader = request.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 262_144)
            return Response.json({ error: "Request is too large." }, { status: 413 });
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      body = Buffer.concat(chunks).toString("utf8");
    }
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Agent connection interrupted. Check activity before retrying." },
      { status: 503 }
    );
  }
}

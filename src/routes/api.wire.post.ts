import { createFileRoute } from "@tanstack/react-router";
import { rpcUrl } from "@/lib/terminus/relay-live";
import { wireAuthorised } from "@/lib/terminus/wire-auth";
import { runWirePost } from "@/lib/terminus/wire-run";

const NO_STORE = { "cache-control": "no-store" };

/**
 * `GET|POST /api/wire/post`: the poster job. Authorised by the pinger's
 * `x-wire-key` or Vercel Cron's bearer; never cached; never echoes an error
 * message (viem's carry the RPC URL).
 */
async function handle(request: Request): Promise<Response> {
  if (!wireAuthorised(request.headers, process.env)) {
    console.warn("[wire] unauthorised call");
    return Response.json({ error: "unauthorised" }, { status: 401, headers: NO_STORE });
  }
  try {
    const result = await runWirePost();
    const { posted, skipped, txHash, block, reason } = result;
    console.info("[wire] run", { posted, skipped, txHash, block, reason });
    return Response.json(result, { headers: NO_STORE });
  } catch (err) {
    let message = (err instanceof Error ? err.message : String(err)).replaceAll(rpcUrl(), "<rpc>");
    const posterKey = process.env.WIRE_POSTER_KEY;
    if (posterKey) message = message.replaceAll(posterKey, "<key>");
    console.warn("[wire] post failed", { message: message.slice(0, 300) });
    return Response.json({ error: "post failed" }, { status: 500, headers: NO_STORE });
  }
}

export const Route = createFileRoute("/api/wire/post")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});

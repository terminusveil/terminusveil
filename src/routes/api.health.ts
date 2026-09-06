import { createFileRoute } from "@tanstack/react-router";
import { setResponseHeader } from "@tanstack/react-start/server";
import { BUILD } from "@/lib/build";
import { healthPayload } from "@/lib/terminus/api-shape";
import { getDesk } from "@/lib/terminus/fetch-desk";

/** `GET /api/health`: the build that answered and the reading it holds. Never cached. */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const desk = await getDesk();
        // getDesk() stamps the edge cache header for its callers; health is never cached.
        setResponseHeader("cache-control", "no-store");
        return Response.json(healthPayload(desk, BUILD), {
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { pendingPayload } from "@/lib/terminus/api-shape";
import { EDGE_CACHE_CONTROL, getDesk } from "@/lib/terminus/fetch-desk";

/** `GET /api/pending`: every veiled or due ticker with its four reads, and the reading they came from. */
export const Route = createFileRoute("/api/pending")({
  server: {
    handlers: {
      GET: async () => {
        const desk = await getDesk();
        return Response.json(pendingPayload(desk), {
          headers: { "cache-control": EDGE_CACHE_CONTROL },
        });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { EDGE_CACHE_CONTROL } from "@/lib/terminus/fetch-desk";
import { readTape } from "@/lib/terminus/relay-live";

export const Route = createFileRoute("/api/tape")({
  server: {
    handlers: {
      GET: async () => {
        const tape = await readTape();
        return Response.json(tape, { headers: { "cache-control": EDGE_CACHE_CONTROL } });
      },
    },
  },
});

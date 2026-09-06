import { createFileRoute } from "@tanstack/react-router";
import { pendingRows } from "@/lib/terminus/api-shape";
import { EDGE_CACHE_CONTROL, getDesk } from "@/lib/terminus/fetch-desk";

export const Route = createFileRoute("/api/desk")({
  server: {
    handlers: {
      GET: async () => {
        const desk = await getDesk();
        return Response.json(
          {
            fetchedAt: desk.fetchedAt,
            source: desk.source,
            absent: desk.absent,
            readAt: desk.readAt,
            feedReadAt: desk.feedReadAt,
            feedStale: desk.feedStale,
            tape: desk.tape,
            heroTicker: desk.heroTicker,
            pendingCount: desk.pendingCount,
            stagedCount: desk.stagedCount,
            veiledCount: desk.veiledCount,
            dueCount: desk.dueCount,
            assetCount: desk.assetCount,
            pending: pendingRows(desk),
          },
          { headers: { "cache-control": EDGE_CACHE_CONTROL } },
        );
      },
    },
  },
});

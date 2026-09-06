import { createFileRoute } from "@tanstack/react-router";
import { setResponseHeader } from "@tanstack/react-start/server";
import { getDesk } from "@/lib/terminus/fetch-desk";
import { buildIcs, coveringAsAction } from "@/lib/terminus/ics";
import { isValidTicker, rowFor } from "@/lib/terminus/types";

export const Route = createFileRoute("/api/calendar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const ticker = url.searchParams.get("ticker")?.trim().toUpperCase() ?? "";
        if (ticker && !isValidTicker(ticker)) {
          return Response.json(
            { error: "invalid ticker" },
            { status: 400, headers: { "cache-control": "no-store" } },
          );
        }

        const desk = await getDesk();
        // getDesk() sets the edge cache-control header for its own callers
        // (api.desk.ts, page loaders); the calendar carries a ticker in the
        // request and must never be shared across readers, so it overrides
        // that back to no-store — the last write on the underlying event wins
        // over both the earlier setResponseHeader call and this route's own
        // Response-level header of the same name.
        setResponseHeader("cache-control", "no-store");
        const extras = new Map(desk.rows.map((r) => [r.ticker, r]));

        let actions = desk.actions.filter((a) => a.status === "in_progress");
        if (ticker) {
          actions = actions.filter((a) => a.ticker === ticker);
          if (actions.length === 0) {
            const row = rowFor(desk, ticker);
            const covering = row ? coveringAsAction(row) : null;
            if (covering) actions = [covering];
          }
        }

        const filename = ticker ? `${ticker.toLowerCase()}-terminus.ics` : "terminus-veil.ics";
        const body = buildIcs(actions, extras);
        return new Response(body, {
          headers: {
            "content-type": "text/calendar; charset=utf-8",
            "content-disposition": `attachment; filename="${filename}"`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});

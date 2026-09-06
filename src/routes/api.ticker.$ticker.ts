import { createFileRoute } from "@tanstack/react-router";
import { setResponseHeader } from "@tanstack/react-start/server";
import { tickerPayload } from "@/lib/terminus/api-shape";
import { EDGE_CACHE_CONTROL, getDesk } from "@/lib/terminus/fetch-desk";
import { isValidTicker, rowFor } from "@/lib/terminus/types";

/** `GET /api/ticker/{ticker}`: one ticker's four reads, terminus, oracle and contract. */
export const Route = createFileRoute("/api/ticker/$ticker")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const ticker = params.ticker.trim().toUpperCase();
        if (!isValidTicker(ticker)) {
          return Response.json(
            { error: "invalid ticker" },
            { status: 400, headers: { "cache-control": "no-store" } },
          );
        }
        const desk = await getDesk();
        const row = rowFor(desk, ticker);
        if (!row) {
          setResponseHeader("cache-control", "no-store");
          return Response.json(
            { error: "no token for that ticker" },
            { status: 404, headers: { "cache-control": "no-store" } },
          );
        }
        return Response.json(tickerPayload(desk, row), {
          headers: { "cache-control": EDGE_CACHE_CONTROL },
        });
      },
    },
  },
});

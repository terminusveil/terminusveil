import { createFileRoute } from "@tanstack/react-router";
import { siteUrl } from "@/lib/site-meta";
import { EDGE_CACHE_CONTROL } from "@/lib/terminus/fetch-desk";
import { openapiDocument } from "@/lib/terminus/openapi";

/** `GET /api/openapi.json`: the public reads, described once. */
export const Route = createFileRoute("/api/openapi.json")({
  server: {
    handlers: {
      GET: ({ request }) =>
        Response.json(openapiDocument(siteUrl() ?? new URL(request.url).origin), {
          headers: { "cache-control": EDGE_CACHE_CONTROL },
        }),
    },
  },
});

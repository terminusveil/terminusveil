import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { buildDesk, emptyDesk } from "./desk";

/**
 * The desk is a public, non-personalised read (no auth, no session), so an
 * edge/CDN cache can serve it to every reader for a short window: 30 s fresh,
 * then up to 120 s stale while a background refresh runs. `/api/desk` and
 * `/api/tape` set the same header directly on their `Response`.
 */
export const EDGE_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=120";

export const getDesk = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("cache-control", EDGE_CACHE_CONTROL);
  let desk;
  try {
    desk = await buildDesk();
  } catch {
    return emptyDesk();
  }
  // The desk posts on its own (wire-run.ts, selfPost): at most one attempt per
  // half hour per instance, and only when the poster key is set. Loaded here,
  // inside the server function, so the signing code never nears a client bundle.
  const { selfPost } = await import("./wire-run");
  await selfPost();
  return desk;
});

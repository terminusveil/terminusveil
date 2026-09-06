import { createFileRoute } from "@tanstack/react-router";
import { setResponseHeader } from "@tanstack/react-start/server";
import { siteUrl } from "@/lib/site-meta";
import { getDesk } from "@/lib/terminus/fetch-desk";

/** Every page with its own `pageHead`, in nav order; `/paper` only redirects. */
export const STATIC_PATHS = [
  "/",
  "/token",
  "/docs",
  "/events",
  "/cover",
  "/status",
  "/changelog",
  "/terms",
  "/privacy",
];

/** The sitemap changes when a name joins or leaves the desk: hours, not seconds. */
const SITEMAP_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

function escapeXml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function sitemapXml(origin: string, tickers: readonly string[]): string {
  const paths = [...STATIC_PATHS, ...tickers.map((t) => `/events/${t}`)];
  const urls = paths.map((p) => `  <url><loc>${escapeXml(`${origin}${p}`)}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const origin = siteUrl();
        // Same rule as ogMeta: no absolute URLs without a known origin.
        if (!origin) {
          return new Response("VITE_SITE_URL is unset; no sitemap.", {
            status: 404,
            headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
          });
        }
        const desk = await getDesk();
        // getDesk() set the 30 s desk edge header on this request's event; the
        // last write wins, so the sitemap's own, longer window goes after it.
        setResponseHeader("cache-control", SITEMAP_CACHE_CONTROL);
        const tickers = desk.rows.map((r) => r.ticker);
        return new Response(sitemapXml(origin, tickers), {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": SITEMAP_CACHE_CONTROL,
          },
        });
      },
    },
  },
});

import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, pageMeta } from "@/lib/site-meta";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: ({ matches }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // No canonical here: leaf routes emit their own via pageHead, and
      // HeadContent does not dedupe links. A path no route matches is marked
      // on the root match, so the 404 page gets a "Not found" title.
      ...pageMeta({
        title: matches.some((m) => m._notFound) ? `Not found · ${SITE_NAME}` : SITE_TITLE,
        description: SITE_DESCRIPTION,
        path: "/",
      }),
      { name: "theme-color", content: "#08090A" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "preload",
        href: "/fonts/jakarta-400.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: "/fonts/fraunces-italic-500.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: "/fonts/plex-500.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        // The upright display face carries every h1; without the preload the
        // largest text on a phone swaps in last.
        rel: "preload",
        href: "/fonts/fraunces-600.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-paper font-sans text-ink antialiased">
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}

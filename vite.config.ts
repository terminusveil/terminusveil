import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

/**
 * A root `vercel.json` `headers` block is not applied here: Nitro's Vercel
 * preset writes its own `.vercel/output/config.json` from scratch (routes for
 * `/assets` immutable caching plus the `__server` catch-all) and never reads
 * the project's `vercel.json` to merge headers into it — confirmed by
 * inspecting the built `config.json`, which carries none of the entries a
 * `vercel.json` `headers` array would add. Nitro's own `routeRules.headers`
 * is what lands in the Build Output, so the security headers are set here.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy": "frame-ancestors 'none'",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

/** The commit being built: Vercel's env on Vercel, git locally, `unknown` without either. */
function buildCommit(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig(({ command, isPreview }) => ({
  define: {
    __BUILD_COMMIT__: JSON.stringify(buildCommit()),
    __BUILD_AT__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    port: 8080,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" || isPreview
      ? [
          nitro({
            preset: "vercel",
            routeRules: {
              "**": { headers: SECURITY_HEADERS },
            },
            // The last-move fan-out (bounded to 10 due names, one request each
            // at a 4 s timeout) can still run past Vercel's default function
            // duration under a cold RPC; this raises the ceiling for every
            // function this preset builds.
            vercel: {
              functions: { maxDuration: 60 },
              // Vercel Cron, the daily floor; the desk's own half-hourly posting
              // from inside its refresh (ARCHITECTURE.md, section 5) is the sharper cadence.
              config: { crons: [{ path: "/api/wire/post", schedule: "0 12 * * *" }] },
            },
          }),
        ]
      : []),
    viteReact(),
  ],
}));

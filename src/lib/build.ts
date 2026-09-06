declare const __BUILD_COMMIT__: string | undefined;
declare const __BUILD_AT__: string | undefined;

/**
 * The deployed commit and build time, stamped by `vite.config.ts` (`define`)
 * from `VERCEL_GIT_COMMIT_SHA` on Vercel or `git rev-parse` locally. `dev`
 * and an empty time outside a Vite build (tests).
 */
export const BUILD: { commit: string; at: string } = {
  commit: typeof __BUILD_COMMIT__ === "string" ? __BUILD_COMMIT__ : "dev",
  at: typeof __BUILD_AT__ === "string" ? __BUILD_AT__ : "",
};

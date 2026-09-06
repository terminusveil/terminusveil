/**
 * What has shipped, dated the day it landed on the site (git history, not
 * plans). Newest first. Nothing here is a promise; the phase table carries
 * those, with status words and no dates.
 */
export type ChangelogEntry = { date: string; items: readonly string[] };

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    date: "2026-09-06",
    items: [
      "The Wire: TerminusWire, the phase 1 contract, with its tests; a poster job; a Wire line on every veiled plate. The Seal became a row of the Wire.",
      "Windows on the ticker page: pons launches paired to a veiled ticker and the Uniswap v4 pools that hold it, from a dated index plus a live delta.",
      "VeilPass, the phase 2 contract, with its tests. Not deployed.",
      "The token's paused() read: transfers paused prints on the plate.",
      "Phases renumbered: 0 Desk, 1 Wire, 2 Key, 3 Matcher.",
      "/api/health, /api/pending and /api/ticker carry wire, windows and transferPaused; /status prints the Wire.",
    ],
  },
  {
    date: "2026-09-05",
    items: [
      "Public reads: /api/health, /api/pending, /api/ticker/{ticker}, /api/openapi.json.",
      "TerminusSeal, the phase 2 contract, with its tests. Not deployed.",
      "/token: spec sheet, is / is not, the pons v2 launch strip, the verify table.",
      "Landing: status kicker, category line, four proof tiles, the house plate.",
      "/docs: a sticky table of contents; who controls what.",
      "Contrast, type floor, motion and keyboard fixes across the site.",
      "Cash dividends print in dollars. The word for a stock token is ticker.",
      "Launch-day mechanics: every pre-launch line flips from one file; a test refuses a partial paste.",
      "Terms, privacy, a real 404, sitemap, share cards, security headers.",
    ],
  },
  {
    date: "2026-09-04",
    items: [
      "Voice pass: seventy-one strings rewritten; events tabs; Up next on the row grid.",
      "Snapshot fallback: when a source does not answer, the desk serves its last committed reading, captioned.",
      "Honest plates: an assumed terminus is marked; due means no move read; the last move is read from UIMultiplierUpdated.",
      "The desk: four reads per ticker, events by process date, calendar export, a covering in the browser.",
    ],
  },
];

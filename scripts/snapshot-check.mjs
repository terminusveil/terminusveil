#!/usr/bin/env node
/**
 * Snapshot age guard, run by `prebuild`. Prints when data/snapshot/meta.json was
 * read and warns when that reading is older than a week. Never fails the build:
 * a stale snapshot is still a labelled, dated reading.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_AGE_DAYS = 7;
const DAY_MS = 86_400_000;
const HINT = "run npm run snapshot from a network that reaches robinhood.com";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const metaPath = join(root, "data", "snapshot", "meta.json");

let readAt = null;
try {
  readAt = JSON.parse(readFileSync(metaPath, "utf8")).readAt ?? null;
} catch (err) {
  console.log(
    `WARNING: data/snapshot/meta.json could not be read (${err?.message ?? err}) — ${HINT}`,
  );
  process.exit(0);
}

const readMs = Date.parse(readAt);
if (!Number.isFinite(readMs)) {
  console.log(`WARNING: data/snapshot/meta.json readAt is not a date (${readAt}) — ${HINT}`);
  process.exit(0);
}

const ageMs = Date.now() - readMs;
const days = Math.floor(ageMs / DAY_MS);
console.log(`[snapshot] read ${readAt} (${days} days ago)`);
if (ageMs > MAX_AGE_DAYS * DAY_MS) {
  console.log(`WARNING: snapshot is ${days} days old — ${HINT}`);
}
process.exit(0);

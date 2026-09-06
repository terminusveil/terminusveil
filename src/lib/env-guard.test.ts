import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `.env` is tracked on purpose: it holds the one public value the build reads
 * locally (`VITE_SITE_URL`) and the README's deploy contract points at it. That
 * makes it a place a secret could land by habit — the poster key, an RPC URL
 * with a token — and be committed. Every secret belongs on Vercel only, so this
 * fails when the tracked file names any other key, and when any value looks
 * like a private key whatever it is called.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENV = join(ROOT, ".env");
const EXAMPLE = join(ROOT, ".env.example");

/** The only key the tracked `.env` may carry. Everything else is Vercel's. */
const ALLOWED = ["VITE_SITE_URL"];
/** A 32-byte hex secret: a private key, a poster key, an API token of that shape. */
const HEX_KEY = /0x[0-9a-fA-F]{64}\b/;

/** `KEY=value` lines, comments and blanks dropped. */
function entries(src: string): { key: string; value: string; line: number }[] {
  const out: { key: string; value: string; line: number }[] = [];
  src.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const eq = line.indexOf("=");
    if (eq <= 0) return;
    out.push({ key: line.slice(0, eq).trim(), value: line.slice(eq + 1).trim(), line: i + 1 });
  });
  return out;
}

describe("the tracked .env", () => {
  it("exists and is readable, so this guard is not vacuous", () => {
    assert.ok(
      existsSync(ENV),
      ".env is tracked and carries the public origin; if you copied .env.example over it, `git checkout .env` and use .env.local",
    );
    assert.ok(entries(readFileSync(ENV, "utf8")).length > 0, ".env holds no key at all");
  });

  it("names no key but VITE_SITE_URL", () => {
    const extra = entries(readFileSync(ENV, "utf8"))
      .filter((e) => !ALLOWED.includes(e.key))
      .map((e) => `.env:${e.line} ${e.key}`);
    assert.deepEqual(
      extra,
      [],
      `${extra.join(", ")} — secrets live on Vercel, and .env.example documents them`,
    );
  });

  it("holds no value shaped like a private key", () => {
    const src = readFileSync(ENV, "utf8");
    const hit = src.split(/\r?\n/).findIndex((l) => HEX_KEY.test(l));
    assert.equal(hit, -1, `.env:${hit + 1} carries a 0x + 64 hex value`);
  });

  it("warns in .env.example that it is not to be copied over the tracked file", () => {
    const first = readFileSync(EXAMPLE, "utf8").split(/\r?\n/)[0] ?? "";
    assert.match(first, /^#.*tracked \.env/);
    assert.match(first, /Vercel/);
  });
});

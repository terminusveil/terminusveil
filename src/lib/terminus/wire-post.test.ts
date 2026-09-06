import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRow } from "./desk.ts";
import type { TickerRow, WireRead } from "./types.ts";
import { MAX_POSTS, planPosts } from "./wire-post.ts";

const WAD = 10n ** 18n;
const NOW = Date.parse("2026-09-06T12:00:00Z");
const sec = (iso: string) => Math.floor(Date.parse(iso) / 1000);

function row(
  ticker: string,
  over: { staged?: bigint | null; at?: number | null; state?: TickerRow["state"] } = {},
): TickerRow {
  const staged = over.staged === undefined ? 2n * WAD : over.staged;
  const at = over.at === undefined ? sec("2026-09-09T13:30:00Z") : over.at;
  const r = buildRow({
    ticker,
    name: null,
    address: "0x1111111111111111111111111111111111111111",
    live: WAD.toString(),
    liveApi: null,
    liveOnchain: WAD.toString(),
    staged: staged === null ? null : staged.toString(),
    stagedApi: null,
    stagedOnchain: staged === null ? null : staged.toString(),
    effectiveAtIso: at ? new Date(at * 1000).toISOString() : null,
    effectiveAtSource: at ? "chain" : null,
    effectiveAtOnchainSec: at,
    action: null,
    tapeAbsent: false,
    paused: false,
    transferPaused: false,
    onchain: true,
    now: NOW,
  });
  if (over.state) r.state = over.state;
  else if (staged !== null) r.state = "veiled";
  return r;
}

describe("planPosts", () => {
  it("posts every row whose contract was read, soonest terminus first", () => {
    const rows = [row("B", { at: sec("2026-09-10T13:30:00Z") }), row("A"), row("C", { at: null })];
    const plan = planPosts(rows, new Map());
    assert.deepEqual(
      plan.map((p) => p.ticker),
      ["A", "B", "C"],
    );
    assert.equal(plan[0]?.staged, (2n * WAD).toString());
    assert.equal(plan[2]?.terminus, 0);
  });

  it("posts the contract's own figure and time, never the issuer's or an assumed one", () => {
    const r = row("V");
    r.stagedApi = "3";
    r.staged = "3000000000000000000";
    r.stagedOnchain = "2000000000000000000";
    r.effectiveAtIso = new Date(NOW).toISOString();
    r.terminusSource = "assumed";
    r.effectiveAtOnchainSec = null;
    r.state = "veiled";
    const plan = planPosts([r], new Map());
    assert.equal(plan.length, 1);
    assert.equal(plan[0]?.staged, "2000000000000000000");
    assert.equal(plan[0]?.terminus, 0);
  });

  it("skips a row the poster already carries with the same figure and terminus", () => {
    const at = sec("2026-09-09T13:30:00Z");
    const latest = new Map<string, WireRead | null>([
      ["A", { staged: (2n * WAD).toString(), terminus: at, postedAt: 1 }],
      ["B", { staged: (3n * WAD).toString(), terminus: at, postedAt: 1 }],
      ["C", { staged: (2n * WAD).toString(), terminus: at + 1, postedAt: 1 }],
      ["D", null],
    ]);
    const plan = planPosts([row("A"), row("B"), row("C"), row("D")], latest);
    assert.deepEqual(
      plan.map((p) => p.ticker),
      ["B", "C", "D"],
    );
  });

  it("posts open and paused rows as the contract holds them; skips a row whose contract was not read", () => {
    const open = row("O", { staged: null, at: null });
    assert.equal(open.state, "open");
    const paused = row("P", { state: "paused" });
    // An absent row has no contract read at all, so there is nothing to post.
    const absent = row("X", { state: "absent" });
    absent.stagedOnchain = null;
    absent.liveOnchain = null;
    const unread = row("U", { staged: null, at: null, state: "veiled" });
    unread.liveOnchain = null;
    assert.deepEqual(planPosts([open, paused, absent, unread], new Map()), [
      { ticker: "P", staged: (2n * WAD).toString(), terminus: sec("2026-09-09T13:30:00Z") },
      { ticker: "O", staged: WAD.toString(), terminus: 0 },
    ]);
  });

  it("posts the contract's live figure with terminus 0 when it stages nothing (an issuer-only action)", () => {
    const issuerOnly = row("I", { staged: null, at: null, state: "veiled" });
    assert.deepEqual(planPosts([issuerOnly], new Map()), [
      { ticker: "I", staged: WAD.toString(), terminus: 0 },
    ]);
    const carried = new Map<string, WireRead | null>([
      ["I", { staged: WAD.toString(), terminus: 0, postedAt: 1 }],
    ]);
    assert.deepEqual(planPosts([issuerOnly], carried), []);
  });

  it("caps at MAX_POSTS", () => {
    const rows = Array.from({ length: MAX_POSTS + 5 }, (_, i) => row(`T${i}`));
    assert.equal(planPosts(rows, new Map()).length, MAX_POSTS);
    assert.equal(MAX_POSTS, 64);
  });
});

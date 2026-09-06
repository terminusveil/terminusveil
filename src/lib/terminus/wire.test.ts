import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters } from "viem";
import { buildRow } from "./desk.ts";
import { houseFrom } from "./house.ts";
import {
  decodeCount,
  decodeLatest,
  encodeLatest,
  tickerBytes32,
  wireFact,
  wireMatches,
} from "./wire.ts";

const WAD = 10n ** 18n;
const POSTER = "0x4444444444444444444444444444444444444444" as const;
const WIRE = "0x3333333333333333333333333333333333333333" as const;
const NOW = Date.parse("2026-09-06T12:00:00Z");
const sec = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const TERMINUS = sec("2026-09-09T13:30:00Z");

function encodedPost(staged: bigint, terminus: number, postedAt: number): `0x${string}` {
  return encodeAbiParameters(
    [{ type: "tuple", components: [{ type: "uint256" }, { type: "uint64" }, { type: "uint64" }] }],
    [[staged, BigInt(terminus), BigInt(postedAt)]],
  );
}

function veiled(
  over: {
    stagedOnchain?: string | null;
    effectiveAtOnchainSec?: number | null;
    wire?: ReturnType<typeof decodeLatest>;
    /** Whether the desk's Wire read answered for this ticker; false is the unread default. */
    wireRead?: boolean;
  } = {},
) {
  const row = buildRow({
    ticker: "NVDA",
    name: "NVIDIA",
    address: "0x1111111111111111111111111111111111111111",
    live: WAD.toString(),
    liveApi: null,
    liveOnchain: WAD.toString(),
    staged: (4n * WAD).toString(),
    stagedApi: null,
    stagedOnchain: over.stagedOnchain === undefined ? (4n * WAD).toString() : over.stagedOnchain,
    effectiveAtIso: new Date(TERMINUS * 1000).toISOString(),
    effectiveAtSource: "chain",
    effectiveAtOnchainSec:
      over.effectiveAtOnchainSec === undefined ? TERMINUS : over.effectiveAtOnchainSec,
    action: null,
    tapeAbsent: false,
    paused: false,
    transferPaused: false,
    onchain: true,
    now: NOW,
  });
  // buildRow resolves the state from the figures; the tests pin it so a later change to resolveState cannot mask them.
  row.state = "veiled";
  row.wire = over.wire ?? null;
  row.wireRead = over.wireRead ?? Boolean(over.wire);
  return row;
}

const live = houseFrom({ wire: { address: WIRE, poster: POSTER } });
const dark = houseFrom({ wire: { address: null, poster: null } });

describe("wire encoding", () => {
  it("keys a ticker as UTF-8 right-padded to 32 bytes", () => {
    assert.equal(tickerBytes32("NVDA"), "0x4e564441" + "0".repeat(56));
  });

  it("encodes latest(poster, ticker) with the selector and both arguments", () => {
    const data = encodeLatest(POSTER, "NVDA");
    assert.equal(data.slice(0, 10), "0x68205bc3");
    assert.equal(data.length, 10 + 64 * 2);
    assert.ok(data.toLowerCase().includes(POSTER.slice(2)));
  });

  it("decodes a post, and reads staged 0 as nothing posted", () => {
    assert.deepEqual(decodeLatest(encodedPost(4n * WAD, TERMINUS, 1_757_000_000)), {
      staged: (4n * WAD).toString(),
      terminus: TERMINUS,
      postedAt: 1_757_000_000,
    });
    assert.equal(decodeLatest(encodedPost(0n, 0, 0)), null);
    assert.equal(decodeLatest(null), null);
    assert.equal(decodeLatest("0x"), null);
    assert.equal(decodeLatest("0xdead"), null);
  });

  it("decodes a count", () => {
    assert.equal(decodeCount("0x" + 7n.toString(16).padStart(64, "0")), 7);
    assert.equal(decodeCount(null), null);
  });
});

describe("wireFact", () => {
  it("is absent while the Wire is not live; an open row gets a line like any other", () => {
    assert.equal(wireFact(veiled(), dark), null);
    const open = veiled({ stagedOnchain: null, effectiveAtOnchainSec: null });
    open.state = "open";
    assert.equal(wireFact(open, live), "not read");
  });

  it("says not posted yet only when the read ran and the poster had nothing", () => {
    assert.equal(wireFact(veiled({ wireRead: true }), live), "not posted yet");
  });

  it("says not read when the Wire read did not run or did not answer for the ticker", () => {
    // A snapshot build, an absent tape, or an errored entry: the desk never
    // claims the chain is empty on a read it did not make.
    assert.equal(wireFact(veiled({ wireRead: false }), live), "not read");
    assert.equal(wireFact(veiled(), live), "not read");
  });

  it("matches when the post carries the contract's staged figure and terminus", () => {
    const row = veiled({
      wire: {
        staged: (4n * WAD).toString(),
        terminus: TERMINUS,
        postedAt: sec("2026-09-05T13:12:00Z"),
      },
    });
    assert.equal(wireMatches(row.wire!, row), true);
    const fact = wireFact(row, live)!;
    assert.ok(fact.startsWith("4× · posted "), fact);
    assert.ok(fact.endsWith(" · matches the contract"), fact);
  });

  it("names what the contract reads now when the post is stale", () => {
    const row = veiled({
      wire: {
        staged: (2n * WAD).toString(),
        terminus: TERMINUS,
        postedAt: sec("2026-09-05T13:12:00Z"),
      },
    });
    assert.equal(wireMatches(row.wire!, row), false);
    assert.ok(wireFact(row, live)!.endsWith(" · contract now reads 4×"));
    const gone = veiled({ stagedOnchain: null, wire: row.wire });
    assert.ok(wireFact(gone, live)!.endsWith(" · contract now reads 1×"));
    const unread = veiled({ stagedOnchain: null, wire: row.wire });
    unread.liveOnchain = null;
    assert.ok(wireFact(unread, live)!.endsWith(" · contract now reads nothing read"));
  });

  it("matches a post of the live figure with terminus 0 when the contract stages nothing", () => {
    const row = veiled({
      stagedOnchain: null,
      effectiveAtOnchainSec: null,
      wire: { staged: WAD.toString(), terminus: 0, postedAt: 1 },
    });
    assert.equal(wireMatches(row.wire!, row), true);
    assert.ok(wireFact(row, live)!.startsWith("1× · posted "));
  });

  it("treats a different terminus as a mismatch even with the same figure", () => {
    const row = veiled({
      wire: { staged: (4n * WAD).toString(), terminus: TERMINUS + 60, postedAt: 1 },
    });
    assert.equal(wireMatches(row.wire!, row), false);
  });
});

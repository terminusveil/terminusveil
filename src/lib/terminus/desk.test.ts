import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildFromSources, buildRow, type Sources } from "./desk.ts";
import {
  coveringCaption,
  formatMultiplier,
  moveAfterTerminus,
  multipliersDiffer,
} from "./format.ts";
import { houseFrom } from "./house.ts";
import type { LastMoveRead } from "./last-move.ts";
import type { OnchainRead } from "./relay-live.ts";
import type { RhjSnapshot } from "./rhj.ts";
import { CHIP_TICKERS, FEATURED_TICKERS } from "./chain.ts";
import {
  SNAPSHOT,
  snapshotLastMoves,
  snapshotMultipliers,
  snapshotQuotes,
  snapshotRhj,
  snapshotTape,
} from "./snapshot.ts";
import type { CorporateAction, Tape, WireRead } from "./types.ts";
import { emptyEntry, type WindowsDelta, type WindowsIndex } from "./windows.ts";

const NOW = Date.parse("2026-09-04T12:00:00Z");
const WAD = 10n ** 18n;
const ADDR = "0x1111111111111111111111111111111111111111" as const;
const TAPE: Tape = { chainId: 4663, block: 1, absent: false, reason: null };
const TAPE_ABSENT: Tape = {
  chainId: null,
  block: null,
  absent: true,
  reason: "RPC did not answer.",
};
const DUE_COPY = "Process date passed. No multiplier move read yet.";
// Spelled with character classes so the repo's banned-word grep over src stays empty; the assertion is real.
const BANNED = /has not m[o]ved|un[p]aid/i;
const sec = (iso: string) => Math.floor(Date.parse(iso) / 1000);

function action(over: Partial<CorporateAction> = {}): CorporateAction {
  return {
    id: "a1",
    ticker: "TEST",
    type: "CORPORATE_ACTION_TYPE_CASH_DIVIDEND",
    status: "in_progress",
    processDate: { year: 2026, month: 9, day: 10 },
    terminusIso: "2026-09-10T13:30:00.000Z",
    rate: "1.64",
    oldRate: null,
    newRate: null,
    ...over,
  };
}

function sources(input: {
  pendingMultiplier?: string | null;
  pendingEffectiveIso?: string | null;
  read?: Partial<OnchainRead>;
  actions?: CorporateAction[];
  tape?: Tape;
  /** What the last-move reader answers; an empty map when omitted. */
  lastMoves?: Map<string, LastMoveRead>;
  /** Sees every address the desk asks the last-move reader for. */
  onLastMoves?: (
    addresses: `0x${string}`[],
    window: { fromBlock: number; toBlock: number },
  ) => void;
}): Sources {
  const rhj: RhjSnapshot = {
    assets: [
      {
        ticker: "TEST",
        name: "Test Co",
        address: ADDR,
        currentMultiplier: "1",
        pendingMultiplier: input.pendingMultiplier ?? null,
        pendingEffectiveIso: input.pendingEffectiveIso ?? null,
      },
    ],
    actions: input.actions ?? [],
    absent: false,
    actionsAbsent: false,
    readAt: new Date(NOW).toISOString(),
    stale: false,
  };
  const iso = new Date(NOW).toISOString();
  return {
    rhj,
    tape: input.tape ?? TAPE,
    now: NOW,
    fetchedAt: iso,
    source: "live",
    readAt: iso,
    absent: null,
    onchain: async () =>
      new Map<string, OnchainRead>([
        [
          ADDR,
          {
            address: ADDR,
            live: WAD,
            staged: null,
            effectiveAtSec: null,
            paused: false,
            transferPaused: null,
            ...input.read,
          },
        ],
      ]),
    quotes: async () => new Map(),
    lastMoves: async (addresses, window) => {
      input.onLastMoves?.(addresses, window);
      return input.lastMoves ?? new Map();
    },
    wire: async () => new Map(),
    wireStatus: async () => ({ count: null, posterBalanceWei: null }),
    windows: async () => null,
    pass: async () => null,
  };
}

async function rowOf(s: Sources) {
  const desk = await buildFromSources(s);
  const row = desk.rows.find((r) => r.ticker === "TEST");
  assert.ok(row, "TEST row missing");
  return row;
}

describe("buildFromSources · terminusSource", () => {
  it("is issuer when the feed publishes pendingMultiplierEffectiveTime", async () => {
    const row = await rowOf(
      sources({
        pendingMultiplier: "2",
        pendingEffectiveIso: "2026-09-08T14:00:00.000Z",
        read: { staged: 2n * WAD, effectiveAtSec: sec("2026-09-09T13:30:00Z") },
        actions: [action()],
      }),
    );
    assert.equal(row.terminusSource, "issuer");
    assert.equal(row.effectiveAtIso, "2026-09-08T14:00:00.000Z");
    assert.equal(row.state, "veiled");
  });

  it("is chain when only the contract's future effectiveAt is known", async () => {
    const at = sec("2026-09-09T13:30:00Z");
    const row = await rowOf(
      sources({ read: { staged: 2n * WAD, effectiveAtSec: at }, actions: [action()] }),
    );
    assert.equal(row.terminusSource, "chain");
    assert.equal(row.effectiveAtIso, new Date(at * 1000).toISOString());
  });

  it("is assumed when the terminus is the issuer's process date at 09:30 ET", async () => {
    const row = await rowOf(sources({ actions: [action()] }));
    assert.equal(row.terminusSource, "assumed");
    assert.equal(row.effectiveAtIso, "2026-09-10T13:30:00.000Z");
    assert.equal(row.state, "veiled");
  });

  it("is null with nothing staged and no in-progress action", async () => {
    const row = await rowOf(sources({}));
    assert.equal(row.terminusSource, null);
    assert.equal(row.effectiveAtIso, null);
    assert.equal(row.state, "open");
  });

  it("prints the due copy once the assumed terminus has passed with no move read", async () => {
    const row = await rowOf(
      sources({
        actions: [
          action({
            processDate: { year: 2026, month: 9, day: 3 },
            terminusIso: "2026-09-03T13:30:00.000Z",
          }),
        ],
      }),
    );
    assert.equal(row.state, "due");
    assert.equal(row.terminusSource, "assumed");
    assert.equal(row.emptyCopy, DUE_COPY);
  });
});

describe("buildFromSources · past chain effectiveAt", () => {
  it("is due, sourced from the chain, when the contract's terminus passed and its staged figure still differs", async () => {
    const at = sec("2026-09-03T15:10:00Z");
    const row = await rowOf(sources({ read: { staged: 2n * WAD, effectiveAtSec: at } }));
    assert.equal(row.state, "due");
    assert.equal(row.terminusSource, "chain");
    assert.equal(row.effectiveAtIso, "2026-09-03T15:10:00.000Z");
    assert.equal(formatMultiplier(row.staged), "2×");
    assert.equal(row.emptyCopy, DUE_COPY);
  });

  it("ignores a past effectiveAt left behind by a previous move (staged equals live)", async () => {
    // The AAPL shape in the committed snapshot: at is set, newUIMultiplier == uiMultiplier.
    const row = await rowOf(
      sources({ read: { staged: WAD, effectiveAtSec: sec("2026-08-14T15:12:46Z") } }),
    );
    assert.equal(row.state, "open");
    assert.equal(row.terminusSource, null);
    assert.equal(row.effectiveAtIso, null);
    assert.equal(row.stagedOnchain, null);
  });

  it("does not pin an issuer pending figure to a previous move's past chain time", async () => {
    const row = await rowOf(
      sources({
        pendingMultiplier: "2",
        read: { staged: WAD, effectiveAtSec: sec("2026-08-14T15:12:46Z") },
      }),
    );
    assert.equal(row.state, "veiled");
    assert.equal(row.terminusSource, null);
    assert.equal(row.effectiveAtIso, null);
    assert.match(row.emptyCopy, /^TEST veiled until terminus\. Live 1×\. Staged 2×\./);
  });

  it("falls back to the issuer's assumed process date when the chain has staged but no time", async () => {
    const row = await rowOf(
      sources({
        read: { staged: 2n * WAD, effectiveAtSec: null },
        actions: [
          action({
            processDate: { year: 2026, month: 9, day: 3 },
            terminusIso: "2026-09-03T13:30:00.000Z",
          }),
        ],
      }),
    );
    assert.equal(row.state, "due");
    assert.equal(row.terminusSource, "assumed");
    assert.equal(row.effectiveAtIso, "2026-09-03T13:30:00.000Z");
    assert.equal(formatMultiplier(row.staged), "2×");
  });
});

describe("buildFromSources · oracle", () => {
  it("is live when oraclePaused() read false", async () => {
    const row = await rowOf(sources({ read: { paused: false } }));
    assert.equal(row.oracle, "live");
    assert.equal(row.state, "open");
  });

  it("is paused when oraclePaused() read true, and the state follows", async () => {
    const row = await rowOf(sources({ read: { paused: true }, actions: [action()] }));
    assert.equal(row.oracle, "paused");
    assert.equal(row.state, "paused");
    assert.equal(row.emptyCopy, "Oracle paused. Will not guess a price.");
  });

  it("is unread when the pause flag was not read even though the multiplier was", async () => {
    const row = await rowOf(sources({ read: { paused: null } }));
    assert.equal(row.onchain, true);
    assert.equal(row.oracle, "unread");
    assert.equal(row.state, "open");
  });

  it("is unread when nothing was read for the address while the tape is present", async () => {
    const s = sources({});
    s.onchain = async () => new Map();
    const row = await rowOf(s);
    assert.equal(row.onchain, false);
    assert.equal(row.oracle, "unread");
  });

  it("is absent when the tape is absent", async () => {
    const row = await rowOf(sources({ tape: TAPE_ABSENT }));
    assert.equal(row.oracle, "absent");
    assert.equal(row.state, "open");
  });
});

describe("buildFromSources · transfer pause", () => {
  it("carries the token's paused() read onto the row", async () => {
    const row = await rowOf(sources({ read: { transferPaused: true } }));
    assert.equal(row.transferPaused, true);
    const open = await rowOf(sources({ read: { transferPaused: false } }));
    assert.equal(open.transferPaused, false);
  });

  it("is null when the call did not decode", async () => {
    const row = await rowOf(sources({ read: { transferPaused: null } }));
    assert.equal(row.transferPaused, null);
  });
});

describe("buildFromSources · contract reads unavailable", () => {
  it("is true on a live build when the tape and feed answered but nothing in the batch decoded", async () => {
    const s = sources({});
    s.onchain = async () => new Map();
    const desk = await buildFromSources(s);
    assert.equal(desk.contractReadsUnavailable, true);
  });

  it("is false once at least one address in the batch decoded", async () => {
    const desk = await buildFromSources(sources({}));
    assert.equal(desk.contractReadsUnavailable, false);
  });

  it("is false when the tape is absent — that failure is already its own signal", async () => {
    const s = sources({ tape: TAPE_ABSENT });
    s.onchain = async () => new Map();
    const desk = await buildFromSources(s);
    assert.equal(desk.contractReadsUnavailable, false);
  });

  it("is false for a snapshot build even when the batch is empty", async () => {
    const s = sources({});
    s.source = "snapshot";
    s.onchain = async () => new Map();
    const desk = await buildFromSources(s);
    assert.equal(desk.contractReadsUnavailable, false);
  });
});

describe("buildRow · oracle matrix", () => {
  const base = {
    ticker: "TEST",
    name: null,
    address: ADDR,
    live: "1000000000000000000",
    liveApi: "1",
    liveOnchain: "1000000000000000000",
    staged: null,
    stagedApi: null,
    stagedOnchain: null,
    effectiveAtIso: null,
    effectiveAtSource: null,
    effectiveAtOnchainSec: null,
    action: null,
    tapeAbsent: false,
    paused: null as boolean | null,
    transferPaused: null as boolean | null,
    onchain: true,
    now: NOW,
  };
  it("maps true/false/null onto paused/live/unread and absent", () => {
    assert.equal(buildRow({ ...base, paused: true }).oracle, "paused");
    assert.equal(buildRow({ ...base, paused: false }).oracle, "live");
    assert.equal(buildRow({ ...base, paused: null }).oracle, "unread");
    assert.equal(
      buildRow({ ...base, paused: null, onchain: false, liveOnchain: null }).oracle,
      "unread",
    );
    assert.equal(
      buildRow({ ...base, paused: null, onchain: false, liveOnchain: null, tapeAbsent: true })
        .oracle,
      "absent",
    );
  });
  it("pauses the state only on a true read", () => {
    assert.equal(buildRow({ ...base, paused: true }).state, "paused");
    assert.equal(buildRow({ ...base, paused: null }).state, "open");
  });
});

describe("buildFromSources · staged figures", () => {
  it("prints a sub-1× wei reading from the contract as 0.05×", async () => {
    const row = await rowOf(sources({ read: { live: 5n * 10n ** 16n } }));
    assert.equal(formatMultiplier(row.live), "0.05×");
    assert.equal(formatMultiplier(row.liveOnchain), "0.05×");
    assert.equal(row.state, "open");
  });

  it("stages a sub-1× wei figure from the contract", async () => {
    const row = await rowOf(
      sources({ read: { staged: 5n * 10n ** 16n, effectiveAtSec: sec("2026-09-09T13:30:00Z") } }),
    );
    assert.equal(formatMultiplier(row.staged), "0.05×");
    assert.equal(formatMultiplier(row.stagedOnchain), "0.05×");
    assert.equal(row.state, "veiled");
    assert.equal(row.terminusSource, "chain");
  });

  it("flags stagedDisagree and keeps both figures when issuer and chain stage different values", async () => {
    const row = await rowOf(
      sources({
        pendingMultiplier: "2",
        read: { staged: 3n * WAD, effectiveAtSec: sec("2026-09-09T13:30:00Z") },
      }),
    );
    assert.equal(row.stagedDisagree, true);
    assert.equal(formatMultiplier(row.stagedApi), "2×");
    assert.equal(formatMultiplier(row.stagedOnchain), "3×");
    assert.equal(formatMultiplier(row.staged), "2×");
    assert.equal(row.state, "veiled");
  });

  it("does not flag a disagreement when the two sources agree across forms", async () => {
    const row = await rowOf(
      sources({
        pendingMultiplier: "2.0",
        read: { staged: 2n * WAD, effectiveAtSec: sec("2026-09-09T13:30:00Z") },
      }),
    );
    assert.equal(row.stagedDisagree, false);
    assert.equal(formatMultiplier(row.stagedApi), "2×");
    assert.equal(formatMultiplier(row.stagedOnchain), "2×");
  });

  it("does not flag a disagreement when only one source has a staged figure", async () => {
    const issuerOnly = await rowOf(sources({ pendingMultiplier: "2" }));
    assert.equal(issuerOnly.stagedDisagree, false);
    assert.equal(issuerOnly.stagedOnchain, null);
    const chainOnly = await rowOf(sources({ read: { staged: 2n * WAD } }));
    assert.equal(chainOnly.stagedDisagree, false);
    assert.equal(chainOnly.stagedApi, null);
  });

  it("treats an issuer pending equal to live as no issuer figure", async () => {
    const row = await rowOf(sources({ pendingMultiplier: "1.0", read: { staged: 2n * WAD } }));
    assert.equal(row.stagedApi, null);
    assert.equal(row.stagedDisagree, false);
    assert.equal(formatMultiplier(row.staged), "2×");
  });
});

describe("buildFromSources · issuer feed state", () => {
  it("carries the feed's read time and staleness onto the payload", async () => {
    const s = sources({});
    s.rhj = { ...s.rhj, readAt: "2026-09-04T11:00:00.000Z", stale: true };
    const desk = await buildFromSources(s);
    assert.equal(desk.feedReadAt, "2026-09-04T11:00:00.000Z");
    assert.equal(desk.feedStale, true);
    assert.equal(desk.assetsAbsent, false);
    assert.equal(desk.actionsAbsent, false);
  });
  it("reports actions absent separately from assets", async () => {
    const s = sources({});
    s.rhj = { ...s.rhj, actionsAbsent: true };
    const desk = await buildFromSources(s);
    assert.equal(desk.assetsAbsent, false);
    assert.equal(desk.actionsAbsent, true);
  });
});

describe("buildFromSources · last move", () => {
  const DUE_ACTION = action({
    processDate: { year: 2026, month: 9, day: 3 },
    terminusIso: "2026-09-03T13:30:00.000Z",
  });
  // The UPS shape read on 2026-09-04: staged 11:00 ET, effective 11:12 ET, the day after the process date.
  const AFTER: LastMoveRead = {
    oldWad: WAD,
    newWad: 1002208000000000000n,
    effectiveAtSec: sec("2026-09-03T15:12:46Z"),
    blockNumber: 54_332_416,
    blockTimeSec: sec("2026-09-03T15:03:06Z"),
  };
  // The fixture log: a move from a year before the process date.
  const BEFORE: LastMoveRead = {
    ...AFTER,
    effectiveAtSec: 1757000000,
    blockTimeSec: 1756999400,
    blockNumber: 0x33d0c00,
  };
  const TAPE_AT = { ...TAPE, block: 54_600_000 };

  it("prints the moved line when the last move landed after the process date", async () => {
    const row = await rowOf(
      sources({
        actions: [DUE_ACTION],
        tape: TAPE_AT,
        lastMoves: new Map([[ADDR.toLowerCase(), AFTER]]),
      }),
    );
    assert.equal(row.state, "due");
    assert.deepEqual(row.lastMove, {
      old: "1000000000000000000",
      new: "1002208000000000000",
      effectiveAtIso: "2026-09-03T15:12:46.000Z",
      atIso: "2026-09-03T15:03:06.000Z",
      block: 54_332_416,
    });
    assert.equal(
      row.emptyCopy,
      "Multiplier moved Thu 03 Sep, 11:12 ET, 1× → 1.002208×. Issuer still lists the action.",
    );
    assert.deepEqual(coveringCaption(row, NOW), { k: "Multiplier moved", v: "1× → 1.002208×" });
    assert.deepEqual(moveAfterTerminus(row, NOW), {
      when: "2026-09-03T15:12:46.000Z",
      old: "1000000000000000000",
      new: "1002208000000000000",
    });
  });

  it("stays due with the no-move copy when the last move predates the process date", async () => {
    const row = await rowOf(
      sources({
        actions: [DUE_ACTION],
        tape: TAPE_AT,
        lastMoves: new Map([[ADDR.toLowerCase(), BEFORE]]),
      }),
    );
    assert.equal(row.state, "due");
    assert.equal(row.lastMove?.effectiveAtIso, "2025-09-04T15:33:20.000Z");
    assert.equal(row.lastMove?.block, 54_332_416);
    assert.equal(row.emptyCopy, DUE_COPY);
    assert.deepEqual(coveringCaption(row, NOW), { k: "Process date passed", v: "no move read" });
    assert.equal(moveAfterTerminus(row, NOW), null);
  });

  it("does not call a move that takes effect after the clock", async () => {
    const ahead: LastMoveRead = {
      ...AFTER,
      effectiveAtSec: sec("2026-09-04T15:10:26Z"),
      blockTimeSec: sec("2026-09-04T15:00:41Z"),
    };
    const row = await rowOf(
      sources({
        actions: [DUE_ACTION],
        tape: TAPE_AT,
        lastMoves: new Map([[ADDR.toLowerCase(), ahead]]),
      }),
    );
    assert.equal(row.state, "due");
    assert.equal(row.lastMove?.effectiveAtIso, "2026-09-04T15:10:26.000Z");
    assert.equal(row.emptyCopy, DUE_COPY);
  });

  it("is null when no log was read, and the copy is unchanged", async () => {
    const row = await rowOf(sources({ actions: [DUE_ACTION], tape: TAPE_AT }));
    assert.equal(row.state, "due");
    assert.equal(row.lastMove, null);
    assert.equal(row.emptyCopy, DUE_COPY);
  });

  it("asks the reader only for due names, over a bounded window below the tape's block", async () => {
    const asked: `0x${string}`[][] = [];
    const windows: { fromBlock: number; toBlock: number }[] = [];
    const veiled = await rowOf(
      sources({
        actions: [action()],
        tape: TAPE_AT,
        onLastMoves: (a, w) => (asked.push(a), windows.push(w)),
      }),
    );
    assert.equal(veiled.state, "veiled");
    assert.equal(veiled.lastMove, null);
    assert.equal(asked.length, 0);

    const due = await rowOf(
      sources({
        actions: [DUE_ACTION],
        tape: TAPE_AT,
        onLastMoves: (a, w) => (asked.push(a), windows.push(w)),
      }),
    );
    assert.equal(due.state, "due");
    assert.deepEqual(asked, [[ADDR]]);
    assert.equal(windows[0]?.toBlock, 54_600_000);
    assert.ok(windows[0]!.fromBlock < 54_600_000 && windows[0]!.fromBlock >= 0);
  });

  it("does not read moves when the tape is absent, and survives a reader that throws", async () => {
    const asked: `0x${string}`[][] = [];
    const absent = await rowOf(
      sources({ actions: [DUE_ACTION], tape: TAPE_ABSENT, onLastMoves: (a) => asked.push(a) }),
    );
    assert.equal(absent.state, "due");
    assert.equal(absent.lastMove, null);
    assert.equal(asked.length, 0);

    const s = sources({ actions: [DUE_ACTION], tape: TAPE_AT });
    s.lastMoves = async () => {
      throw new Error("RPC did not answer.");
    };
    const row = await rowOf(s);
    assert.equal(row.state, "due");
    assert.equal(row.lastMove, null);
    assert.equal(row.emptyCopy, DUE_COPY);
  });

  it("caps the fan-out at LAST_MOVE_FAN_OUT_CAP due names, newest terminus first", async () => {
    const N = 12;
    // Day i+1 of August: strictly increasing, all well before NOW (2026-09-04).
    const isoOf = (i: number) => `2026-08-${String(i + 1).padStart(2, "0")}T13:30:00.000Z`;
    const addrOf = (i: number) => `0x${String(i + 1).padStart(40, "0")}` as `0x${string}`;
    const tickerOf = (i: number) => `DUE${i}`;

    const rhj: RhjSnapshot = {
      assets: Array.from({ length: N }, (_, i) => ({
        ticker: tickerOf(i),
        name: null,
        address: addrOf(i),
        currentMultiplier: null,
        pendingMultiplier: null,
        pendingEffectiveIso: null,
      })),
      actions: Array.from({ length: N }, (_, i) =>
        action({
          id: `due-${i}`,
          ticker: tickerOf(i),
          processDate: { year: 2026, month: 8, day: i + 1 },
          terminusIso: isoOf(i),
        }),
      ),
      absent: false,
      actionsAbsent: false,
      readAt: new Date(NOW).toISOString(),
      stale: false,
    };

    const asked: `0x${string}`[][] = [];
    const iso = new Date(NOW).toISOString();
    const s: Sources = {
      rhj,
      tape: TAPE_AT,
      now: NOW,
      fetchedAt: iso,
      source: "live",
      readAt: iso,
      absent: null,
      onchain: async () => new Map(),
      quotes: async () => new Map(),
      lastMoves: async (addresses) => {
        asked.push(addresses);
        return new Map();
      },
      wire: async () => new Map(),
      wireStatus: async () => ({ count: null, posterBalanceWei: null }),
      windows: async () => null,
      pass: async () => null,
    };

    const desk = await buildFromSources(s);
    const due = desk.rows.filter((r) => r.ticker.startsWith("DUE"));
    assert.equal(due.length, N);
    for (const r of due) assert.equal(r.state, "due", r.ticker);

    assert.equal(asked.length, 1, "expected a single lastMoves call");
    assert.equal(asked[0]?.length, 10, "expected the fan-out capped to 10 addresses");
    // Newest terminus first: day 12 down through day 3; days 1 and 2 are left off.
    const expected = Array.from({ length: 10 }, (_, k) => addrOf(N - 1 - k));
    assert.deepEqual(asked[0], expected);
  });
});

/** The committed snapshot as `refreshDesk` builds it; shared with the wire suite below. */
const snapshot: Sources = {
  rhj: snapshotRhj(),
  tape: snapshotTape(),
  now: Date.parse(SNAPSHOT.readAt),
  fetchedAt: SNAPSHOT.readAt,
  source: "snapshot",
  readAt: SNAPSHOT.readAt,
  absent: "forced",
  onchain: async (addresses) => snapshotMultipliers(addresses),
  quotes: async (tickers) => snapshotQuotes(tickers),
  lastMoves: async (addresses) => snapshotLastMoves(addresses),
  wire: async () => new Map(),
  wireStatus: async () => ({ count: null, posterBalanceWei: null }),
  windows: async () => null,
  pass: async () => null,
};

describe("buildFromSources · committed snapshot", () => {
  it("carries terminusSource on every row; assumed wherever the process date is the terminus", async () => {
    const desk = await buildFromSources(snapshot);
    assert.ok(desk.rows.length > 0);
    for (const r of desk.rows) {
      assert.ok("terminusSource" in r, `${r.ticker} lacks terminusSource`);
      if (!r.effectiveAtIso) assert.equal(r.terminusSource, null, r.ticker);
      else if (r.action && !r.staged) assert.equal(r.terminusSource, "assumed", r.ticker);
    }
  });

  it("prints the due copy on every due name and never the banned due/cash words", async () => {
    const desk = await buildFromSources(snapshot);
    for (const r of desk.rows) {
      assert.doesNotMatch(r.emptyCopy, BANNED, `${r.ticker}: ${r.emptyCopy}`);
    }
    const due = desk.rows.filter((r) => r.state === "due");
    if (due.length === 0) return;
    for (const r of due) {
      const moved = moveAfterTerminus(r, desk.clockMs);
      if (moved) {
        assert.match(
          r.emptyCopy,
          /^Multiplier moved [A-Z][a-z]{2} \d\d [A-Z][a-z]{2}, \d\d:\d\d ET, .+ → .+\. Issuer still lists the action\.$/,
          r.ticker,
        );
      } else {
        assert.equal(r.emptyCopy, DUE_COPY, r.ticker);
      }
    }
    // A last move is read for due names only; the moved line never prints without one.
    for (const r of desk.rows) {
      if (r.lastMove)
        assert.equal(r.state, "due", `${r.ticker} carries a last move while ${r.state}`);
      else assert.doesNotMatch(r.emptyCopy, /^Multiplier moved/, r.ticker);
    }
  });

  it("reads oracle state and staged figures as valid combinations on every row, and never prints a four-letter month", async () => {
    const desk = await buildFromSources(snapshot);
    // The desk reads the featured, chip and in-progress names on-chain; the rest are feed-only.
    const read = desk.rows.filter((r) => r.onchain);
    const onchainFloor = new Set([...FEATURED_TICKERS, ...CHIP_TICKERS]).size;
    assert.ok(
      read.length >= onchainFloor,
      `only ${read.length} rows read on-chain, expected at least ${onchainFloor}`,
    );
    for (const r of read) {
      assert.ok(
        r.oracle === "live" || r.oracle === "paused",
        `${r.ticker}: on-chain row has oracle "${r.oracle}"`,
      );
    }
    for (const r of desk.rows.filter((r) => !r.onchain)) {
      assert.ok(
        r.oracle === "unread" || r.oracle === "absent",
        `${r.ticker}: off-chain row has oracle "${r.oracle}"`,
      );
    }
    for (const r of desk.rows) {
      if (r.stagedDisagree) {
        assert.ok(r.staged !== null, `${r.ticker}: stagedDisagree but staged is null`);
        assert.ok(
          r.stagedOnchain !== null,
          `${r.ticker}: stagedDisagree but stagedOnchain is null`,
        );
        assert.ok(
          multipliersDiffer(r.staged, r.stagedOnchain),
          `${r.ticker}: stagedDisagree but staged does not differ from stagedOnchain`,
        );
      }
      assert.doesNotMatch(r.emptyCopy, /Sept\b/, `${r.ticker}: ${r.emptyCopy}`);
    }
    assert.equal(desk.feedReadAt, SNAPSHOT.readAt);
    assert.equal(desk.feedStale, false);
  });
});

describe("buildFromSources · wire", () => {
  const WIRE = "0x3333333333333333333333333333333333333333" as const;
  const POSTER = "0x4444444444444444444444444444444444444444" as const;
  const AT = sec("2026-09-09T13:30:00Z");
  const staged = () =>
    sources({ read: { staged: 2n * WAD, effectiveAtSec: AT }, actions: [action()] });

  it("is absent from the payload and the rows while the Wire is not live", async () => {
    let asked = false;
    const s = staged();
    s.house = houseFrom({ wire: { address: null, poster: null } });
    s.wire = async () => {
      asked = true;
      return new Map();
    };
    const desk = await buildFromSources(s);
    assert.equal(desk.wire, null);
    assert.equal(asked, false);
    assert.equal(desk.rows.find((r) => r.ticker === "TEST")?.wire, null);
  });

  it("asks the contract read for every asset, not only the pending and featured names", async () => {
    const s = sources({ actions: [] });
    let asked: string[] = [];
    const answer = s.onchain;
    s.onchain = async (addresses) => {
      asked = addresses;
      return answer(addresses);
    };
    const desk = await buildFromSources(s);
    assert.ok(asked.map((a) => a.toLowerCase()).includes(ADDR.toLowerCase()));
    const row = desk.rows.find((r) => r.ticker === "TEST");
    assert.equal(row?.state, "open");
    assert.notEqual(row?.liveOnchain, null, "an open name carries its contract's figure");
  });

  it("asks the Wire for an open row too: every name the desk reads gets a line", async () => {
    const s = sources({ actions: [] });
    s.house = houseFrom({ wire: { address: WIRE, poster: POSTER } });
    let asked: string[] = [];
    s.wire = async (tickers) => {
      asked = tickers;
      return new Map<string, WireRead | null>([["TEST", null]]);
    };
    const desk = await buildFromSources(s);
    const row = desk.rows.find((r) => r.ticker === "TEST");
    assert.equal(row?.state, "open");
    const withAddress = desk.rows.filter((r) => r.address !== null).map((r) => r.ticker);
    assert.ok(withAddress.length > 1, "the fixture carries the featured names too");
    assert.deepEqual([...asked].sort(), [...withAddress].sort());
    assert.equal(row?.wireRead, true);
    assert.equal(row?.wire, null);
  });

  it("reads the poster's latest for every row with an address and reports the poster's count and balance", async () => {
    const s = staged();
    s.house = houseFrom({ wire: { address: WIRE, poster: POSTER } });
    let asked: string[] = [];
    s.wire = async (tickers) => {
      asked = tickers;
      return new Map<string, WireRead | null>([
        [
          "TEST",
          { staged: (2n * WAD).toString(), terminus: AT, postedAt: sec("2026-09-05T12:00:00Z") },
        ],
      ]);
    };
    s.wireStatus = async () => ({ count: 7, posterBalanceWei: "1000" });
    const desk = await buildFromSources(s);
    assert.ok(asked.includes("TEST"));
    assert.equal(asked.length, desk.rows.filter((r) => r.address !== null).length);
    const row = desk.rows.find((r) => r.ticker === "TEST");
    assert.equal(row?.wire?.staged, (2n * WAD).toString());
    assert.equal(row?.effectiveAtOnchainSec, AT);
    assert.deepEqual(desk.wire, {
      address: WIRE,
      poster: POSTER,
      count: 7,
      posterBalanceWei: "1000",
    });
  });

  it("keeps the payload's facts and nulls the counts when the tape is absent", async () => {
    const s = sources({ tape: TAPE_ABSENT, actions: [action()] });
    s.house = houseFrom({ wire: { address: WIRE, poster: POSTER } });
    let asked = false;
    s.wire = async () => {
      asked = true;
      return new Map();
    };
    const desk = await buildFromSources(s);
    assert.equal(asked, false);
    assert.deepEqual(desk.wire, {
      address: WIRE,
      poster: POSTER,
      count: null,
      posterBalanceWei: null,
    });
  });

  it("a failing Wire read leaves the rows null and unread, and the counts null", async () => {
    const s = staged();
    s.house = houseFrom({ wire: { address: WIRE, poster: POSTER } });
    s.wire = async () => {
      throw new Error("RPC did not answer.");
    };
    const desk = await buildFromSources(s);
    const row = desk.rows.find((r) => r.ticker === "TEST");
    assert.equal(row?.wire, null);
    assert.equal(row?.wireRead, false);
    assert.equal(desk.wire?.count, null);
  });

  it("an empty map from the reader leaves the row unread; a key with null is a read", async () => {
    const unread = staged();
    unread.house = houseFrom({ wire: { address: WIRE, poster: POSTER } });
    unread.wire = async () => new Map<string, WireRead | null>();
    const a = await buildFromSources(unread);
    const rowA = a.rows.find((r) => r.ticker === "TEST");
    assert.equal(rowA?.wire, null);
    assert.equal(rowA?.wireRead, false);

    const posted = staged();
    posted.house = houseFrom({ wire: { address: WIRE, poster: POSTER } });
    posted.wire = async () => new Map<string, WireRead | null>([["TEST", null]]);
    const b = await buildFromSources(posted);
    const rowB = b.rows.find((r) => r.ticker === "TEST");
    assert.equal(rowB?.wire, null);
    assert.equal(rowB?.wireRead, true);
  });

  it("keeps a good posts read when the count read fails, and the other way round", async () => {
    const s = staged();
    s.house = houseFrom({ wire: { address: WIRE, poster: POSTER } });
    const post = {
      staged: (2n * WAD).toString(),
      terminus: AT,
      postedAt: sec("2026-09-05T12:00:00Z"),
    };
    s.wire = async () => new Map<string, WireRead | null>([["TEST", post]]);
    s.wireStatus = async () => {
      throw new Error("RPC did not answer.");
    };
    const kept = await buildFromSources(s);
    const row = kept.rows.find((r) => r.ticker === "TEST");
    assert.deepEqual(row?.wire, post);
    assert.equal(row?.wireRead, true);
    assert.equal(kept.wire?.count, null);
    assert.equal(kept.wire?.posterBalanceWei, null);

    const other = staged();
    other.house = houseFrom({ wire: { address: WIRE, poster: POSTER } });
    other.wire = async () => {
      throw new Error("RPC did not answer.");
    };
    other.wireStatus = async () => ({ count: 7, posterBalanceWei: "1000" });
    const counted = await buildFromSources(other);
    assert.equal(counted.rows.find((r) => r.ticker === "TEST")?.wireRead, false);
    assert.equal(counted.wire?.count, 7);
  });

  it("a row the read never reached — snapshot build, tape absent — stays unread", async () => {
    const desk = await buildFromSources({
      ...snapshot,
      house: houseFrom({ wire: { address: WIRE, poster: POSTER } }),
    });
    assert.ok(desk.rows.length > 0);
    for (const r of desk.rows) assert.equal(r.wireRead, false, r.ticker);

    const s = sources({ tape: TAPE_ABSENT, actions: [action()] });
    s.house = houseFrom({ wire: { address: WIRE, poster: POSTER } });
    s.wire = async () => new Map<string, WireRead | null>([["TEST", null]]);
    const absent = await buildFromSources(s);
    assert.equal(absent.rows.find((r) => r.ticker === "TEST")?.wireRead, false);
  });
});

describe("buildFromSources · windows", () => {
  const AT = sec("2026-09-09T13:30:00Z");
  const index: WindowsIndex = {
    readAt: "2026-09-06T10:00:00.000Z",
    toBlock: 50,
    byAddress: {
      [ADDR.toLowerCase()]: { ...emptyEntry(), ponsTotal: 2, v4: { pons: 1, plain: 0, other: 0 } },
    },
  };

  it("attaches the index alone to veiled and due rows when the delta is null, and nothing to open rows", async () => {
    const s = sources({
      read: { staged: 2n * WAD, effectiveAtSec: AT },
      actions: [action()],
      tape: { ...TAPE, block: 60 },
    });
    s.windowsIndex = index;
    const desk = await buildFromSources(s);
    const row = desk.rows.find((r) => r.ticker === "TEST");
    assert.equal(row?.windows?.source, "index");
    assert.equal(row?.windows?.ponsTotal, 2);
    assert.equal(desk.rows.find((r) => r.ticker === "AAPL")?.windows, null);
  });

  it("asks the delta reader for the veiled addresses over the range past the index and merges it", async () => {
    const s = sources({
      read: { staged: 2n * WAD, effectiveAtSec: AT },
      actions: [action()],
      tape: { ...TAPE, block: 60 },
    });
    s.windowsIndex = index;
    let asked: { addresses: string[]; range: { fromBlock: number; toBlock: number } } | null = null;
    s.windows = async (addresses, range) => {
      asked = { addresses, range };
      const delta: WindowsDelta = {
        ...range,
        byAddress: {
          [ADDR.toLowerCase()]: { ...emptyEntry(), v4: { pons: 2, plain: 0, other: 0 } },
        },
      };
      return delta;
    };
    const desk = await buildFromSources(s);
    assert.deepEqual(asked, { addresses: [ADDR], range: { fromBlock: 51, toBlock: 60 } });
    const w = desk.rows.find((r) => r.ticker === "TEST")?.windows;
    assert.equal(w?.source, "index+delta");
    assert.equal(w?.v4.pons, 3);
    assert.equal(w?.toBlock, 60);
  });

  it("never asks with an empty index, a snapshot source, or the tape absent; a throwing reader falls back to the index", async () => {
    let asked = 0;
    const empty: WindowsIndex = { readAt: "", toBlock: 0, byAddress: {} };
    const s1 = sources({ read: { staged: 2n * WAD, effectiveAtSec: AT }, actions: [action()] });
    s1.windowsIndex = empty;
    s1.windows = async () => {
      asked += 1;
      return null;
    };
    await buildFromSources(s1);
    const s2 = sources({
      read: { staged: 2n * WAD, effectiveAtSec: AT },
      actions: [action()],
      tape: { ...TAPE, block: 60 },
    });
    s2.windowsIndex = index;
    s2.source = "snapshot";
    s2.windows = async () => {
      asked += 1;
      return null;
    };
    await buildFromSources(s2);
    assert.equal(asked, 0);
    const s3 = sources({
      read: { staged: 2n * WAD, effectiveAtSec: AT },
      actions: [action()],
      tape: { ...TAPE, block: 60 },
    });
    s3.windowsIndex = index;
    s3.windows = async () => {
      throw new Error("RPC did not answer.");
    };
    const desk = await buildFromSources(s3);
    assert.equal(desk.rows.find((r) => r.ticker === "TEST")?.windows?.source, "index");
  });
});

describe("buildFromSources · pass", () => {
  const PASS = "0x5555555555555555555555555555555555555555" as const;

  it("carries the pass read when the reader answers, else null", async () => {
    const s = sources({});
    s.house = houseFrom({ pass: { address: PASS } });
    s.pass = async () => ({
      address: PASS,
      price: "1",
      burnBps: 1,
      periodSec: 1,
      house: "0x2222222222222222222222222222222222222222",
    });
    assert.equal((await buildFromSources(s)).pass?.burnBps, 1);
    const t = sources({});
    t.house = houseFrom({ pass: { address: PASS } });
    t.pass = async () => {
      throw new Error("RPC did not answer.");
    };
    assert.equal((await buildFromSources(t)).pass, null);
  });

  it("never reads the Pass before the address is pasted", async () => {
    let called = false;
    const s = sources({});
    // Default house: pass.address is null.
    s.pass = async () => {
      called = true;
      return {
        address: PASS,
        price: "1",
        burnBps: 1,
        periodSec: 1,
        house: "0x2222222222222222222222222222222222222222",
      };
    };
    const desk = await buildFromSources(s);
    assert.equal(called, false);
    assert.equal(desk.pass, null);
  });

  it("never reads the Pass with the tape absent, even once pasted", async () => {
    let called = false;
    const s = sources({ tape: TAPE_ABSENT });
    s.house = houseFrom({ pass: { address: PASS } });
    s.pass = async () => {
      called = true;
      return {
        address: PASS,
        price: "1",
        burnBps: 1,
        periodSec: 1,
        house: "0x2222222222222222222222222222222222222222",
      };
    };
    const desk = await buildFromSources(s);
    assert.equal(called, false);
    assert.equal(desk.pass, null);
  });
});

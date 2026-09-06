import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { actionLine, emptyCopy, resolveState } from "./multiplier.ts";
import type { CorporateAction } from "./types.ts";

const NOW = Date.parse("2026-09-04T12:00:00Z");

const CASH: CorporateAction = {
  id: "a1",
  ticker: "UPS",
  type: "CORPORATE_ACTION_TYPE_CASH_DIVIDEND",
  status: "in_progress",
  processDate: { year: 2026, month: 9, day: 3 },
  terminusIso: "2026-09-03T13:30:00.000Z",
  rate: "1.64",
  oldRate: null,
  newRate: null,
};

/** The UPS move read on 2026-09-04: staged 11:00 ET, effective 11:10 ET, the day after the 09-03 process date. */
const MOVED = {
  old: "1000000000000000000",
  new: "1002208724969205741",
  effectiveAtIso: "2026-09-04T15:10:26.000Z",
  atIso: "2026-09-04T15:00:41.000Z",
  block: 54355503,
};

describe("emptyCopy", () => {
  it("due means the process date passed and no move was read", () => {
    const copy = emptyCopy({
      ticker: "UPS",
      state: "due",
      live: "1002208724969205741",
      staged: null,
      action: CASH,
      effectiveAtIso: CASH.terminusIso,
      lastMove: null,
    });
    assert.equal(copy, "Process date passed. No multiplier move read yet.");
  });
  it("due with a move read after the process date says when the multiplier moved", () => {
    const copy = emptyCopy(
      {
        ticker: "UPS",
        state: "due",
        live: "1002208724969205741",
        staged: null,
        action: CASH,
        effectiveAtIso: CASH.terminusIso,
        lastMove: MOVED,
      },
      Date.parse("2026-09-04T22:00:00Z"),
    );
    assert.equal(
      copy,
      "Multiplier moved Fri 04 Sep, 11:10 ET, 1× → 1.002208×. Issuer still lists the action.",
    );
  });
  it("due with a move read before the process date keeps the no-move copy", () => {
    const copy = emptyCopy(
      {
        ticker: "UPS",
        state: "due",
        live: "1002208724969205741",
        staged: null,
        action: CASH,
        effectiveAtIso: CASH.terminusIso,
        lastMove: {
          ...MOVED,
          effectiveAtIso: "2025-09-04T15:33:20.000Z",
          atIso: "2025-09-04T15:23:20.000Z",
        },
      },
      Date.parse("2026-09-04T22:00:00Z"),
    );
    assert.equal(copy, "Process date passed. No multiplier move read yet.");
  });
  it("does not call a move that takes effect after the clock, and uses the block time when no effective time was read", () => {
    const row = {
      ticker: "UPS",
      state: "due" as const,
      live: "1002208724969205741",
      staged: null,
      action: CASH,
      effectiveAtIso: CASH.terminusIso,
    };
    assert.equal(
      emptyCopy({ ...row, lastMove: MOVED }, NOW),
      "Process date passed. No multiplier move read yet.",
    );
    assert.equal(
      emptyCopy(
        { ...row, lastMove: { ...MOVED, effectiveAtIso: null } },
        Date.parse("2026-09-04T22:00:00Z"),
      ),
      "Multiplier moved Fri 04 Sep, 11:00 ET, 1× → 1.002208×. Issuer still lists the action.",
    );
    assert.equal(
      emptyCopy(
        { ...row, lastMove: { ...MOVED, effectiveAtIso: null, atIso: null } },
        Date.parse("2026-09-04T22:00:00Z"),
      ),
      "Process date passed. No multiplier move read yet.",
    );
  });
  it("a veiled cash dividend is pending; the desk has no evidence of payment", () => {
    const copy = emptyCopy({
      ticker: "UPS",
      state: "veiled",
      live: "1000000000000000000",
      staged: null,
      action: {
        ...CASH,
        processDate: { year: 2026, month: 9, day: 10 },
        terminusIso: "2026-09-10T13:30:00.000Z",
      },
      effectiveAtIso: "2026-09-10T13:30:00.000Z",
      lastMove: null,
    });
    assert.equal(
      copy,
      "UPS veiled until Thu 10 Sep, 09:30 ET. Cash dividend $1.64 pending. Live 1×.",
    );
  });
  it("a staged figure with no terminus is veiled until terminus", () => {
    const copy = emptyCopy({
      ticker: "UPS",
      state: "veiled",
      live: "1000000000000000000",
      staged: "2.0",
      action: null,
      effectiveAtIso: null,
      lastMove: null,
    });
    assert.equal(copy, "UPS veiled until terminus. Live 1×. Staged 2×. Staged is not live.");
  });
  it("prints a sub-1× staged figure from wei", () => {
    const copy = emptyCopy({
      ticker: "UPS",
      state: "veiled",
      live: "1000000000000000000",
      staged: "50000000000000000",
      action: null,
      effectiveAtIso: "2026-09-10T13:30:00.000Z",
      lastMove: null,
    });
    assert.equal(
      copy,
      "UPS veiled until Thu 10 Sep, 09:30 ET. Live 1×. Staged 0.05×. Staged is not live.",
    );
  });
  it("actionLine says pending for cash", () => {
    assert.equal(actionLine(CASH), "Cash dividend $1.64 pending.");
    assert.equal(actionLine({ ...CASH, rate: null }), "Cash dividend pending.");
  });
});
const base = {
  now: NOW,
  live: "1000000000000000000",
  staged: null as string | null,
  effectiveAtMs: null as number | null,
  actionTerminusMs: null as number | null,
  actionInProgress: false,
  oraclePaused: false as boolean | null,
  contractAbsent: false,
};

describe("resolveState", () => {
  it("is open with nothing staged and no action", () => {
    assert.equal(resolveState(base), "open");
  });
  it("is veiled when a different multiplier is staged for the future", () => {
    assert.equal(
      resolveState({ ...base, staged: "2000000000000000000", effectiveAtMs: NOW + 3_600_000 }),
      "veiled",
    );
  });
  it("is due when the staged multiplier's effective time has passed", () => {
    assert.equal(
      resolveState({ ...base, staged: "2000000000000000000", effectiveAtMs: NOW - 60_000 }),
      "due",
    );
  });
  it("is veiled, not open, when a figure is staged and no terminus is known", () => {
    assert.equal(resolveState({ ...base, staged: "2000000000000000000" }), "veiled");
  });
  it("is due when a figure is staged with no chain time and the issuer's process date passed", () => {
    assert.equal(
      resolveState({
        ...base,
        staged: "2000000000000000000",
        actionInProgress: true,
        actionTerminusMs: NOW - 60_000,
      }),
      "due",
    );
  });
  it("treats a staged value equal to live as not staged", () => {
    assert.equal(
      resolveState({ ...base, staged: "1000000000000000000", effectiveAtMs: NOW + 3_600_000 }),
      "open",
    );
  });
  it("treats a sub-1× wei staged value as staged", () => {
    assert.equal(
      resolveState({ ...base, staged: "50000000000000000", effectiveAtMs: NOW + 3_600_000 }),
      "veiled",
    );
  });
  it("is veiled on an in-progress issuer action with terminus ahead", () => {
    assert.equal(
      resolveState({ ...base, actionInProgress: true, actionTerminusMs: NOW + 86_400_000 }),
      "veiled",
    );
  });
  it("is due on an in-progress issuer action whose terminus passed", () => {
    assert.equal(
      resolveState({ ...base, actionInProgress: true, actionTerminusMs: NOW - 86_400_000 }),
      "due",
    );
  });
  it("is veiled on an in-progress action without a terminus", () => {
    assert.equal(resolveState({ ...base, actionInProgress: true }), "veiled");
  });
  it("is paused when the oracle is paused, even with a staged figure", () => {
    assert.equal(
      resolveState({
        ...base,
        oraclePaused: true,
        staged: "2000000000000000000",
        effectiveAtMs: NOW + 1,
      }),
      "paused",
    );
  });
  it("is not paused when the pause flag was not read", () => {
    assert.equal(resolveState({ ...base, oraclePaused: null }), "open");
    assert.equal(
      resolveState({
        ...base,
        oraclePaused: null,
        staged: "2000000000000000000",
        effectiveAtMs: NOW + 1,
      }),
      "veiled",
    );
  });
  it("is absent when the contract is absent and nothing else is known", () => {
    assert.equal(resolveState({ ...base, live: null, contractAbsent: true }), "absent");
  });
});

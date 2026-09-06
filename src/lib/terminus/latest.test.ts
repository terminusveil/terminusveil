import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { latestCompleted, latestMove, type Move } from "./latest.ts";
import type { CorporateAction, TickerRow } from "./types.ts";

describe("latestMove", () => {
  const move = (over: Partial<Move>): Move => ({
    old: "1000000000000000000",
    new: "1002208724969205741",
    effectiveAtIso: "2026-09-04T15:10:26.000Z",
    atIso: "2026-09-04T15:00:41.000Z",
    block: 54355503,
    ...over,
  });
  const row = (ticker: string, lastMove: TickerRow["lastMove"]): TickerRow =>
    ({ ticker, lastMove }) as TickerRow;

  it("is null when no row carries a move", () => {
    assert.equal(latestMove([]), null);
    assert.equal(latestMove([row("UPS", null)]), null);
  });

  it("picks the newest effective time across rows, ignoring rows without a move", () => {
    const sgov = move({
      effectiveAtIso: "2026-09-01T00:00:26.000Z",
      atIso: "2026-08-31T23:50:51.000Z",
      block: 51269236,
    });
    const ups = move({});
    const best = latestMove([row("JBL", null), row("SGOV", sgov), row("UPS", ups)]);
    assert.equal(best?.ticker, "UPS");
    assert.equal(best?.move, ups);
  });

  it("falls back to block time when the event names no effective time, and to the higher block on a tie", () => {
    const a = move({ effectiveAtIso: null, atIso: "2026-09-02T00:00:00.000Z", block: 10 });
    const b = move({ effectiveAtIso: null, atIso: "2026-09-02T00:00:00.000Z", block: 11 });
    const c = move({ effectiveAtIso: null, atIso: "2026-09-01T00:00:00.000Z", block: 99 });
    assert.equal(latestMove([row("A", a), row("B", b), row("C", c)])?.ticker, "B");
  });
});

describe("latestCompleted", () => {
  const action = (over: Partial<CorporateAction>): CorporateAction => ({
    id: "x",
    ticker: "AAPL",
    type: "CORPORATE_ACTION_TYPE_CASH_DIVIDEND",
    status: "completed",
    processDate: { year: 2026, month: 8, day: 13 },
    terminusIso: "2026-08-13T13:30:00.000Z",
    rate: "0.27",
    oldRate: null,
    newRate: null,
    ...over,
  });

  it("is null when the feed lists no completed action", () => {
    assert.equal(latestCompleted([]), null);
    assert.equal(latestCompleted([action({ status: "in_progress" })]), null);
  });

  it("picks the newest terminus among completed actions only", () => {
    const older = action({ ticker: "SGOV", terminusIso: "2026-08-06T13:30:00.000Z" });
    const newer = action({ ticker: "AAPL" });
    const pending = action({
      ticker: "UPS",
      status: "in_progress",
      terminusIso: "2026-09-04T13:30:00.000Z",
    });
    assert.equal(latestCompleted([older, pending, newer])?.ticker, "AAPL");
  });

  it("dates an action by its process date when it has no terminus", () => {
    const dated = action({ ticker: "OLD", terminusIso: null, processDate: { year: 2026, month: 7, day: 1 } });
    const later = action({ ticker: "NEW", terminusIso: null, processDate: { year: 2026, month: 8, day: 20 } });
    assert.equal(latestCompleted([dated, later])?.ticker, "NEW");
  });
});

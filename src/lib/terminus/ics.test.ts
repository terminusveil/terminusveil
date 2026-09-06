import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildIcs, coveringAsAction } from "./ics.ts";
import type { CorporateAction, TickerRow } from "./types.ts";

const ACTION: CorporateAction = {
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

const row = (over: Partial<TickerRow>): TickerRow => ({
  ticker: "UPS",
  name: "United Parcel Service",
  address: null,
  live: "1002208724969205741",
  liveApi: null,
  liveOnchain: null,
  staged: null,
  stagedApi: null,
  stagedOnchain: null,
  stagedDisagree: false,
  effectiveAtIso: ACTION.terminusIso,
  terminusSource: "assumed",
  effectiveAtOnchainSec: null,
  state: "due",
  oracle: "live",
  transferPaused: null,
  action: ACTION,
  emptyCopy: "",
  lastMove: null,
  wire: null,
  wireRead: false,
  windows: null,
  onchain: true,
  priceBid: null,
  priceAsk: null,
  priceHalt: false,
  priceAt: null,
  ...over,
});

function event(ics: string): string {
  const start = ics.indexOf("BEGIN:VEVENT");
  const end = ics.indexOf("END:VEVENT");
  assert.ok(start >= 0 && end > start, "no VEVENT");
  return ics.slice(start, end);
}

describe("buildIcs", () => {
  it("marks an assumed terminus in DESCRIPTION and emits no alarm for it", () => {
    const ev = event(buildIcs([ACTION], new Map([["UPS", row({})]])));
    assert.match(ev, /DTSTART:20260903T133000Z/);
    assert.match(ev, /Terminus time assumed: process date\\, 09:30 ET\./);
    assert.doesNotMatch(ev, /BEGIN:VALARM/);
    assert.doesNotMatch(ev, /un[p]aid/i);
  });

  it("keeps the alarm and adds no suffix when the issuer published the time", () => {
    const r = row({ terminusSource: "issuer", state: "veiled", staged: "1100000000000000000" });
    const ev = event(buildIcs([ACTION], new Map([["UPS", r]])));
    assert.doesNotMatch(ev, /time assumed/);
    assert.match(ev, /BEGIN:VALARM[\s\S]*TRIGGER:PT0S[\s\S]*END:VALARM/);
  });

  it("starts at the issuer's published time, not the process date, when the row's source is issuer", () => {
    const r = row({
      terminusSource: "issuer",
      effectiveAtIso: "2026-09-08T14:00:00.000Z",
      state: "veiled",
      staged: "1100000000000000000",
    });
    const ev = event(buildIcs([ACTION], new Map([["UPS", r]])));
    assert.match(ev, /DTSTART:20260908T140000Z/);
    assert.doesNotMatch(ev, /DTSTART:20260903T133000Z/);
    assert.doesNotMatch(ev, /time assumed/);
    assert.match(ev, /BEGIN:VALARM/);
  });

  it("starts at the contract's effectiveAt when the row's source is chain", () => {
    const r = row({
      terminusSource: "chain",
      effectiveAtIso: "2026-09-09T13:30:00.000Z",
      state: "veiled",
      staged: "1100000000000000000",
    });
    const ev = event(buildIcs([ACTION], new Map([["UPS", r]])));
    assert.match(ev, /DTSTART:20260909T133000Z/);
    assert.match(ev, /BEGIN:VALARM/);
  });

  it("keeps a second action's own process date when the row belongs to another action", () => {
    const other: CorporateAction = {
      ...ACTION,
      id: "a2",
      processDate: { year: 2026, month: 9, day: 17 },
      terminusIso: "2026-09-17T13:30:00.000Z",
    };
    const r = row({
      terminusSource: "issuer",
      effectiveAtIso: "2026-09-08T14:00:00.000Z",
      state: "veiled",
    });
    const ics = buildIcs([ACTION, other], new Map([["UPS", r]]));
    const second = ics.slice(ics.lastIndexOf("BEGIN:VEVENT"));
    assert.match(second, /DTSTART:20260917T133000Z/);
    assert.match(second, /Terminus time assumed/);
    assert.doesNotMatch(second, /BEGIN:VALARM/);
  });

  it("treats a process-date action as assumed when no row is known", () => {
    const ev = event(buildIcs([ACTION]));
    assert.match(ev, /Terminus time assumed/);
    assert.doesNotMatch(ev, /BEGIN:VALARM/);
  });

  it("a covering built from a row inherits the row's assumed mark", () => {
    const r = row({ action: null, state: "veiled" });
    const covering = coveringAsAction(r);
    assert.ok(covering);
    const ev = event(buildIcs([covering], new Map([["UPS", r]])));
    assert.match(ev, /Terminus time assumed/);
    assert.doesNotMatch(ev, /BEGIN:VALARM/);
  });
});

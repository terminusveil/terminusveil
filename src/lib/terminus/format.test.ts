import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  actionFigure,
  coveringCaption,
  formatCashRate,
  formatEtDay,
  formatEth,
  formatMultiplier,
  formatReadAt,
  formatReadClock,
  formatTerminus,
  multipliersDiffer,
  parseMultiplier,
  plateTitle,
  shortAddress,
  stagedDiffers,
  stagedFact,
  terminusFromProcessDate,
} from "./format.ts";
import { dayHeading } from "./calendar.ts";
import type { CorporateAction, TickerRow } from "./types.ts";

const WAD = 10n ** 18n;

const row = (over: Partial<TickerRow>): TickerRow => ({
  ticker: "AAPL",
  name: "Apple",
  address: null,
  live: "1000000000000000000",
  liveApi: null,
  liveOnchain: null,
  staged: null,
  stagedApi: null,
  stagedOnchain: null,
  stagedDisagree: false,
  effectiveAtIso: null,
  terminusSource: null,
  effectiveAtOnchainSec: null,
  state: "open",
  oracle: "live",
  transferPaused: null,
  action: null,
  emptyCopy: "",
  lastMove: null,
  wire: null,
  wireRead: false,
  windows: null,
  onchain: false,
  priceBid: null,
  priceAsk: null,
  priceHalt: false,
  priceAt: null,
  ...over,
});

const CASH: CorporateAction = {
  id: "a1",
  ticker: "AAPL",
  type: "CORPORATE_ACTION_TYPE_CASH_DIVIDEND",
  status: "in_progress",
  processDate: { year: 2026, month: 9, day: 10 },
  terminusIso: "2026-09-10T13:30:00.000Z",
  rate: "0.26",
  oldRate: null,
  newRate: null,
};

describe("format", () => {
  it("captions an absent row as not read", () => {
    assert.deepEqual(coveringCaption(row({ state: "absent", oracle: "absent" })), {
      k: "Not read",
      v: "AAPL · tape absent",
    });
  });
  it("captions a due row as process date passed, no move read", () => {
    const r = row({
      state: "due",
      action: CASH,
      effectiveAtIso: CASH.terminusIso,
      terminusSource: "assumed",
    });
    assert.deepEqual(coveringCaption(r), { k: "Process date passed", v: "no move read" });
  });
  it("captions a veiled cash dividend as a dividend, nothing more", () => {
    const r = row({
      state: "veiled",
      action: CASH,
      effectiveAtIso: CASH.terminusIso,
      terminusSource: "assumed",
    });
    assert.deepEqual(coveringCaption(r), { k: "Staged, not live", v: "AAPL · cash dividend" });
  });
  it("stagedFact names a cash dividend with its rate", () => {
    const r = row({
      state: "veiled",
      action: CASH,
      effectiveAtIso: CASH.terminusIso,
      terminusSource: "assumed",
    });
    assert.equal(stagedFact(r), "cash dividend $0.26");
    assert.equal(stagedFact(row({ ...r, action: { ...CASH, rate: null } })), "cash dividend");
    assert.equal(stagedFact(row({ ...r, state: "due" })), "cash dividend $0.26");
  });
  it("plateTitle counts down from an explicit clock", () => {
    const now = Date.parse("2026-09-04T12:00:00Z");
    const r = row({ state: "veiled", effectiveAtIso: "2026-09-04T13:30:00Z" });
    assert.equal(plateTitle(r, "x", now), "AAPL · 1× · 1h 30m");
    assert.equal(plateTitle(r, "x", Date.parse("2026-09-04T14:00:00Z")), "AAPL · 1× · due");
  });
  it("formats a read time in UTC", () => {
    assert.equal(formatReadAt("2026-09-04T12:03:07.872Z"), "Fri 04 Sep 2026 12:03 UTC");
    assert.equal(
      formatReadAt("2026-09-04T12:03:07.872Z", { seconds: true }),
      "Fri 04 Sep 2026 12:03:07 UTC",
    );
    assert.equal(formatReadClock("2026-09-04T12:03:07.872Z"), "12:03 UTC");
    assert.equal(formatReadAt("nope"), "—");
  });
});

describe("parseMultiplier / formatMultiplier", () => {
  it("reads decimal wei below 1e18 as a sub-1× multiplier (reverse split)", () => {
    assert.equal(parseMultiplier("50000000000000000"), 5n * 10n ** 16n);
    assert.equal(formatMultiplier("50000000000000000"), "0.05×");
    assert.equal(formatMultiplier("100000000000000"), "0.0001×");
  });
  it("reads hex wei", () => {
    assert.equal(formatMultiplier("0xb1a2bc2ec50000"), "0.05×");
    assert.equal(formatMultiplier("0xde0b6b3a7640000"), "1×");
    assert.equal(formatMultiplier("0x3782dace9d900000"), "4×");
  });
  it("reads decimal wei at and above 1e18", () => {
    assert.equal(formatMultiplier("1000000000000000000"), "1×");
    assert.equal(formatMultiplier("4000000000000000000"), "4×");
    assert.equal(formatMultiplier("1002208724969205741"), "1.002208×");
    assert.equal(formatMultiplier(WAD), "1×");
  });
  it("reads the issuer's whole and decimal figures", () => {
    assert.equal(formatMultiplier("1"), "1×");
    assert.equal(formatMultiplier("4"), "4×");
    assert.equal(formatMultiplier("1.0"), "1×");
    assert.equal(formatMultiplier("1.002208"), "1.002208×");
    assert.equal(formatMultiplier("1.002208724969205741"), "1.002208×");
    assert.equal(formatMultiplier("0.05"), "0.05×");
    assert.equal(parseMultiplier("1.002208724969205741"), 1002208724969205741n);
  });
  it("prints a dash for garbage", () => {
    for (const bad of ["", "  ", "abc", "0xzz", "1.2.3", "-1", "1e18", null, undefined]) {
      assert.equal(formatMultiplier(bad), "—", String(bad));
    }
    assert.equal(parseMultiplier("abc"), null);
    assert.equal(parseMultiplier("0xzz"), null);
  });
  it("multipliersDiffer agrees across the issuer, wei and hex forms", () => {
    assert.equal(multipliersDiffer("0.05", "50000000000000000"), false);
    assert.equal(multipliersDiffer("0.05", "0xb1a2bc2ec50000"), false);
    assert.equal(multipliersDiffer("1.002208724969205741", "1002208724969205741"), false);
    assert.equal(multipliersDiffer("1.0", "0xde0b6b3a7640000"), false);
    assert.equal(multipliersDiffer("4", "4000000000000000000"), false);
    assert.equal(multipliersDiffer("1.0", "2.0"), true);
    assert.equal(multipliersDiffer("1.0", "1.000000000000000001"), true);
    assert.equal(multipliersDiffer(null, "1"), false);
    assert.equal(multipliersDiffer("1", ""), false);
    assert.equal(multipliersDiffer("abc", "abd"), true);
  });
  it("stagedDiffers ignores empty, zero and same-as-live figures", () => {
    assert.equal(stagedDiffers(null, "1"), false);
    assert.equal(stagedDiffers("", "1"), false);
    assert.equal(stagedDiffers("0", "1"), false);
    assert.equal(stagedDiffers("0.0", "1"), false);
    assert.equal(stagedDiffers("0x0", "1"), false);
    assert.equal(stagedDiffers("1000000000000000000", "1.0"), false);
    assert.equal(stagedDiffers("2.0", "1"), true);
    assert.equal(stagedDiffers("2.0", null), true);
    assert.equal(stagedDiffers("50000000000000000", "1000000000000000000"), true);
  });
});

describe("ET formatter", () => {
  it("prints the three-letter month, so September is Sep", () => {
    assert.equal(formatTerminus("2026-09-04T13:30:00Z"), "Fri 04 Sep, 09:30 ET");
    assert.equal(formatEtDay("2026-09-04T13:30:00Z"), "Fri 04 Sep");
    assert.equal(dayHeading("2026-09-04T13:30:00Z"), "Fri 04 Sep");
    assert.equal(formatTerminus("2026-09-03T13:30:00.000Z"), "Thu 03 Sep, 09:30 ET");
  });
  it("rolls the date over New York midnight, not UTC midnight", () => {
    // 03:00Z on the 5th is 23:00 ET on the 4th.
    assert.equal(formatTerminus("2026-09-05T03:00:00Z"), "Fri 04 Sep, 23:00 ET");
    assert.equal(formatEtDay("2026-09-05T03:00:00Z"), "Fri 04 Sep");
    assert.equal(formatTerminus("2026-09-05T04:00:00Z"), "Sat 05 Sep, 00:00 ET");
  });
  it("holds 09:30 ET on both DST edges", () => {
    assert.equal(formatTerminus("2026-03-08T13:30:00Z"), "Sun 08 Mar, 09:30 ET");
    assert.equal(formatTerminus("2026-11-01T14:30:00Z"), "Sun 01 Nov, 09:30 ET");
  });
  it("terminusFromProcessDate is 09:30 ET with the right offset in each season", () => {
    const cases: [number, number, number, string][] = [
      [2026, 1, 15, "2026-01-15T14:30:00.000Z"],
      [2026, 3, 8, "2026-03-08T13:30:00.000Z"],
      [2026, 7, 15, "2026-07-15T13:30:00.000Z"],
      [2026, 11, 1, "2026-11-01T14:30:00.000Z"],
    ];
    for (const [year, month, day, iso] of cases) {
      const t = terminusFromProcessDate({ year, month, day });
      assert.equal(t.toISOString(), iso, `${year}-${month}-${day}`);
      assert.match(formatTerminus(t.toISOString()), /, 09:30 ET$/);
    }
  });
  it("prints a dash or Undated on bad input", () => {
    assert.equal(formatTerminus(null), "—");
    assert.equal(formatTerminus("nope"), "—");
    assert.equal(formatEtDay(null), "—");
    assert.equal(dayHeading(null), "Undated");
    assert.equal(dayHeading("nope"), "Undated");
  });
});

describe("formatCashRate", () => {
  it("prints the per-share amount in dollars, two to six decimals, nothing rounded away", () => {
    assert.equal(formatCashRate("1.34"), "$1.34");
    assert.equal(formatCashRate("0.27"), "$0.27");
    assert.equal(formatCashRate("0.306812"), "$0.306812");
    assert.equal(formatCashRate("3"), "$3.00");
  });

  it("passes through what it cannot read and dashes nothing", () => {
    assert.equal(formatCashRate(null), "—");
    assert.equal(formatCashRate(""), "—");
    assert.equal(formatCashRate("n/a"), "n/a");
  });
});

describe("actionFigure", () => {
  it("is the dollar amount for a cash dividend and null without one", () => {
    assert.equal(
      actionFigure({ type: "CORPORATE_ACTION_TYPE_CASH_DIVIDEND", rate: "1.34" }),
      "$1.34",
    );
    assert.equal(actionFigure({ type: "CORPORATE_ACTION_TYPE_CASH_DIVIDEND", rate: null }), null);
  });

  it("is old→new for a split with both rates, the bare rate otherwise, null with nothing", () => {
    assert.equal(
      actionFigure({
        type: "CORPORATE_ACTION_TYPE_FORWARD_SPLIT",
        rate: null,
        oldRate: "1",
        newRate: "4",
      }),
      "1→4",
    );
    assert.equal(
      actionFigure({ type: "CORPORATE_ACTION_TYPE_STOCK_DIVIDEND", rate: "0.05" }),
      "0.05",
    );
    assert.equal(actionFigure({ type: "CORPORATE_ACTION_TYPE_SPIN_OFF", rate: null }), null);
    assert.equal(actionFigure(null), null);
  });
});

describe("formatEth", () => {
  it("prints four decimals of ETH from decimal wei, and a dash for null", () => {
    assert.equal(formatEth("1000000000000000000"), "1.0000 ETH");
    assert.equal(formatEth("42100000000000000"), "0.0421 ETH");
    assert.equal(formatEth("0"), "0.0000 ETH");
    assert.equal(formatEth(null), "—");
    assert.equal(formatEth("-1"), "—");
  });
});

describe("shortAddress", () => {
  it("keeps the first six and last four characters", () => {
    assert.equal(shortAddress("0x1111111111111111111111111111111111111111"), "0x1111…1111");
    assert.equal(shortAddress("0xABCDEF0123456789ABCDEF0123456789ABCDEF01"), "0xABCD…EF01");
  });
});

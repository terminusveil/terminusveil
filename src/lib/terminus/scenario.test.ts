import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { biggestStagedMove } from "./scenario.ts";
import type { TickerRow } from "./types.ts";

const ONE = "1000000000000000000";

const row = (over: Partial<TickerRow>): TickerRow =>
  ({
    ticker: "JNJ",
    name: null,
    address: null,
    live: ONE,
    liveApi: null,
    liveOnchain: null,
    staged: null,
    stagedApi: null,
    stagedOnchain: null,
    stagedDisagree: false,
    effectiveAtIso: "2026-09-08T13:30:00.000Z",
    terminusSource: "assumed",
    state: "veiled",
    oracle: "live",
    action: null,
    emptyCopy: "",
    lastMove: null,
    onchain: true,
    priceBid: null,
    priceAsk: null,
    priceHalt: false,
    priceAt: null,
    ...over,
  }) as TickerRow;

describe("biggestStagedMove", () => {
  it("picks the pending row whose staged figure moves furthest from live, either direction", () => {
    const rows = [
      row({ ticker: "A", staged: "1002000000000000000" }),
      row({ ticker: "B", staged: "4000000000000000000" }),
      row({ ticker: "C", staged: "250000000000000000" }),
      row({ ticker: "D", staged: "9000000000000000000", state: "open" }),
    ];
    assert.deepEqual(biggestStagedMove(rows), {
      ticker: "B",
      from: ONE,
      to: "4000000000000000000",
      terminusIso: "2026-09-08T13:30:00.000Z",
    });
  });

  it("prefers a reverse split when it is the larger move", () => {
    const rows = [
      row({ ticker: "A", staged: "2000000000000000000" }),
      row({ ticker: "R", staged: "100000000000000000" }),
    ];
    assert.equal(biggestStagedMove(rows)?.ticker, "R");
  });

  it("is null when nothing pending stages a different figure, so the card shows its illustration", () => {
    assert.equal(biggestStagedMove([row({}), row({ ticker: "X", staged: ONE })]), null);
    assert.equal(biggestStagedMove([]), null);
  });
});

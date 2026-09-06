import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { apiRow, healthPayload, pendingPayload, pendingRows, tickerPayload } from "./api-shape.ts";
import type { TickerRow } from "./types.ts";

const row = (over: Partial<TickerRow>): TickerRow =>
  ({
    ticker: "JNJ",
    name: null,
    address: "0x1111111111111111111111111111111111111111",
    live: "1000000000000000000",
    liveApi: "1000000000000000000",
    liveOnchain: "1000000000000000000",
    staged: null,
    stagedApi: null,
    stagedOnchain: null,
    stagedDisagree: false,
    effectiveAtIso: "2026-09-08T13:30:00.000Z",
    terminusSource: "assumed",
    state: "veiled",
    oracle: "live",
    transferPaused: null,
    action: null,
    emptyCopy: "",
    lastMove: null,
    wireRead: false,
    windows: null,
    onchain: true,
    priceBid: null,
    priceAsk: null,
    priceHalt: false,
    priceAt: null,
    ...over,
  }) as TickerRow;

const tape = { chainId: 4663, block: 55180122, absent: false, reason: null };

describe("pendingRows", () => {
  it("keeps veiled and due rows only, in desk order, with the API fields", () => {
    const rows = pendingRows({
      rows: [
        row({ ticker: "AAPL", state: "open" }),
        row({ ticker: "JNJ" }),
        row({ ticker: "UPS", state: "due" }),
      ],
    });
    assert.deepEqual(
      rows.map((r) => [r.ticker, r.state]),
      [
        ["JNJ", "veiled"],
        ["UPS", "due"],
      ],
    );
    assert.deepEqual(Object.keys(rows[0] ?? {}), [
      "ticker",
      "state",
      "live",
      "liveApi",
      "liveOnchain",
      "staged",
      "stagedApi",
      "stagedOnchain",
      "disagree",
      "stagedDisagree",
      "terminusIso",
      "terminusSource",
      "oracle",
      "transferPaused",
      "lastMove",
      "address",
      "wire",
      "wireRead",
      "windows",
    ]);
    assert.equal(rows[0]?.terminusIso, "2026-09-08T13:30:00.000Z");
  });

  it("marks a row whose issuer and chain figures disagree", () => {
    const [r] = pendingRows({
      rows: [row({ liveApi: "1000000000000000000", liveOnchain: "2000000000000000000" })],
    });
    assert.equal(r?.disagree, true);
  });
});

describe("apiRow", () => {
  it("carries the row's transferPaused reading", () => {
    assert.equal(apiRow(row({ transferPaused: true })).transferPaused, true);
    assert.equal(apiRow(row({ transferPaused: false })).transferPaused, false);
    assert.equal(apiRow(row({ transferPaused: null })).transferPaused, null);
  });

  it("carries the row's wire reading", () => {
    const wire = { staged: "1000000000000000000", terminus: 1757000000, postedAt: 1756000000 };
    assert.deepEqual(apiRow(row({ wire })).wire, wire);
    assert.equal(apiRow(row({ wire: null })).wire, null);
  });

  it("carries wireRead, so a null wire is readable as unread or as nothing posted", () => {
    assert.equal(apiRow(row({ wire: null, wireRead: true })).wireRead, true);
    assert.equal(apiRow(row({ wire: null, wireRead: false })).wireRead, false);
  });

  it("carries the row's windows reading", () => {
    const windows = {
      pons: [],
      ponsTotal: 2,
      v4: { pons: 1, plain: 0, other: 0 },
      capped: false,
      toBlock: 60,
      readAt: "2026-09-06T10:00:00.000Z",
      source: "index" as const,
    };
    assert.deepEqual(apiRow(row({ windows })).windows, windows);
    assert.equal(apiRow(row({ windows: null })).windows, null);
  });
});

describe("pendingPayload", () => {
  it("carries the reading and the count with the rows", () => {
    const p = pendingPayload({
      rows: [row({}), row({ ticker: "UPS", state: "due" })],
      readAt: "2026-09-05T14:06:50.180Z",
      tape,
      source: "live",
    });
    assert.equal(p.count, 2);
    assert.equal(p.block, 55180122);
    assert.equal(p.source, "live");
    assert.equal(p.readAt, "2026-09-05T14:06:50.180Z");
  });
});

describe("tickerPayload", () => {
  it("prints any state, the explorer link and the reading", () => {
    const p = tickerPayload(
      { readAt: "2026-09-05T14:06:50.180Z", tape, source: "live" },
      row({ ticker: "AAPL", state: "open" }),
    );
    assert.equal(p.ticker, "AAPL");
    assert.equal(p.state, "open");
    assert.equal(
      p.explorer,
      "https://robinhoodchain.blockscout.com/address/0x1111111111111111111111111111111111111111",
    );
    assert.equal(p.block, 55180122);
    assert.equal(
      tickerPayload({ readAt: "x", tape, source: "live" }, row({ address: null })).explorer,
      null,
    );
  });
});

describe("healthPayload", () => {
  it("prints the build and the reading it holds, never a figure of its own", () => {
    const h = healthPayload(
      {
        tape,
        readAt: "2026-09-05T14:06:50.180Z",
        source: "snapshot",
        feedStale: false,
        assetCount: 194,
        pendingCount: 30,
        dueCount: 7,
        wire: null,
        pass: null,
      },
      { commit: "abc1234", at: "2026-09-05T14:00:00.000Z" },
    );
    assert.deepEqual(h, {
      ok: true,
      build: { commit: "abc1234", at: "2026-09-05T14:00:00.000Z" },
      chain: { id: 4663, block: 55180122, readAt: "2026-09-05T14:06:50.180Z" },
      source: "snapshot",
      feedStale: false,
      tickers: 194,
      pending: 30,
      due: 7,
      wire: null,
      pass: null,
    });
  });

  it("carries the wire's address, poster and count, never the balance", () => {
    const h = healthPayload(
      {
        tape,
        readAt: "2026-09-05T14:06:50.180Z",
        source: "live",
        feedStale: false,
        assetCount: 194,
        pendingCount: 30,
        dueCount: 7,
        wire: {
          address: "0x2222222222222222222222222222222222222222",
          poster: "0x3333333333333333333333333333333333333333",
          count: 12,
          posterBalanceWei: "1000000000000000000",
        },
        pass: null,
      },
      { commit: "abc1234", at: "2026-09-05T14:00:00.000Z" },
    );
    assert.deepEqual(h.wire, {
      address: "0x2222222222222222222222222222222222222222",
      poster: "0x3333333333333333333333333333333333333333",
      count: 12,
    });
  });

  it("carries the pass read straight through", () => {
    const passRead = {
      address: "0x5555555555555555555555555555555555555555" as const,
      price: "1",
      burnBps: 1,
      periodSec: 1,
      house: "0x2222222222222222222222222222222222222222" as const,
    };
    const h = healthPayload(
      {
        tape,
        readAt: "2026-09-05T14:06:50.180Z",
        source: "live",
        feedStale: false,
        assetCount: 194,
        pendingCount: 30,
        dueCount: 7,
        wire: null,
        pass: passRead,
      },
      { commit: "abc1234", at: "2026-09-05T14:00:00.000Z" },
    );
    assert.deepEqual(h.pass, passRead);
    const empty = healthPayload(
      {
        tape,
        readAt: "2026-09-05T14:06:50.180Z",
        source: "live",
        feedStale: false,
        assetCount: 194,
        pendingCount: 30,
        dueCount: 7,
        wire: null,
        pass: null,
      },
      { commit: "abc1234", at: "2026-09-05T14:00:00.000Z" },
    );
    assert.equal(empty.pass, null);
  });
});

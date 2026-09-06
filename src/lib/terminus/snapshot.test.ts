import { describe, it } from "node:test";
import assert from "node:assert/strict";
import multipliersJson from "../../../data/snapshot/multipliers.json" with { type: "json" };
import {
  SNAPSHOT,
  snapshotLastMoves,
  snapshotMultipliers,
  snapshotQuotes,
  snapshotRhj,
  snapshotTape,
} from "./snapshot.ts";
import { FALLBACK_ADDRESSES } from "./chain.ts";

describe("snapshot", () => {
  it("serves the committed last moves for the addresses asked, and nothing for unknown ones", () => {
    assert.equal(snapshotLastMoves(["0x0000000000000000000000000000000000000000"]).size, 0);
    assert.equal(snapshotLastMoves([]).size, 0);
    const rhj = snapshotRhj();
    const addresses = rhj.assets.map((a) => a.address).filter((a): a is `0x${string}` => a !== null);
    const moves = snapshotLastMoves(addresses);
    for (const [key, m] of moves) {
      assert.equal(key, key.toLowerCase());
      assert.equal(typeof m.oldWad, "bigint");
      assert.equal(typeof m.newWad, "bigint");
      assert.ok(m.blockNumber > 0 && m.blockNumber <= SNAPSHOT.block, `${key} block ${m.blockNumber}`);
      assert.ok(m.effectiveAtSec > 0, `${key} effectiveAt`);
      assert.ok(m.blockTimeSec === null || m.blockTimeSec > 0, `${key} blockTime`);
    }
  });
  it("carries a dated reading", () => {
    assert.ok(Number.isFinite(Date.parse(SNAPSHOT.readAt)));
    assert.equal(SNAPSHOT.chainId, 4663);
    assert.ok(SNAPSHOT.block > 0);
  });
  it("tape is present with the snapshot block", () => {
    const tape = snapshotTape();
    assert.equal(tape.absent, false);
    assert.equal(tape.chainId, 4663);
    assert.equal(tape.block, SNAPSHOT.block);
  });
  it("parses assets and actions with the committed counts", () => {
    const rhj = snapshotRhj();
    assert.equal(rhj.absent, false);
    assert.ok(rhj.assets.length >= 150, `assets ${rhj.assets.length}`);
    assert.ok(rhj.actions.length >= 30, `actions ${rhj.actions.length}`);
    assert.ok(rhj.actions.some((a) => a.status === "in_progress"));
    assert.ok(rhj.assets.every((a) => a.ticker === a.ticker.toUpperCase()));
  });
  it("decodes a live multiplier for AAPL", () => {
    const addr = FALLBACK_ADDRESSES.AAPL;
    const m = snapshotMultipliers([addr]);
    const read = m.get(addr.toLowerCase());
    assert.ok(read, "no read for AAPL");
    assert.equal(typeof read.live, "bigint");
    assert.ok(read.live! > 0n);
  });
  it("returns quotes for known tickers and skips unknown ones", () => {
    const q = snapshotQuotes(["NVDA", "NOPE"]);
    assert.ok(q.get("NVDA")?.bid);
    assert.equal(q.get("NOPE"), undefined);
  });
  it("decodes transferPaused to a boolean or null for every committed contract", () => {
    const all = snapshotMultipliers(Object.keys(multipliersJson) as `0x${string}`[]);
    for (const r of all.values()) assert.ok(r.transferPaused === null || typeof r.transferPaused === "boolean");
  });
});

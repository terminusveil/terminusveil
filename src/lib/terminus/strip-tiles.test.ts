import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stripTiles } from "./strip-tiles.ts";

const tape = { chainId: 4663, block: 54611705, absent: false, reason: null };

describe("stripTiles", () => {
  it("prints the four desk counts in order, the block linked to the explorer", () => {
    const tiles = stripTiles({ assetCount: 194, pendingCount: 30, dueCount: 7, tape });
    assert.deepEqual(
      tiles?.map((t) => [t.value, t.label, t.zero]),
      [
        ["194", "tickers", false],
        ["30", "on the clock", false],
        ["7", "due", false],
        ["54,611,705", "block", false],
      ],
    );
    assert.equal(tiles?.[3]?.href, "https://robinhoodchain.blockscout.com/block/54611705");
    assert.equal(tiles?.[0]?.href, null);
  });

  it("prints zero as zero and marks it, and dashes a missing block without a link", () => {
    const tiles = stripTiles({ assetCount: 3, pendingCount: 0, dueCount: 0, tape: { ...tape, block: null } });
    assert.equal(tiles?.[1]?.value, "0");
    assert.equal(tiles?.[1]?.zero, true);
    assert.equal(tiles?.[2]?.value, "0");
    assert.equal(tiles?.[2]?.zero, true);
    assert.equal(tiles?.[3]?.value, "—");
    assert.equal(tiles?.[3]?.href, null);
  });

  it("is null when no ticker was read, so the strip falls back to its sentence", () => {
    assert.equal(stripTiles({ assetCount: 0, pendingCount: 0, dueCount: 0, tape }), null);
  });
});

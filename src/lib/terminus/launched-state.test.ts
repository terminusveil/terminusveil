import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { houseFrom, houseLaunched, wireLive } from "./house.ts";
import { PROOF_LIVE, houseCards } from "./house-cards.ts";
import { launchSteps, verifyRows } from "./launch-steps.ts";

/**
 * The end state of every paste: the five creation facts, the pool link, the
 * Wire and the Pass. On that house nothing on the site may still say a thing
 * is ahead — the pre-launch words are the ones `launch-literals.test.ts`
 * guards in the .tsx files, and these are the same words as the data the
 * pages render from. A simulation, not a deploy: `HOUSE` itself is untouched.
 */
const LAUNCHED = houseFrom({
  address: "0x1111111111111111111111111111111111111111",
  feeWallet: "0x2222222222222222222222222222222222222222",
  supply: "1000000000",
  pairAsset: "ETH",
  links: {
    pons: "https://www.ponsfamily.com/token/0x1111111111111111111111111111111111111111",
    pair: "https://app.uniswap.org/explore/pools/robinhood/0x9999",
  },
  wire: {
    address: "0x3333333333333333333333333333333333333333",
    poster: "0x4444444444444444444444444444444444444444",
  },
  pass: { address: "0x5555555555555555555555555555555555555555" },
});

/** The status words that only make sense before the thing they name exists. */
const AHEAD = ["at launch", "after launch", "at graduation", "next", "with the Key"];

describe("the fully pasted house", () => {
  it("is launched and carries a live Wire", () => {
    assert.equal(houseLaunched(LAUNCHED), true);
    assert.equal(wireLive(LAUNCHED), true);
  });

  it("leaves no verify row on a status: every row links instead", () => {
    const rows = verifyRows(LAUNCHED);
    assert.equal(rows.length, 6);
    for (const r of rows) {
      assert.equal(r.status, null, `${r.k} still prints "${r.status}"`);
      assert.ok(r.href, `${r.k} has a null status and no link`);
    }
  });

  it("leaves no launch step on a word that points ahead", () => {
    const steps = launchSteps(LAUNCHED);
    assert.equal(steps.length, 4);
    for (const s of steps) {
      assert.ok(!AHEAD.includes(s.status), `${s.name} still reads "${s.status}"`);
      assert.ok(s.status === "done" || s.status === "live", `${s.name} reads "${s.status}"`);
    }
  });

  it("stops calling the Wire next on the landing cards once it is live", () => {
    const [, proof] = houseCards(true);
    assert.equal(proof?.k, "Phase 1 · live");
    assert.equal(proof?.body, PROOF_LIVE);
    // The proof card is the one the Wire moves; the Key's card stays `next`
    // until the Key ships, which is a different paste.
    assert.doesNotMatch(`${proof?.k} ${proof?.body}`, /next/i);
    assert.match(houseCards(false)[1]?.k ?? "", /Phase 1 · next/);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GLOSSARY, glossaryPick } from "./glossary.ts";

describe("glossary", () => {
  it("has the ten desk terms, unique, in reading order", () => {
    const terms = GLOSSARY.map((g) => g.term);
    assert.deepEqual(terms, [
      "ticker",
      "live ×",
      "staged ×",
      "terminus",
      "veiled",
      "due",
      "oracle",
      "covering",
      "plate",
      "house",
    ]);
    assert.equal(new Set(terms).size, terms.length);
    for (const g of GLOSSARY) assert.ok(g.plain.length > 20, `${g.term} needs a plain sentence`);
  });

  it("says terminus is assumed at 09:30 ET when no time is published, and due means no move read", () => {
    const plain = (term: string) => GLOSSARY.find((g) => g.term === term)?.plain;
    assert.equal(
      plain("terminus"),
      "The moment staged becomes live. effectiveAt() on-chain, or the issuer's process date at 09:30 ET when no time is published; that time is assumed.",
    );
    assert.equal(plain("due"), "Process date passed. No multiplier move read yet. The desk will not guess.");
    // Character classes keep the repo's banned-word grep over src empty; the assertion is real.
    for (const g of GLOSSARY) assert.doesNotMatch(g.plain, /has not m[o]ved|un[p]aid/i, g.term);
  });

  it("picks entries in the order asked and skips unknown terms", () => {
    const picked = glossaryPick(["terminus", "nope", "live ×"]);
    assert.deepEqual(
      picked.map((g) => g.term),
      ["terminus", "live ×"],
    );
  });
});

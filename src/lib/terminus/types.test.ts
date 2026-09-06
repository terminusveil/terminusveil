import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidTicker } from "./types.ts";

describe("isValidTicker", () => {
  it("accepts plain uppercase tickers", () => {
    assert.equal(isValidTicker("NVDA"), true);
    assert.equal(isValidTicker("A"), true);
    assert.equal(isValidTicker("BRK.B"), true);
    assert.equal(isValidTicker("BF-B"), true);
    assert.equal(isValidTicker("123"), true);
  });

  it("rejects the empty string and anything over 12 characters", () => {
    assert.equal(isValidTicker(""), false);
    assert.equal(isValidTicker("A".repeat(13)), false);
    assert.equal(isValidTicker("A".repeat(12)), true);
  });

  it("rejects a quote, matching the api.calendar content-disposition exploit", () => {
    // ?ticker=a%22b decodes to a"b, uppercased to A"B.
    assert.equal(isValidTicker('A"B'), false);
  });

  it("rejects CR/LF header injection, matching the api.calendar 500", () => {
    // ?ticker=nvda%0d%0aX:1 decodes to nvda\r\nX:1, uppercased to NVDA\r\nX:1.
    assert.equal(isValidTicker("NVDA\r\nX:1"), false);
  });

  it("rejects lowercase, spaces and other punctuation", () => {
    assert.equal(isValidTicker("nvda"), false);
    assert.equal(isValidTicker("NV DA"), false);
    assert.equal(isValidTicker("NVDA!"), false);
    assert.equal(isValidTicker("NVDA/A"), false);
  });
});

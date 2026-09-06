import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CHANGELOG } from "./changelog.ts";

describe("changelog", () => {
  it("is dated in ISO days, newest first, every entry with at least one line", () => {
    let prev = "9999-12-31";
    for (const e of CHANGELOG) {
      assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, e.date);
      assert.ok(e.date < prev, `${e.date} is not older than ${prev}`);
      assert.ok(e.items.length > 0, `${e.date} has no lines`);
      prev = e.date;
    }
  });

  it("records only what shipped: no promise words, no banned words", () => {
    for (const e of CHANGELOG) {
      for (const line of e.items) {
        assert.doesNotMatch(line, /\b(soon|will|coming|planned for|Q[1-4])\b/i, line);
        assert.doesNotMatch(line, /\b(invest|investor|investment|profit|returns|thesis)\b/i, line);
        assert.match(line, /\.$/, `${line} should end with a period`);
      }
    }
  });
});

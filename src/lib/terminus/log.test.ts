import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { warnGate, warnOnce } from "./log.ts";

describe("warnOnce", () => {
  const realWarn = console.warn;
  let calls: unknown[][];

  beforeEach(() => {
    calls = [];
    console.warn = (...args: unknown[]) => {
      calls.push(args);
    };
  });
  afterEach(() => {
    console.warn = realWarn;
  });

  it("logs the first call", () => {
    const gate = warnGate();
    warnOnce(gate, 1_000, 0, "[x] first");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], ["[x] first"]);
  });

  it("suppresses a second call inside the window", () => {
    const gate = warnGate();
    warnOnce(gate, 1_000, 0, "[x] a");
    warnOnce(gate, 1_000, 999, "[x] b");
    assert.equal(calls.length, 1);
  });

  it("logs again once the window has passed", () => {
    const gate = warnGate();
    warnOnce(gate, 1_000, 0, "[x] a");
    warnOnce(gate, 1_000, 1_000, "[x] b");
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1], ["[x] b"]);
  });

  it("carries the extra fields as a second argument only when given", () => {
    const gate = warnGate();
    warnOnce(gate, 1_000, 0, "[x] c", { reason: "test" });
    assert.deepEqual(calls[0], ["[x] c", { reason: "test" }]);
  });

  it("keeps independent gates from interacting", () => {
    const a = warnGate();
    const b = warnGate();
    warnOnce(a, 1_000, 0, "[x] a");
    warnOnce(b, 1_000, 0, "[x] b");
    assert.equal(calls.length, 2);
  });
});

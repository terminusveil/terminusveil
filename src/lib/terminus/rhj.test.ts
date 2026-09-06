import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIONS_MAX_STALE_MS,
  ACTIONS_MS,
  ASSETS_MAX_STALE_MS,
  ASSETS_MS,
  RETRY_MS,
  createRhjFeed,
  parseAssets,
} from "./rhj.ts";

const START = Date.parse("2026-09-04T12:00:00Z");
const ADDR = "0x1111111111111111111111111111111111111111";

const ASSETS_BODY = {
  assets: [
    {
      tokenSymbol: "aapl",
      tokenName: "Apple",
      currentMultiplier: "1.0",
      pendingMultiplier: "0",
      pendingMultiplierEffectiveTime: null,
      status: "ASSET_STATUS_ACTIVE",
      deployments: [{ chainId: 4663, contractAddress: ADDR }],
    },
  ],
};

const ACTIONS_BODY = {
  corpActions: [
    {
      id: "x1",
      tokenSymbol: "aapl",
      type: "CORPORATE_ACTION_TYPE_CASH_DIVIDEND",
      status: "CORPORATE_ACTION_STATUS_IN_PROGRESS",
      processDate: { year: 2026, month: 9, day: 10 },
      details: { cashDividend: { rate: "0.26" } },
    },
  ],
};

/** A feed with an injected clock and loader: no network, no timers. */
function harness(start = START) {
  let t = start;
  let failing = false;
  const calls: string[] = [];
  const feed = createRhjFeed({
    now: () => t,
    getJson: async (url) => {
      calls.push(url.endsWith("/assets") ? "assets" : "actions");
      if (failing) return null;
      return url.endsWith("/assets") ? ASSETS_BODY : ACTIONS_BODY;
    },
  });
  return {
    feed,
    calls,
    tick: (ms: number) => {
      t += ms;
    },
    fail: (on: boolean) => {
      failing = on;
    },
    at: () => new Date(t).toISOString(),
  };
}

describe("rhj feed · constants", () => {
  it("keeps the stale limits above the refresh cadence and the retry window below it", () => {
    assert.ok(ASSETS_MAX_STALE_MS > ASSETS_MS);
    assert.ok(ACTIONS_MAX_STALE_MS > ACTIONS_MS);
    assert.ok(RETRY_MS <= ASSETS_MS);
  });
});

describe("rhj feed · fresh reads", () => {
  it("reads both endpoints once and stamps the read time", async () => {
    const h = harness();
    const s = await h.feed.fetchRhj();
    assert.equal(s.absent, false);
    assert.equal(s.actionsAbsent, false);
    assert.equal(s.stale, false);
    assert.equal(s.readAt, h.at());
    assert.equal(s.assets.length, 1);
    assert.equal(s.assets[0]?.ticker, "AAPL");
    assert.equal(s.actions.length, 1);
    assert.deepEqual(h.calls, ["assets", "actions"]);
  });

  it("serves the cache without a fetch inside the refresh window", async () => {
    const h = harness();
    await h.feed.fetchRhj();
    h.tick(ASSETS_MS - 1);
    const s = await h.feed.fetchRhj();
    assert.equal(s.stale, false);
    assert.equal(h.calls.length, 2);
  });

  it("refreshes only the assets when the actions are still fresh", async () => {
    const h = harness();
    await h.feed.fetchRhj();
    h.tick(ASSETS_MS);
    const s = await h.feed.fetchRhj();
    assert.equal(s.readAt, h.at());
    assert.deepEqual(h.calls, ["assets", "actions", "assets"]);
  });

  it("parseAssets drops inactive names and nulls a zero pending figure", () => {
    const parsed = parseAssets({
      assets: [...ASSETS_BODY.assets, { tokenSymbol: "dead", status: "ASSET_STATUS_INACTIVE" }],
    });
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]?.pendingMultiplier, null);
    assert.equal(parsed[0]?.address, ADDR);
  });
});

describe("rhj feed · a feed that stops answering", () => {
  it("serves the last reading as stale, dated at its own read time, within the stale limit", async () => {
    const h = harness();
    await h.feed.fetchRhj();
    const readAt = h.at();
    h.fail(true);
    h.tick(ASSETS_MS);
    const s = await h.feed.fetchRhj();
    assert.equal(s.absent, false);
    assert.equal(s.stale, true);
    assert.equal(s.readAt, readAt);
    assert.equal(s.assets.length, 1);
    assert.equal(h.calls.length, 3);
  });

  it("does not re-issue the fetch on every refresh while backing off", async () => {
    const h = harness();
    await h.feed.fetchRhj();
    h.fail(true);
    h.tick(ASSETS_MS);
    await h.feed.fetchRhj();
    const after = h.calls.length;
    h.tick(1_000);
    await h.feed.fetchRhj();
    h.tick(1_000);
    const s = await h.feed.fetchRhj();
    assert.equal(h.calls.length, after, "fetch re-issued inside the retry window");
    assert.equal(s.stale, true);
    h.tick(RETRY_MS);
    await h.feed.fetchRhj();
    assert.equal(h.calls.length, after + 1, "fetch not retried after the window");
  });

  it("warns once when the retry window is entered, not on every failed refresh inside it", async () => {
    const realWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      calls.push(args);
    };
    try {
      const h = harness();
      await h.feed.fetchRhj();
      h.fail(true);
      h.tick(ASSETS_MS);
      await h.feed.fetchRhj(); // enters the retry window: warns
      h.tick(1_000);
      await h.feed.fetchRhj(); // still inside RETRY_MS: served from cache, no new attempt
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.[0], "[rhj] retry window entered");
      h.tick(RETRY_MS);
      await h.feed.fetchRhj(); // window passed: retries, fails again, warns again
      assert.equal(calls.length, 2);
    } finally {
      console.warn = realWarn;
    }
  });

  it("is absent once the last reading is older than the stale limit", async () => {
    const h = harness();
    await h.feed.fetchRhj();
    h.fail(true);
    h.tick(ASSETS_MAX_STALE_MS);
    const s = await h.feed.fetchRhj();
    assert.equal(s.absent, true);
    assert.equal(s.stale, false);
    assert.equal(s.readAt, null);
    assert.deepEqual(s.assets, []);
    // Actions have a longer life; they are still served.
    assert.equal(s.actionsAbsent, false);
    assert.equal(s.actions.length, 1);
  });

  it("drops the actions after their own stale limit", async () => {
    const h = harness();
    await h.feed.fetchRhj();
    h.fail(true);
    h.tick(ACTIONS_MAX_STALE_MS);
    const s = await h.feed.fetchRhj();
    assert.equal(s.absent, true);
    assert.equal(s.actionsAbsent, true);
    assert.deepEqual(s.actions, []);
  });

  it("is absent and backs off when it never answered", async () => {
    const h = harness();
    h.fail(true);
    const s = await h.feed.fetchRhj();
    assert.equal(s.absent, true);
    assert.equal(s.readAt, null);
    const after = h.calls.length;
    h.tick(RETRY_MS - 1);
    await h.feed.fetchRhj();
    assert.equal(h.calls.length, after);
    h.tick(1);
    await h.feed.fetchRhj();
    assert.equal(h.calls.length, after + 2);
  });

  it("is fresh again once the feed answers", async () => {
    const h = harness();
    await h.feed.fetchRhj();
    h.fail(true);
    h.tick(ASSETS_MS);
    await h.feed.fetchRhj();
    h.fail(false);
    h.tick(RETRY_MS);
    const s = await h.feed.fetchRhj();
    assert.equal(s.stale, false);
    assert.equal(s.absent, false);
    assert.equal(s.readAt, h.at());
  });

  it("shares one in-flight load between concurrent callers", async () => {
    const h = harness();
    const [a, b] = await Promise.all([h.feed.fetchRhj(), h.feed.fetchRhj()]);
    assert.equal(a, b);
    assert.equal(h.calls.length, 2);
  });
});

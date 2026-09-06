import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PRICE_BACKOFF_MS,
  PRICE_MS,
  POOL_WIDTH,
  STAGGER_MS,
  createPriceFeed,
  parseQuote,
} from "./rhj-prices.ts";

function quoteBody(ticker: string) {
  return { quotes: [{ tokenSymbol: ticker, bid: "1.00", ask: "1.01", isTradingHalt: false, generatedAt: "t" }] };
}

/**
 * A feed with an injected clock, fetch and sleep: no network. `fetchImpl`
 * itself awaits a real, tiny timer (not the injected `sleep`) so concurrent
 * calls genuinely overlap in the event loop, which is what the pool-width
 * assertions need — without a real gap every call would resolve synchronously
 * and never overlap regardless of the pool's width.
 */
function harness(opts: { onFetch?: (ticker: string) => { status: number } | void } = {}) {
  let t = 0;
  const requested: string[] = [];
  const sleeps: number[] = [];
  let concurrent = 0;
  let maxConcurrent = 0;

  const fetchImpl = (async (url: unknown) => {
    const ticker = String(url).split("/prices/")[1] ?? "";
    requested.push(ticker);
    concurrent += 1;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    const forced = opts.onFetch?.(ticker);
    concurrent -= 1;
    if (forced?.status === 429) {
      return new Response(JSON.stringify({}), { status: 429 });
    }
    return new Response(JSON.stringify(quoteBody(ticker)), { status: 200 });
  }) as typeof fetch;

  const feed = createPriceFeed({
    now: () => t,
    fetchImpl,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });

  return {
    feed,
    requested,
    sleeps,
    tick: (ms: number) => {
      t += ms;
    },
    maxConcurrent: () => maxConcurrent,
  };
}

describe("createPriceFeed · caching", () => {
  it("caches a quote for PRICE_MS and does not re-fetch inside it", async () => {
    const h = harness();
    await h.feed.fetchQuotes(["AAPL"]);
    h.tick(PRICE_MS - 1);
    await h.feed.fetchQuotes(["aapl"]);
    assert.deepEqual(h.requested, ["AAPL"]);
  });

  it("re-fetches once the cache entry is past PRICE_MS", async () => {
    const h = harness();
    await h.feed.fetchQuotes(["AAPL"]);
    h.tick(PRICE_MS);
    await h.feed.fetchQuotes(["AAPL"]);
    assert.deepEqual(h.requested, ["AAPL", "AAPL"]);
  });

  it("de-duplicates repeated tickers in one call", async () => {
    const h = harness();
    const out = await h.feed.fetchQuotes(["AAPL", "aapl", "AAPL"]);
    assert.deepEqual(h.requested, ["AAPL"]);
    assert.equal(out.size, 1);
  });
});

describe("createPriceFeed · pool width and stagger", () => {
  it("fills the pool to exactly POOL_WIDTH concurrent fetches and never more", async () => {
    const h = harness();
    const tickers = Array.from({ length: 20 }, (_, i) => `T${i}`);
    await h.feed.fetchQuotes(tickers);
    assert.equal(h.maxConcurrent(), POOL_WIDTH);
    assert.equal(h.requested.length, 20);
  });

  it("starts each of the first POOL_WIDTH workers STAGGER_MS apart", async () => {
    const h = harness();
    const tickers = Array.from({ length: POOL_WIDTH + 3 }, (_, i) => `T${i}`);
    await h.feed.fetchQuotes(tickers);
    const starts = h.sleeps.filter((ms) => ms > 0).sort((a, b) => a - b);
    const expected = Array.from({ length: POOL_WIDTH - 1 }, (_, i) => (i + 1) * STAGGER_MS);
    assert.deepEqual(starts, expected);
  });

  it("spawns only as many workers as tickers when fewer than POOL_WIDTH", async () => {
    const h = harness();
    await h.feed.fetchQuotes(["A", "B"]);
    assert.equal(h.requested.length, 2);
    assert.equal(h.sleeps.filter((ms) => ms > 0).length, 1);
  });
});

describe("createPriceFeed · 429 back-off", () => {
  it("sets a 60s back-off on a 429 and skips the network until it lifts", async () => {
    const h = harness({ onFetch: (ticker) => (ticker === "AAPL" ? { status: 429 } : undefined) });
    const first = await h.feed.fetchQuotes(["AAPL"]);
    assert.equal(first.get("AAPL")?.bid, null);

    h.tick(PRICE_MS); // past the per-ticker cache, so a second call would normally re-fetch
    const second = await h.feed.fetchQuotes(["NVDA"]);
    assert.deepEqual(h.requested, ["AAPL"]); // NVDA never hit fetch: the back-off is honoured
    assert.equal(second.get("NVDA")?.bid, null);

    h.tick(PRICE_BACKOFF_MS);
    await h.feed.fetchQuotes(["NVDA"]);
    assert.deepEqual(h.requested, ["AAPL", "NVDA"]); // back-off lifted
  });

  it("logs the first 429 once per back-off window, not every request", async () => {
    const realWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      calls.push(args);
    };
    try {
      const h = harness({ onFetch: () => ({ status: 429 }) });
      await h.feed.fetchQuotes(["A", "B", "C"]);
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.[0], "[rhj-prices] 429, backing off 60s");
    } finally {
      console.warn = realWarn;
    }
  });
});

describe("parseQuote", () => {
  it("returns an empty quote when the endpoint did not answer", () => {
    assert.deepEqual(parseQuote("AAPL", null), { ticker: "AAPL", bid: null, ask: null, halt: false, at: null });
  });
});

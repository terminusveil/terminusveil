import { RHJ_API } from "./chain.ts";
import { warnGate, warnOnce } from "./log.ts";

export type RhjQuote = {
  ticker: string;
  bid: string | null;
  ask: string | null;
  halt: boolean;
  at: string | null;
};

/** A quote younger than this is served from cache without a re-fetch. */
export const PRICE_MS = 15_000;
/** How many tickers are in flight at once. */
export const POOL_WIDTH = 6;
/** Delay between starting one worker and the next, so the pool does not open as one burst. */
export const STAGGER_MS = 100;
/** After any 429, no fetch is issued for this long; the endpoint is treated as absent instead. */
export const PRICE_BACKOFF_MS = 60_000;

type PriceJson = {
  quotes?: {
    tokenSymbol?: string;
    bid?: string;
    ask?: string;
    isTradingHalt?: boolean;
    generatedAt?: string;
  }[];
};

/** Null-safe mapping of one `/rhj/prices/{symbol}` response; an empty quote when it did not answer. */
export function parseQuote(ticker: string, json: PriceJson | null): RhjQuote {
  const empty: RhjQuote = { ticker, bid: null, ask: null, halt: false, at: null };
  const q = json?.quotes?.[0];
  if (!q) return empty;
  return {
    ticker,
    bid: q.bid?.trim() || null,
    ask: q.ask?.trim() || null,
    halt: q.isTradingHalt === true,
    at: q.generatedAt ?? null,
  };
}

type FetchImpl = typeof fetch;
type Sleep = (ms: number) => Promise<void>;

export type PriceFeed = { fetchQuotes: (tickers: string[]) => Promise<Map<string, RhjQuote>> };

const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The issuer price endpoint, fanned out over a bounded worker pool instead of
 * one `Promise.all` per refresh. `now`, `fetchImpl` and `sleep` are injectable
 * so the pool width, the stagger and the 429 back-off can be tested against a
 * fake clock and a stubbed fetch, no network and no real waiting.
 */
export function createPriceFeed(
  deps: { now?: () => number; fetchImpl?: FetchImpl; sleep?: Sleep } = {},
): PriceFeed {
  const clock = deps.now ?? Date.now;
  const doFetch = deps.fetchImpl ?? fetch;
  const wait = deps.sleep ?? defaultSleep;
  const cache = new Map<string, { at: number; quote: RhjQuote }>();
  const rateLimitGate = warnGate();
  let backoffUntil = 0;

  async function loadOne(ticker: string): Promise<RhjQuote> {
    try {
      const res = await doFetch(`${RHJ_API}/prices/${encodeURIComponent(ticker)}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      if (res.status === 429) {
        const t = clock();
        warnOnce(rateLimitGate, PRICE_BACKOFF_MS, t, "[rhj-prices] 429, backing off 60s", {
          ticker,
        });
        backoffUntil = t + PRICE_BACKOFF_MS;
        return parseQuote(ticker, null);
      }
      if (!res.ok) return parseQuote(ticker, null);
      return parseQuote(ticker, (await res.json()) as PriceJson);
    } catch {
      return parseQuote(ticker, null);
    }
  }

  /** `need` tickers over up to `POOL_WIDTH` workers, each starting `STAGGER_MS` after the last. */
  async function runPool(need: string[]): Promise<RhjQuote[]> {
    const queue = [...need];
    const results: RhjQuote[] = [];
    const width = Math.min(POOL_WIDTH, need.length);
    async function worker(startDelay: number): Promise<void> {
      if (startDelay > 0) await wait(startDelay);
      for (;;) {
        const ticker = queue.shift();
        if (ticker === undefined) return;
        results.push(await loadOne(ticker));
      }
    }
    await Promise.all(Array.from({ length: width }, (_, i) => worker(i * STAGGER_MS)));
    return results;
  }

  async function fetchQuotes(tickers: string[]): Promise<Map<string, RhjQuote>> {
    const out = new Map<string, RhjQuote>();
    const need: string[] = [];
    const now = clock();
    const seen = new Set<string>();

    for (const raw of tickers) {
      const ticker = raw.toUpperCase();
      if (!ticker || seen.has(ticker)) continue;
      seen.add(ticker);
      const hit = cache.get(ticker);
      if (hit && now - hit.at < PRICE_MS) {
        out.set(ticker, hit.quote);
      } else {
        need.push(ticker);
      }
    }

    if (need.length === 0) return out;

    // A recent 429 means the endpoint is rate-limiting this instance; serve
    // empty quotes instead of adding to the pressure until the back-off lifts.
    if (now < backoffUntil) {
      for (const ticker of need) out.set(ticker, parseQuote(ticker, null));
      return out;
    }

    const loaded = await runPool(need);
    const stamped = clock();
    for (const quote of loaded) {
      cache.set(quote.ticker, { at: stamped, quote });
      out.set(quote.ticker, quote);
    }
    return out;
  }

  return { fetchQuotes };
}

const feed = createPriceFeed();

/** The process-wide price feed the desk reads. */
export const fetchQuotes: PriceFeed["fetchQuotes"] = feed.fetchQuotes;

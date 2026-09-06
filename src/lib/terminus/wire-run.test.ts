import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { buildRow, emptyDesk } from "./desk.ts";
import type { WireFacts } from "./relay-live.ts";
import type { DeskPayload, TickerRow, WireRead } from "./types.ts";
import {
  SELF_POST_INTERVAL_MS,
  resetSelfPost,
  runWirePost,
  selfPost,
  type WireRunDeps,
} from "./wire-run.ts";
import type { WirePost } from "./wire-post.ts";

/**
 * The run's seam, never the network: `runWirePost` takes its dependencies and
 * these tests pass their own. The poster key is generated per run and lives
 * only in this process — the repo never holds one.
 */
const WIRE = "0x3333333333333333333333333333333333333333" as const;
const WAD = 10n ** 18n;
const NOW = Date.parse("2026-09-06T12:00:00Z");
const TERMINUS = Math.floor(Date.parse("2026-09-09T13:30:00Z") / 1000);
const TX = `0x${"ab".repeat(32)}` as const;

function veiledRow(ticker = "NVDA"): TickerRow {
  const row = buildRow({
    ticker,
    name: null,
    address: "0x1111111111111111111111111111111111111111",
    live: WAD.toString(),
    liveApi: null,
    liveOnchain: WAD.toString(),
    staged: (4n * WAD).toString(),
    stagedApi: null,
    stagedOnchain: (4n * WAD).toString(),
    effectiveAtIso: new Date(TERMINUS * 1000).toISOString(),
    effectiveAtSource: "chain",
    effectiveAtOnchainSec: TERMINUS,
    action: null,
    tapeAbsent: false,
    paused: false,
    transferPaused: false,
    onchain: true,
    now: NOW,
  });
  row.state = "veiled";
  return row;
}

function liveDesk(rows: TickerRow[]): DeskPayload {
  return { ...emptyDesk("", NOW), source: "live", rows };
}

/** A poster key that exists only for this run, with the facts that name it. */
function poster(): { key: `0x${string}`; facts: WireFacts } {
  const key = generatePrivateKey();
  return { key, facts: { address: WIRE, poster: privateKeyToAccount(key).address } };
}

type Spy = { posts: WirePost[][]; hashes: `0x${string}`[] };

function deps(over: Partial<WireRunDeps>, spy: Spy): Partial<WireRunDeps> {
  return {
    desk: async () => liveDesk([veiledRow()]),
    readWire: async () => new Map<string, WireRead | null>(),
    post: async (_account, _facts, posts) => {
      spy.posts.push([...posts]);
      return TX;
    },
    receipt: async (hash) => {
      spy.hashes.push(hash);
      return { status: "success", blockNumber: 55_358_218n };
    },
    ...over,
  };
}

describe("runWirePost", () => {
  const realKey = process.env.WIRE_POSTER_KEY;
  let spy: Spy;

  beforeEach(() => {
    spy = { posts: [], hashes: [] };
  });
  afterEach(() => {
    if (realKey === undefined) delete process.env.WIRE_POSTER_KEY;
    else process.env.WIRE_POSTER_KEY = realKey;
  });

  it("does nothing while the Wire is not live", async () => {
    const { key } = poster();
    process.env.WIRE_POSTER_KEY = key;
    const out = await runWirePost(deps({ facts: () => null }, spy));
    assert.deepEqual(out, {
      posted: 0,
      skipped: 0,
      txHash: null,
      block: null,
      reason: "wire not live",
    });
    assert.equal(spy.posts.length, 0);
  });

  it("names an unset and a malformed poster key", async () => {
    const { facts } = poster();
    delete process.env.WIRE_POSTER_KEY;
    assert.equal(
      (await runWirePost(deps({ facts: () => facts }, spy))).reason,
      "WIRE_POSTER_KEY unset",
    );
    process.env.WIRE_POSTER_KEY = "0xnothex";
    assert.equal(
      (await runWirePost(deps({ facts: () => facts }, spy))).reason,
      "WIRE_POSTER_KEY malformed",
    );
    assert.equal(spy.posts.length, 0);
  });

  it("refuses a key that is not the pasted poster", async () => {
    const { key } = poster();
    const other = poster();
    process.env.WIRE_POSTER_KEY = key;
    const out = await runWirePost(deps({ facts: () => other.facts }, spy));
    assert.equal(out.reason, "WIRE_POSTER_KEY is not the pasted poster");
    assert.equal(spy.posts.length, 0);
  });

  it("does not post from a snapshot desk", async () => {
    const { key, facts } = poster();
    process.env.WIRE_POSTER_KEY = key;
    const out = await runWirePost(
      deps(
        {
          facts: () => facts,
          desk: async () => ({ ...liveDesk([veiledRow()]), source: "snapshot" }),
        },
        spy,
      ),
    );
    assert.equal(out.reason, "desk is a snapshot");
    assert.equal(spy.posts.length, 0);
  });

  it("sends no transaction when the chain already carries every row", async () => {
    const { key, facts } = poster();
    process.env.WIRE_POSTER_KEY = key;
    const out = await runWirePost(
      deps(
        {
          facts: () => facts,
          readWire: async () =>
            new Map<string, WireRead | null>([
              ["NVDA", { staged: (4n * WAD).toString(), terminus: TERMINUS, postedAt: 1 }],
            ]),
        },
        spy,
      ),
    );
    assert.deepEqual(out, { posted: 0, skipped: 1, txHash: null, block: null, reason: null });
    assert.equal(spy.posts.length, 0);
  });

  it("posts the planned rows and reports the hash and the block", async () => {
    const { key, facts } = poster();
    process.env.WIRE_POSTER_KEY = key;
    const out = await runWirePost(deps({ facts: () => facts }, spy));
    assert.deepEqual(out, { posted: 1, skipped: 0, txHash: TX, block: 55_358_218, reason: null });
    assert.deepEqual(spy.posts, [
      [{ ticker: "NVDA", staged: (4n * WAD).toString(), terminus: TERMINUS }],
    ]);
    assert.deepEqual(spy.hashes, [TX]);
  });

  it("plans and reads every row with an address, an open one too, not only veiled and due", async () => {
    const { key, facts } = poster();
    process.env.WIRE_POSTER_KEY = key;
    const open = veiledRow("AAPL");
    open.state = "open";
    open.staged = null;
    open.stagedOnchain = null;
    open.effectiveAtOnchainSec = 0;
    let asked: string[] = [];
    const out = await runWirePost(
      deps(
        {
          facts: () => facts,
          desk: async () => liveDesk([veiledRow(), open]),
          readWire: async (_facts, tickers) => {
            asked = tickers;
            return new Map<string, WireRead | null>();
          },
        },
        spy,
      ),
    );
    assert.deepEqual(asked, ["NVDA", "AAPL"]);
    assert.equal(out.posted, 2);
    assert.deepEqual(spy.posts, [
      [
        { ticker: "NVDA", staged: (4n * WAD).toString(), terminus: TERMINUS },
        { ticker: "AAPL", staged: WAD.toString(), terminus: 0 },
      ],
    ]);
  });

  it("reports the hash with a null block when the receipt wait times out", async () => {
    const { key, facts } = poster();
    process.env.WIRE_POSTER_KEY = key;
    const out = await runWirePost(
      deps(
        {
          facts: () => facts,
          receipt: async () => {
            throw new Error("timed out");
          },
        },
        spy,
      ),
    );
    // The transaction was broadcast: the hash stands, the block is what this run
    // could not see, and the next run reads the chain and skips what landed.
    assert.deepEqual(out, { posted: 1, skipped: 0, txHash: TX, block: null, reason: null });
  });

  it("posts nothing on a reverted receipt and says so", async () => {
    const { key, facts } = poster();
    process.env.WIRE_POSTER_KEY = key;
    const out = await runWirePost(
      deps(
        {
          facts: () => facts,
          receipt: async () => ({ status: "reverted", blockNumber: 42n }),
        },
        spy,
      ),
    );
    assert.deepEqual(out, {
      posted: 0,
      skipped: 0,
      txHash: TX,
      block: 42,
      reason: "transaction reverted",
    });
  });
});

describe("selfPost", () => {
  const realKey = process.env.WIRE_POSTER_KEY;
  let spy: Spy;

  beforeEach(() => {
    spy = { posts: [], hashes: [] };
    resetSelfPost();
  });
  afterEach(() => {
    if (realKey === undefined) delete process.env.WIRE_POSTER_KEY;
    else process.env.WIRE_POSTER_KEY = realKey;
  });

  it("does nothing without a poster key, and never calls the run", async () => {
    const { facts } = poster();
    delete process.env.WIRE_POSTER_KEY;
    const out = await selfPost(NOW, deps({ facts: () => facts }, spy), {});
    assert.equal(out, null);
    assert.equal(spy.posts.length, 0);
  });

  it("runs once, then not again until the interval has passed", async () => {
    const { key, facts } = poster();
    process.env.WIRE_POSTER_KEY = key;
    const d = deps({ facts: () => facts }, spy);
    const first = await selfPost(NOW, d);
    assert.equal(first?.posted, 1);
    assert.equal(first?.block, null, "the receipt is not awaited");
    assert.equal(spy.hashes.length, 0, "no receipt wait");
    assert.equal(await selfPost(NOW + SELF_POST_INTERVAL_MS - 1, d), null);
    assert.equal(spy.posts.length, 1);
    const again = await selfPost(NOW + SELF_POST_INTERVAL_MS, d);
    assert.equal(again?.posted, 1);
    assert.equal(spy.posts.length, 2);
  });

  it("swallows a failing broadcast and still spaces the next attempt", async () => {
    const { key, facts } = poster();
    process.env.WIRE_POSTER_KEY = key;
    const d = deps(
      {
        facts: () => facts,
        post: async () => {
          throw new Error("RPC did not answer.");
        },
      },
      spy,
    );
    assert.equal(await selfPost(NOW, d), null);
    assert.equal(await selfPost(NOW + 1000, d), null);
  });
});

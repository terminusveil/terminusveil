import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, encodeAbiParameters, encodeFunctionResult } from "viem";
import { SELECTORS } from "./chain.ts";
import {
  LAST_MOVE_WINDOW_BLOCKS,
  UI_MULTIPLIER_UPDATED_TOPIC,
  blockWindow,
  decodeMoveLog,
  lastMoveOf,
  latestMove,
  type MoveLog,
} from "./last-move.ts";
import { MULTICALL3_ABI, MULTICALL3_ADDRESS, MULTICALL_CHUNK } from "./multicall.ts";
import {
  TAPE_CACHE_MS,
  createTapeReader,
  readLastMoves,
  readMultipliers,
  readTapeRaw,
  readWire,
  readWireStatus,
  type WireFacts,
} from "./relay-live.ts";
import type { Tape } from "./types.ts";
import { encodeLatest } from "./wire.ts";

const WAD = 10n ** 18n;
const NEW = 1002208000000000000n;
const EFFECTIVE_AT = 1757000000;
const word = (n: bigint | number) => BigInt(n).toString(16).padStart(64, "0");
const ADDR = "0xf23250dac154D05Bb671CB0d0eBEf3c635c79CE2" as const;
const OTHER = "0x2F62fC9fAbb470C690f141c28340eD832bB27020" as const;

/** One `UIMultiplierUpdated(1e18, 1.002208e18, 1757000000)` log at block 0x33d0c00, as the RPC prints it. */
const FIXTURE: MoveLog = {
  address: ADDR.toLowerCase(),
  topics: [UI_MULTIPLIER_UPDATED_TOPIC],
  data: `0x${word(WAD)}${word(NEW)}${word(EFFECTIVE_AT)}`,
  blockNumber: "0x33d0c00",
  transactionHash: "0x6d72ca599d812b9eb483fa82ba204e6d079e981b675669c9b659b7fac8adff35",
  transactionIndex: "0x15",
  blockHash: "0x611151cd768624e3334c53962f537fd7d24b00a2adcd2ce1e80ffc075bbc2877",
  blockTimestamp: "0x0",
  logIndex: "0x61",
  removed: false,
};

describe("last-move · decode", () => {
  it("names the event by its keccak topic", () => {
    // keccak256("UIMultiplierUpdated(uint256,uint256,uint256)")
    assert.equal(
      UI_MULTIPLIER_UPDATED_TOPIC,
      "0x2205df4534432b2f60654a3fdb48737ffdaf3e9edb1a498bd985bc026b15b055",
    );
  });

  it("decodes old, new, effectiveAt and the block from a raw log", () => {
    const m = decodeMoveLog(FIXTURE);
    assert.ok(m);
    assert.equal(m.oldWad, WAD);
    assert.equal(m.newWad, NEW);
    assert.equal(m.effectiveAtSec, EFFECTIVE_AT);
    assert.equal(m.blockNumber, 0x33d0c00);
    assert.equal(m.logIndex, 0x61);
  });

  it("returns null for a log it cannot read", () => {
    assert.equal(decodeMoveLog({ ...FIXTURE, data: "0x" + word(WAD) }), null);
    assert.equal(decodeMoveLog({ ...FIXTURE, data: undefined }), null);
    assert.equal(decodeMoveLog({ ...FIXTURE, data: "0xzz" }), null);
    assert.equal(decodeMoveLog({ ...FIXTURE, blockNumber: undefined }), null);
    assert.equal(decodeMoveLog({ ...FIXTURE, removed: true }), null);
    assert.equal(decodeMoveLog({ ...FIXTURE, topics: ["0x" + "ab".repeat(32)] }), null);
  });

  it("keeps the latest log by block, then by log index", () => {
    const older: MoveLog = { ...FIXTURE, blockNumber: "0x33d0bff", logIndex: "0x70" };
    const sameBlockLater: MoveLog = {
      ...FIXTURE,
      logIndex: "0x62",
      data: `0x${word(NEW)}${word(2n * WAD)}${word(EFFECTIVE_AT + 60)}`,
    };
    const pick = latestMove([older, sameBlockLater, FIXTURE]);
    assert.ok(pick);
    assert.equal(pick.blockNumber, 0x33d0c00);
    assert.equal(pick.logIndex, 0x62);
    assert.equal(pick.newWad, 2n * WAD);
    assert.equal(latestMove([]), null);
    assert.equal(latestMove([{ ...FIXTURE, data: "0x" }]), null);
  });

  it("carries a read onto a row as decimal wei and ISO times", () => {
    const row = lastMoveOf({
      oldWad: WAD,
      newWad: NEW,
      effectiveAtSec: EFFECTIVE_AT,
      blockNumber: 0x33d0c00,
      blockTimeSec: EFFECTIVE_AT - 600,
    });
    assert.deepEqual(row, {
      old: "1000000000000000000",
      new: "1002208000000000000",
      effectiveAtIso: "2025-09-04T15:33:20.000Z",
      atIso: "2025-09-04T15:23:20.000Z",
      block: 54332416,
    });
    const bare = lastMoveOf({
      oldWad: WAD,
      newWad: NEW,
      effectiveAtSec: 0,
      blockNumber: 1,
      blockTimeSec: null,
    });
    assert.equal(bare.effectiveAtIso, null);
    assert.equal(bare.atIso, null);
  });

  it("bounds the scan to a window below the tape's block", () => {
    assert.ok(LAST_MOVE_WINDOW_BLOCKS > 200_000);
    assert.deepEqual(blockWindow(54_600_000), {
      fromBlock: 54_600_000 - LAST_MOVE_WINDOW_BLOCKS,
      toBlock: 54_600_000,
    });
    assert.deepEqual(blockWindow(10), { fromBlock: 0, toBlock: 10 });
  });
});

type RpcCall = { id: number; method: string; params: unknown[] };

describe("readLastMoves", () => {
  const realFetch = globalThis.fetch;
  let calls: RpcCall[] = [];
  let answer: (call: RpcCall) => { result?: unknown; error?: { message: string } };

  beforeEach(() => {
    calls = [];
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      const batch = JSON.parse(init?.body ?? "[]") as RpcCall[];
      calls.push(...batch);
      const out = batch.map((c) => ({ jsonrpc: "2.0", id: c.id, ...answer(c) }));
      return new Response(JSON.stringify(out), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("issues one bounded getLogs per address and one block read per distinct block", async () => {
    answer = (c) => {
      if (c.method === "eth_getLogs") {
        const f = c.params[0] as { address: string };
        return { result: f.address.toLowerCase() === ADDR.toLowerCase() ? [FIXTURE] : [] };
      }
      if (c.method === "eth_getBlockByNumber") {
        return {
          result: { number: c.params[0], timestamp: "0x" + (EFFECTIVE_AT - 600).toString(16) },
        };
      }
      return { error: { message: "unexpected" } };
    };
    const out = await readLastMoves([ADDR, OTHER], { fromBlock: 54_000_000, toBlock: 54_600_000 });

    const logs = calls.filter((c) => c.method === "eth_getLogs");
    assert.equal(logs.length, 2);
    for (const c of logs) {
      const f = c.params[0] as Record<string, unknown>;
      assert.deepEqual(f.topics, [UI_MULTIPLIER_UPDATED_TOPIC]);
      assert.equal(f.fromBlock, "0x" + (54_000_000).toString(16));
      assert.equal(f.toBlock, "0x" + (54_600_000).toString(16));
    }
    const blocks = calls.filter((c) => c.method === "eth_getBlockByNumber");
    assert.equal(blocks.length, 1);
    assert.deepEqual(blocks[0]?.params, ["0x33d0c00", false]);

    assert.equal(out.size, 1);
    assert.deepEqual(out.get(ADDR.toLowerCase()), {
      oldWad: WAD,
      newWad: NEW,
      effectiveAtSec: EFFECTIVE_AT,
      blockNumber: 0x33d0c00,
      blockTimeSec: EFFECTIVE_AT - 600,
    });
    assert.equal(out.has(OTHER.toLowerCase()), false);
  });

  it("leaves a failed address out and keeps the block time null when the block read fails", async () => {
    answer = (c) => {
      if (c.method === "eth_getLogs") {
        const f = c.params[0] as { address: string };
        if (f.address.toLowerCase() === OTHER.toLowerCase())
          return { error: { message: "query timeout" } };
        return { result: [FIXTURE] };
      }
      return { error: { message: "block not found" } };
    };
    const out = await readLastMoves([ADDR, OTHER], { fromBlock: 0, toBlock: 54_600_000 });
    assert.equal(out.has(OTHER.toLowerCase()), false);
    assert.equal(out.get(ADDR.toLowerCase())?.blockTimeSec, null);
    assert.equal(out.get(ADDR.toLowerCase())?.blockNumber, 0x33d0c00);
  });

  it("returns an empty map when the RPC does not answer, and for no addresses", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNRESET");
    }) as typeof fetch;
    // This is the first slice in the file to exhaust its retries, so it is
    // the one place that can observe rpcBatch's rate-limited warning fire —
    // a later scenario in the same process falls inside the same window and
    // would find it already spent.
    const realWarn = console.warn;
    const warnCalls: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      warnCalls.push(args);
    };
    let out: Awaited<ReturnType<typeof readLastMoves>>;
    try {
      out = await readLastMoves([ADDR], { fromBlock: 0, toBlock: 10 });
    } finally {
      console.warn = realWarn;
    }
    assert.equal(out.size, 0);
    assert.equal((await readLastMoves([], { fromBlock: 0, toBlock: 10 })).size, 0);
    assert.equal(warnCalls.length, 1);
    assert.equal(warnCalls[0]?.[0], "[relay] rpcBatch retries exhausted");
  });
});

const addr = (n: number) => ("0x" + n.toString(16).padStart(40, "0")) as `0x${string}`;

type SubCallIn = { target: `0x${string}`; allowFailure: boolean; callData: `0x${string}` };
type Answer = { success: boolean; returnData: `0x${string}` };
const JSON_HEADERS = { "content-type": "application/json" };

/** The sub-calls inside one aggregate3 eth_call entry, after checking it is addressed to Multicall3. */
function subcallsOf(c: RpcCall): SubCallIn[] {
  assert.equal(c.method, "eth_call");
  const params = c.params as [{ to: string; data: `0x${string}` }, string];
  assert.equal(params[0].to, MULTICALL3_ADDRESS);
  assert.equal(params[1], "latest");
  const { args } = decodeFunctionData({ abi: MULTICALL3_ABI, data: params[0].data });
  return args[0] as SubCallIn[];
}

/** An aggregate3 answer: one {success, returnData} per sub-call. */
function aggregate3Result(entries: Answer[]): `0x${string}` {
  return encodeFunctionResult({ abi: MULTICALL3_ABI, functionName: "aggregate3", result: entries });
}

const FIELD_SELECTORS = [
  SELECTORS.uiMultiplier,
  SELECTORS.newUIMultiplier,
  SELECTORS.effectiveAt,
  SELECTORS.oraclePaused,
  SELECTORS.transferPaused,
];

/** A healthy token's answer per selector: 1× live and staged, a set terminus, oracle running, transfers paused. */
function healthyAnswer(s: SubCallIn): Answer {
  if (s.callData === SELECTORS.effectiveAt)
    return { success: true, returnData: `0x${word(EFFECTIVE_AT)}` };
  if (s.callData === SELECTORS.transferPaused) return { success: true, returnData: `0x${word(1)}` };
  if (s.callData === SELECTORS.oraclePaused) return { success: true, returnData: `0x${word(0)}` };
  return { success: true, returnData: `0x${word(WAD)}` };
}

describe("readMultipliers · through Multicall3", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("carries every read in one batch of aggregate3 calls, MULTICALL_CHUNK sub-calls each", async () => {
    const addresses = Array.from({ length: 194 }, (_, i) => addr(i + 1));
    const requests: RpcCall[][] = [];
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      const batch = JSON.parse(init?.body ?? "[]") as RpcCall[];
      requests.push(batch);
      const out = batch.map((c) => ({
        jsonrpc: "2.0",
        id: c.id,
        result: aggregate3Result(subcallsOf(c).map(healthyAnswer)),
      }));
      return new Response(JSON.stringify(out), { status: 200, headers: JSON_HEADERS });
    }) as typeof fetch;

    const out = await readMultipliers(addresses);

    // 194 × 5 = 970 sub-calls in four eth_calls, one HTTP request.
    assert.equal(requests.length, 1);
    const batch = requests[0] as RpcCall[];
    assert.deepEqual(
      batch.map((c) => subcallsOf(c).length),
      [MULTICALL_CHUNK, MULTICALL_CHUNK, MULTICALL_CHUNK, 970 - 3 * MULTICALL_CHUNK],
    );
    assert.deepEqual(
      batch.map((c) => c.id),
      [1, 2, 3, 4],
    );
    const flat = batch.flatMap(subcallsOf);
    assert.equal(flat.length, 970);
    assert.ok(flat.every((s) => s.allowFailure));
    addresses.forEach((a, i) => {
      const mine = flat.slice(i * 5, i * 5 + 5);
      assert.ok(mine.every((s) => s.target.toLowerCase() === a.toLowerCase()));
      assert.deepEqual(
        mine.map((s) => s.callData),
        FIELD_SELECTORS,
      );
    });

    assert.equal(out.size, 194);
    for (const a of addresses) {
      const row = out.get(a.toLowerCase());
      assert.equal(row?.live, WAD);
      assert.equal(row?.staged, WAD);
      assert.equal(row?.effectiveAtSec, EFFECTIVE_AT);
      assert.equal(row?.paused, false);
      assert.equal(row?.transferPaused, true);
    }
  });

  it("a reverted sub-call nulls only its field; a chunk that errored leaves its addresses unread", async () => {
    // 60 addresses × 5 = 300 sub-calls: chunk 1 holds addresses 1–50, chunk 2 holds 51–60.
    const addresses = Array.from({ length: 60 }, (_, i) => addr(i + 1));
    const reverting = addr(2).toLowerCase();
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      const batch = JSON.parse(init?.body ?? "[]") as RpcCall[];
      const out = batch.map((c) => {
        if (c.id === 2)
          return { jsonrpc: "2.0", id: c.id, error: { message: "execution reverted" } };
        const answers = subcallsOf(c).map((s) =>
          s.target.toLowerCase() === reverting && s.callData === SELECTORS.transferPaused
            ? { success: false, returnData: "0x" as const }
            : healthyAnswer(s),
        );
        return { jsonrpc: "2.0", id: c.id, result: aggregate3Result(answers) };
      });
      return new Response(JSON.stringify(out), { status: 200, headers: JSON_HEADERS });
    }) as typeof fetch;

    const out = await readMultipliers(addresses);

    const one = out.get(addr(1).toLowerCase());
    assert.equal(one?.live, WAD);
    assert.equal(one?.transferPaused, true);
    const two = out.get(reverting);
    assert.equal(two?.live, WAD, "the other four fields still decode");
    assert.equal(two?.paused, false);
    assert.equal(two?.transferPaused, null, "only the reverted field is unread");
    for (let n = 51; n <= 60; n += 1) {
      const row = out.get(addr(n).toLowerCase());
      assert.equal(row?.live, null, `${addr(n)} should be unread`);
      assert.equal(row?.staged, null);
      assert.equal(row?.effectiveAtSec, null);
      assert.equal(row?.paused, null);
      assert.equal(row?.transferPaused, null);
    }
  });

  it("HTTP 429 on the whole batch (after retries) leaves every address unread and does not throw", async () => {
    globalThis.fetch = (async () =>
      new Response("Too Many Requests", { status: 429 })) as typeof fetch;
    const out = await readMultipliers([addr(1), addr(2)]);
    assert.equal(out.size, 2);
    for (const row of out.values()) {
      assert.equal(row.live, null);
      assert.equal(row.staged, null);
      assert.equal(row.effectiveAtSec, null);
      assert.equal(row.paused, null);
      assert.equal(row.transferPaused, null);
    }
  });
});

describe("readTapeRaw", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("retries a 429 and reads the tape on the next try", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) return new Response("Too Many Requests", { status: 429 });
      const out = [
        { jsonrpc: "2.0", id: 1, result: "0x1237" },
        { jsonrpc: "2.0", id: 2, result: "0x3553c12" },
      ];
      return new Response(JSON.stringify(out), { status: 200, headers: JSON_HEADERS });
    }) as typeof fetch;
    const tape = await readTapeRaw();
    assert.equal(calls, 2);
    assert.deepEqual(tape, { chainId: 4663, block: 0x3553c12, absent: false, reason: null });
  });

  it("is absent with the RPC's silence as the reason once retries are spent", async () => {
    globalThis.fetch = (async () =>
      new Response("Too Many Requests", { status: 429 })) as typeof fetch;
    const tape = await readTapeRaw();
    assert.deepEqual(tape, {
      chainId: null,
      block: null,
      absent: true,
      reason: "RPC did not answer.",
    });
  });
});

describe("createTapeReader", () => {
  function fakeTape(n: number): Tape {
    return { chainId: 4663, block: n, absent: false, reason: null };
  }

  it("serves a cached reading inside TAPE_CACHE_MS without re-reading", async () => {
    let t = 0;
    let calls = 0;
    const reader = createTapeReader({
      now: () => t,
      readRaw: async () => {
        calls += 1;
        return fakeTape(calls);
      },
    });
    const a = await reader.readTape();
    t += TAPE_CACHE_MS - 1;
    const b = await reader.readTape();
    assert.equal(calls, 1);
    assert.deepEqual(a, b);
  });

  it("re-reads once the cache is past TAPE_CACHE_MS", async () => {
    let t = 0;
    let calls = 0;
    const reader = createTapeReader({
      now: () => t,
      readRaw: async () => {
        calls += 1;
        return fakeTape(calls);
      },
    });
    await reader.readTape();
    t += TAPE_CACHE_MS;
    const b = await reader.readTape();
    assert.equal(calls, 2);
    assert.equal(b.block, 2);
  });

  it("shares one in-flight read across concurrent callers", async () => {
    let calls = 0;
    const deferred: { resolve: ((t: Tape) => void) | null } = { resolve: null };
    const reader = createTapeReader({
      now: () => 0,
      readRaw: () =>
        new Promise<Tape>((resolve) => {
          calls += 1;
          deferred.resolve = resolve;
        }),
    });
    const p1 = reader.readTape();
    const p2 = reader.readTape();
    deferred.resolve?.(fakeTape(1));
    const [a, b] = await Promise.all([p1, p2]);
    assert.equal(calls, 1);
    assert.deepEqual(a, b);
  });
});

const WIRE = "0x3333333333333333333333333333333333333333" as const;
const POSTER = "0x4444444444444444444444444444444444444444" as const;
const WIRE_FACTS: WireFacts = { address: WIRE, poster: POSTER };

/** Same shape as `wire.test.ts`'s helper: an ABI-encoded `latest()` tuple. */
function encodedPost(staged: bigint, terminus: number, postedAt: number): `0x${string}` {
  return encodeAbiParameters(
    [{ type: "tuple", components: [{ type: "uint256" }, { type: "uint64" }, { type: "uint64" }] }],
    [[staged, BigInt(terminus), BigInt(postedAt)]],
  );
}

describe("readWire", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("decodes a post, keys an all-zero tuple as nothing posted, and drops a failing entry", async () => {
    const tickers = ["A", "B", "C"];
    const posted = encodedPost(4n * WAD, EFFECTIVE_AT, 1_757_000_000);
    const bodies: RpcCall[] = [];
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      const batch = JSON.parse(init?.body ?? "[]") as RpcCall[];
      bodies.push(...batch);
      const out = batch.map((c) => ({
        jsonrpc: "2.0",
        id: c.id,
        result: aggregate3Result([
          { success: true, returnData: posted },
          { success: true, returnData: encodedPost(0n, 0, 0) },
          { success: false, returnData: "0x" },
        ]),
      }));
      return new Response(JSON.stringify(out), { status: 200, headers: JSON_HEADERS });
    }) as typeof fetch;

    const out = await readWire(WIRE_FACTS, tickers);

    // C errored: its key is absent, so the desk can tell the read from the answer.
    assert.deepEqual([...out.keys()], ["A", "B"]);
    assert.deepEqual(out.get("A"), {
      staged: (4n * WAD).toString(),
      terminus: EFFECTIVE_AT,
      postedAt: 1_757_000_000,
    });
    assert.equal(out.has("B"), true);
    assert.equal(out.get("B"), null);
    assert.equal(out.has("C"), false);

    // Three latest() reads ride in one aggregate3 call.
    assert.equal(bodies.length, 1);
    const subcalls = subcallsOf(bodies[0] as RpcCall);
    assert.equal(subcalls.length, 3);
    subcalls.forEach((s, i) => {
      assert.equal(s.target, WIRE);
      assert.equal(s.callData, encodeLatest(POSTER, tickers[i] as string));
    });
  });

  it("returns an empty map for no tickers, without calling the RPC", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      throw new Error("should not be called");
    }) as typeof fetch;
    const out = await readWire(WIRE_FACTS, []);
    assert.equal(out.size, 0);
    assert.equal(called, false);
  });

  it("HTTP 500 on the whole batch (after retries) returns an empty map and does not throw", async () => {
    globalThis.fetch = (async () =>
      new Response("Internal Server Error", { status: 500 })) as typeof fetch;
    const out = await readWire(WIRE_FACTS, ["A", "B", "C"]);
    // Not three nulls: a batch that never answered must not read as three
    // tickers with nothing posted.
    assert.equal(out.size, 0);
  });

  it("drops a ticker whose call answered bare 0x, which decodes to no post at all", async () => {
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      const batch = JSON.parse(init?.body ?? "[]") as RpcCall[];
      const out = batch.map((c) => ({
        jsonrpc: "2.0",
        id: c.id,
        result: aggregate3Result([{ success: true, returnData: "0x" }]),
      }));
      return new Response(JSON.stringify(out), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const out = await readWire(WIRE_FACTS, ["A"]);
    assert.equal(out.size, 0);
  });
});

describe("readWireStatus", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("decodes the poster's count and the eth_getBalance-shaped balance", async () => {
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      const batch = JSON.parse(init?.body ?? "[]") as RpcCall[];
      const out = batch.map((c) => {
        if (c.method === "eth_call")
          return { jsonrpc: "2.0", id: c.id, result: "0x" + 7n.toString(16).padStart(64, "0") };
        return { jsonrpc: "2.0", id: c.id, result: "0x3e8" };
      });
      return new Response(JSON.stringify(out), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const out = await readWireStatus(WIRE_FACTS);
    assert.deepEqual(out, { count: 7, posterBalanceWei: "1000" });
  });

  it("nulls both fields when both the count call and the balance call error", async () => {
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      const batch = JSON.parse(init?.body ?? "[]") as RpcCall[];
      const out = batch.map((c) => ({
        jsonrpc: "2.0",
        id: c.id,
        error: { message: "execution reverted" },
      }));
      return new Response(JSON.stringify(out), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const out = await readWireStatus(WIRE_FACTS);
    assert.deepEqual(out, { count: null, posterBalanceWei: null });
  });
});

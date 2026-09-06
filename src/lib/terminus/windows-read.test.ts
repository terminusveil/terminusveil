import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionResult } from "viem";
import {
  INITIALIZE_TOPIC,
  PONS_FACTORY,
  PONS_MEME_HOOK,
  TOKEN_LAUNCHED_TOPIC,
  UNISWAP_V4_POOL_MANAGER,
} from "./windows.ts";
import {
  ERC20_SYMBOL_ABI,
  PONS_FACTORY_ABI,
  decodePhase,
  readWindowsDelta,
} from "./windows-read.ts";

type RpcCall = { id: number; method: string; params: unknown[] };
type RpcAnswer = { result?: unknown; error?: { message: string } };

const NVDA = "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC" as const;
const OTHER = "0x1111111111111111111111111111111111111111" as const;
const OTHER2 = "0x2222222222222222222222222222222222222222" as const;
const TOKEN = "0xA3589dF474ce7a5DF99109DFeA51E23FeeC20085" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const RANGE = { fromBlock: 100, toBlock: 200 };

const pad = (address: string) => "0x" + address.slice(2).toLowerCase().padStart(64, "0");
const word = (address: string) => address.slice(2).toLowerCase().padStart(64, "0");

/** A raw `Initialize` log at the given currencies/hooks; the id topic is a fixture, unused by the decoder. */
function initializeLog(currency0: string, currency1: string, hooks: string, block: number) {
  return {
    topics: [INITIALIZE_TOPIC, "0x" + "ab".repeat(32), pad(currency0), pad(currency1)],
    data: "0x" + "0".repeat(64) + "0".repeat(64) + word(hooks) + "0".repeat(128),
    blockNumber: "0x" + block.toString(16),
  };
}

/** A raw `TokenLaunched` log pairing `token` to `pairToken` (the first data word). */
function tokenLaunchedLog(token: string, pairToken: string, block: number) {
  return {
    topics: [TOKEN_LAUNCHED_TOPIC, pad(token), pad(OTHER), pad(OTHER2)],
    data: "0x" + word(pairToken) + "0".repeat(64) + "0".repeat(64),
    blockNumber: "0x" + block.toString(16),
  };
}

function encodeSymbol(symbol: string): `0x${string}` {
  return encodeFunctionResult({ abi: ERC20_SYMBOL_ABI, functionName: "symbol", result: symbol });
}

/** An ABI-encoded `getLaunchedToken` tuple; `overrides` lets a test vary `phase` / `exists`. */
function encodeLaunchedToken(overrides: { phase?: number; exists?: boolean } = {}): `0x${string}` {
  const tuple = {
    token: TOKEN,
    curve: ZERO_ADDRESS,
    deployer: ZERO_ADDRESS,
    creatorFeeRecipient: ZERO_ADDRESS,
    pairToken: NVDA,
    graduationThreshold: 0n,
    poolFee: 0,
    tickSpacing: 0,
    creatorTaxBps: 0,
    buybackEnabled: false,
    phase: 2,
    sweptQuote: 0n,
    sweptTokens: 0n,
    sweptAt: 0n,
    exists: true,
    ...overrides,
  };
  return encodeFunctionResult({
    abi: PONS_FACTORY_ABI,
    functionName: "getLaunchedToken",
    result: tuple as never,
  });
}

describe("readWindowsDelta", () => {
  const realFetch = globalThis.fetch;
  let bodies: RpcCall[] = [];

  afterEach(() => {
    globalThis.fetch = realFetch;
    bodies = [];
  });

  function mockFetch(answer: (call: RpcCall) => RpcAnswer) {
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      const batch = JSON.parse(init?.body ?? "[]") as RpcCall[];
      bodies.push(...batch);
      const out = batch.map((c) => ({ jsonrpc: "2.0", id: c.id, ...answer(c) }));
      return new Response(JSON.stringify(out), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
  }

  it("counts a v4 pool with the ticker at currency1 (Meme hook → pons) and at currency0 (zero hook → plain)", async () => {
    // currency0=OTHER, currency1=NVDA: this is what the currency1 filter (topics[3]) would return.
    const atCurrency1 = initializeLog(OTHER, NVDA, PONS_MEME_HOOK, 10);
    // currency0=NVDA, currency1=OTHER2: this is what the currency0 filter (topics[2]) would return.
    const atCurrency0 = initializeLog(NVDA, OTHER2, ZERO_ADDRESS, 20);
    mockFetch((c) => {
      if (c.method !== "eth_getLogs") return { error: { message: "unexpected" } };
      const topics = (c.params[0] as { topics: unknown[] }).topics;
      if (topics.length === 1) return { result: [] }; // Factory TokenLaunched filter
      if (topics.length === 4) return { result: [atCurrency1] }; // currency1 filter
      return { result: [atCurrency0] }; // currency0 filter
    });

    const delta = await readWindowsDelta([NVDA], RANGE);
    assert.ok(delta);
    const entry = delta.byAddress[NVDA.toLowerCase()];
    assert.ok(entry);
    assert.deepEqual(entry.v4, { pons: 1, plain: 1, other: 0 });
  });

  it("sends the Factory filter and the two PoolManager filters with the padded address at topics index 2 and 3", async () => {
    mockFetch(() => ({ result: [] }));
    await readWindowsDelta([NVDA], RANGE);

    const logCalls = bodies.filter((c) => c.method === "eth_getLogs");
    assert.equal(logCalls.length, 3);

    const factory = logCalls.find(
      (c) => (c.params[0] as { address: string }).address === PONS_FACTORY,
    );
    assert.ok(factory);
    assert.deepEqual((factory.params[0] as { topics: unknown[] }).topics, [TOKEN_LAUNCHED_TOPIC]);

    const poolCalls = logCalls.filter(
      (c) => (c.params[0] as { address: string }).address === UNISWAP_V4_POOL_MANAGER,
    );
    assert.equal(poolCalls.length, 2);
    const currency0Filter = poolCalls.find(
      (c) => (c.params[0] as { topics: unknown[] }).topics.length === 3,
    );
    const currency1Filter = poolCalls.find(
      (c) => (c.params[0] as { topics: unknown[] }).topics.length === 4,
    );
    assert.ok(currency0Filter);
    assert.ok(currency1Filter);
    assert.deepEqual((currency0Filter.params[0] as { topics: unknown[] }).topics, [
      INITIALIZE_TOPIC,
      null,
      pad(NVDA),
    ]);
    assert.deepEqual((currency1Filter.params[0] as { topics: unknown[] }).topics, [
      INITIALIZE_TOPIC,
      null,
      null,
      pad(NVDA),
    ]);
  });

  it("decodes a TokenLaunched pons launch and enriches it with symbol/phase from the follow-up batch", async () => {
    const launched = tokenLaunchedLog(TOKEN, NVDA, 42);
    mockFetch((c) => {
      if (c.method === "eth_getLogs") {
        const topics = (c.params[0] as { topics: unknown[] }).topics;
        return { result: topics.length === 1 ? [launched] : [] };
      }
      if (c.method === "eth_call") {
        const to = (c.params[0] as { to: string }).to;
        if (to.toLowerCase() === TOKEN.toLowerCase()) return { result: encodeSymbol("NVDAX") };
        return { result: encodeLaunchedToken({ phase: 2, exists: true }) };
      }
      return { error: { message: "unexpected" } };
    });

    const delta = await readWindowsDelta([NVDA], RANGE);
    assert.ok(delta);
    const entry = delta.byAddress[NVDA.toLowerCase()];
    assert.ok(entry);
    assert.equal(entry.ponsTotal, 1);
    assert.deepEqual(entry.pons[0], {
      token: TOKEN.toLowerCase(),
      symbol: "NVDAX",
      phase: 2,
      block: 42,
    });
  });

  it("returns null, never a half delta, when a PoolManager filter's entry is missing (errored)", async () => {
    mockFetch((c) => {
      if (c.method !== "eth_getLogs") return { error: { message: "unexpected" } };
      const topics = (c.params[0] as { topics: unknown[] }).topics;
      if (topics.length === 1) return { result: [] }; // Factory: fine
      if (topics.length === 4) return { error: { message: "query timeout" } }; // currency1 filter: fails
      return { result: [] }; // currency0 filter: fine
    });

    const delta = await readWindowsDelta([NVDA], RANGE);
    assert.equal(delta, null);
  });
});

describe("decodePhase", () => {
  it("decodes an existing tuple's phase", () => {
    assert.equal(decodePhase(encodeLaunchedToken({ phase: 2, exists: true })), 2);
  });

  it("returns null for a tuple whose exists is false", () => {
    assert.equal(decodePhase(encodeLaunchedToken({ phase: 2, exists: false })), null);
  });
});

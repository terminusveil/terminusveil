import { CHAIN_ID, RPC_URL, SELECTORS } from "./chain.ts";
import { hexToBigInt } from "./format.ts";
import {
  UI_MULTIPLIER_UPDATED_TOPIC,
  latestMove,
  type BlockWindow,
  type DecodedMove,
  type LastMoveRead,
  type MoveLog,
} from "./last-move.ts";
import { warnGate, warnOnce } from "./log.ts";
import {
  MULTICALL3_ADDRESS,
  MULTICALL_CHUNK,
  decodeAggregate3,
  encodeAggregate3,
  type SubCall,
} from "./multicall.ts";
import { encodePassCall, decodePass } from "./pass.ts";
import type { PassRead, Tape, WireRead } from "./types.ts";
import { decodeCount, decodeLatest, encodeCount, encodeLatest } from "./wire.ts";

type RpcEntry = { jsonrpc: "2.0"; id: number; result?: unknown; error?: { message?: string } };

const CHUNK = 20;
/**
 * eth_getLogs entries: the RPC spent ~0.5 s on each whatever the window, took
 * 14 s on a batch of twenty and then answered 429, so five per request keeps a
 * slice inside the 8 s timeout.
 */
const LOG_CHUNK = 5;
const TRIES = 3;
const FIRST_BACKOFF_MS = 400;
const SLICE_PAUSE_MS = 150;
const DEFAULT_RPC_TIMEOUT_MS = 8_000;
/**
 * The eth_getLogs slices get one try at a 4 s timeout instead of the default
 * three tries at 8 s: a wide fan-out (see LAST_MOVE_FAN_OUT_CAP in desk.ts)
 * across many due names must resolve inside one request's time budget, and a
 * slow provider on this call is better skipped than retried.
 */
const LOG_RPC_TIMEOUT_MS = 4_000;
const LOG_RPC_ATTEMPTS = 1;
/** How often a "retries exhausted" warning can repeat: once per desk refresh cadence. */
const RPC_WARN_WINDOW_MS = 45_000;
const rpcWarnGate = warnGate();

/** `retry` is true for HTTP 429 / 5xx, network errors and timeouts; false for any other HTTP status. */
class RpcError extends Error {
  retry: boolean;
  constructor(message: string, retry: boolean) {
    super(message);
    this.retry = retry;
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The RPC the server reads: the owner's endpoint when `TERMINUS_RPC_URL` is set, else the public one. Server only. */
export function rpcUrl(): string {
  return (typeof process !== "undefined" && process.env.TERMINUS_RPC_URL) || RPC_URL;
}

/**
 * The RPC for `eth_getLogs`: `TERMINUS_LOGS_RPC_URL` when set, else the public
 * one, never the call endpoint by default. Hosted free tiers cap a log query's
 * block range (Alchemy's is ten blocks), which would silently empty the
 * last-move and windows reads; the public RPC takes the wide windows, slowly.
 */
export function logsRpcUrl(): string {
  return (typeof process !== "undefined" && process.env.TERMINUS_LOGS_RPC_URL) || RPC_URL;
}

async function rpc(
  body: unknown,
  timeoutMs = DEFAULT_RPC_TIMEOUT_MS,
  url = rpcUrl(),
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (err) {
    throw new RpcError(err instanceof Error ? err.message : "RPC fetch failed", true);
  }
  if (!res.ok)
    throw new RpcError(`RPC HTTP ${res.status}`, res.status === 429 || res.status >= 500);
  return res.json();
}

/**
 * Sequential slices of `chunk` calls. Each slice is tried up to `attempts`
 * times (default TRIES) on HTTP 429 / 5xx / network error / timeout with
 * 400 → 800 ms backoff, waits up to `timeoutMs` (default 8 s) per try, and
 * slices are spaced SLICE_PAUSE_MS apart. A slice that still fails
 * contributes nothing: its own addresses stay feed-only and carry oracle
 * "unread" or "absent"; every other slice's entries are unaffected.
 */
async function rpcBatch(
  batch: unknown[],
  opts: { chunk?: number; attempts?: number; timeoutMs?: number; url?: string } = {},
): Promise<RpcEntry[]> {
  const chunk = opts.chunk ?? CHUNK;
  const attempts = opts.attempts ?? TRIES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS;
  const url = opts.url ?? rpcUrl();
  const out: RpcEntry[] = [];
  for (let i = 0; i < batch.length; i += chunk) {
    if (i > 0) await sleep(SLICE_PAUSE_MS);
    const slice = batch.slice(i, i + chunk);
    let delay = FIRST_BACKOFF_MS;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const raw = (await rpc(slice, timeoutMs, url)) as RpcEntry[];
        if (Array.isArray(raw)) out.push(...raw);
        break;
      } catch (err) {
        const giveUp = (err instanceof RpcError && !err.retry) || attempt >= attempts;
        if (giveUp) {
          warnOnce(
            rpcWarnGate,
            RPC_WARN_WINDOW_MS,
            Date.now(),
            "[relay] rpcBatch retries exhausted",
            {
              size: slice.length,
              message: err instanceof Error ? err.message : String(err),
            },
          );
          break;
        }
        await sleep(delay);
        delay *= 2;
      }
    }
  }
  return out;
}

/** The entry's result when it is a hex string; null for an error, a miss, or any other shape. */
function hexResult(entry: RpcEntry | undefined): string | null {
  if (!entry || entry.error || typeof entry.result !== "string") return null;
  return entry.result;
}

export { rpcBatch, hexResult };

/**
 * Every sub-call's return data through Multicall3: MULTICALL_CHUNK sub-calls
 * per `eth_call`, all the calls in one JSON-RPC batch, so a refresh costs a
 * handful of requests however many names are on the clock. A sub-call that
 * reverted or answered bare `0x` is null; so is every sub-call of a chunk
 * whose entry errored, went missing, or did not decode. Never throws.
 */
export async function multicall(calls: SubCall[]): Promise<(`0x${string}` | null)[]> {
  const out: (`0x${string}` | null)[] = new Array(calls.length).fill(null);
  if (calls.length === 0) return out;
  const batch: { jsonrpc: "2.0"; id: number; method: "eth_call"; params: unknown[] }[] = [];
  for (let i = 0; i < calls.length; i += MULTICALL_CHUNK) {
    batch.push({
      jsonrpc: "2.0",
      id: batch.length + 1,
      method: "eth_call",
      params: [
        { to: MULTICALL3_ADDRESS, data: encodeAggregate3(calls.slice(i, i + MULTICALL_CHUNK)) },
        "latest",
      ],
    });
  }
  const byId = new Map((await rpcBatch(batch)).map((r) => [r.id, r]));
  batch.forEach((entry, chunkIndex) => {
    const hex = hexResult(byId.get(entry.id));
    if (hex === null) return;
    let decoded: (`0x${string}` | null)[];
    try {
      decoded = decodeAggregate3(hex as `0x${string}`);
    } catch {
      return;
    }
    decoded.forEach((r, j) => {
      out[chunkIndex * MULTICALL_CHUNK + j] = r;
    });
  });
  return out;
}

/**
 * `eth_chainId` and `eth_blockNumber` in one batch, with the batch transport's
 * retries: an absent tape sends the whole desk to the snapshot, so one
 * throttled or dropped answer must not decide it.
 */
export async function readTapeRaw(): Promise<Tape> {
  try {
    const raw = await rpcBatch([
      { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
      { jsonrpc: "2.0", id: 2, method: "eth_blockNumber", params: [] },
    ]);
    const chainHex = hexResult(raw.find((r) => r.id === 1));
    const blockHex = hexResult(raw.find((r) => r.id === 2));
    const chainId = chainHex ? Number(BigInt(chainHex)) : null;
    const block = blockHex ? Number(BigInt(blockHex)) : null;
    if (chainId !== CHAIN_ID) {
      return {
        chainId,
        block,
        absent: true,
        reason: chainId === null ? "RPC did not answer." : `Unexpected chain id ${chainId}.`,
      };
    }
    return { chainId, block, absent: false, reason: null };
  } catch {
    return { chainId: null, block: null, absent: true, reason: "RPC did not answer." };
  }
}

/** A reading younger than this is served from cache; a curl loop cannot multiply the RPC calls it costs. */
export const TAPE_CACHE_MS = 30_000;

export type TapeReader = { readTape: () => Promise<Tape> };

/**
 * `readTape` memoised for `TAPE_CACHE_MS`, with an in-flight read shared by
 * concurrent callers. `now` and `readRaw` are injectable so the cache window
 * can be tested against a fake clock, no network.
 */
export function createTapeReader(
  deps: { now?: () => number; readRaw?: () => Promise<Tape> } = {},
): TapeReader {
  const clock = deps.now ?? Date.now;
  const raw = deps.readRaw ?? readTapeRaw;
  let cache: { at: number; data: Tape } | null = null;
  let inflight: Promise<Tape> | null = null;

  async function readTape(): Promise<Tape> {
    const t = clock();
    if (cache && t - cache.at < TAPE_CACHE_MS) return cache.data;
    if (inflight) return inflight;
    inflight = raw()
      .then((data) => {
        cache = { at: t, data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  }

  return { readTape };
}

const tapeReader = createTapeReader();

/** The process-wide tape reader, memoised for TAPE_CACHE_MS. */
export const readTape: TapeReader["readTape"] = tapeReader.readTape;

export type OnchainRead = {
  address: `0x${string}`;
  live: bigint | null;
  staged: bigint | null;
  effectiveAtSec: number | null;
  paused: boolean | null;
  transferPaused: boolean | null;
};

const MULTIPLIER_FIELDS = [
  ["live", SELECTORS.uiMultiplier],
  ["staged", SELECTORS.newUIMultiplier],
  ["at", SELECTORS.effectiveAt],
  ["paused", SELECTORS.oraclePaused],
  ["transferPaused", SELECTORS.transferPaused],
] as const;

/**
 * The five reads per token, all through `multicall`. Every address gets a row;
 * a field whose sub-call did not answer stays null, and an address whose whole
 * chunk failed stays unread on every field.
 */
export async function readMultipliers(
  addresses: `0x${string}`[],
): Promise<Map<string, OnchainRead>> {
  const out = new Map<string, OnchainRead>();
  if (addresses.length === 0) return out;

  const calls: SubCall[] = addresses.flatMap((address) =>
    MULTIPLIER_FIELDS.map(([, data]) => ({ target: address, callData: data })),
  );
  const results = await multicall(calls);

  for (const address of addresses) {
    out.set(address.toLowerCase(), {
      address,
      live: null,
      staged: null,
      effectiveAtSec: null,
      paused: null,
      transferPaused: null,
    });
  }
  results.forEach((hex, i) => {
    const address = addresses[Math.floor(i / MULTIPLIER_FIELDS.length)];
    const field = MULTIPLIER_FIELDS[i % MULTIPLIER_FIELDS.length]?.[0];
    const row = address === undefined ? undefined : out.get(address.toLowerCase());
    if (!row || field === undefined) return;
    const n = hexToBigInt(hex);
    if (n === null) return;
    if (field === "live") row.live = n;
    else if (field === "staged") row.staged = n;
    else if (field === "at") row.effectiveAtSec = Number(n);
    else if (field === "transferPaused") row.transferPaused = n !== 0n;
    else row.paused = n !== 0n;
  });
  return out;
}

const blockHex = (n: number) => "0x" + Math.max(0, Math.floor(n)).toString(16);

/**
 * The latest `UIMultiplierUpdated` per contract inside `window`: one bounded
 * eth_getLogs per address, then one eth_getBlockByNumber per distinct block for
 * its time. An address whose query failed or found nothing is left out; a block
 * whose read failed leaves `blockTimeSec` null. Never throws.
 */
export async function readLastMoves(
  addresses: `0x${string}`[],
  window: BlockWindow,
): Promise<Map<string, LastMoveRead>> {
  const out = new Map<string, LastMoveRead>();
  if (addresses.length === 0) return out;

  const logCalls = addresses.map((address, i) => ({
    jsonrpc: "2.0",
    id: i + 1,
    method: "eth_getLogs",
    params: [
      {
        address,
        topics: [UI_MULTIPLIER_UPDATED_TOPIC],
        fromBlock: blockHex(window.fromBlock),
        toBlock: blockHex(window.toBlock),
      },
    ],
  }));
  const logsById = new Map(
    (
      await rpcBatch(logCalls, {
        chunk: LOG_CHUNK,
        attempts: LOG_RPC_ATTEMPTS,
        timeoutMs: LOG_RPC_TIMEOUT_MS,
        url: logsRpcUrl(),
      })
    ).map((r) => [r.id, r]),
  );
  const picked = new Map<string, DecodedMove>();
  addresses.forEach((address, i) => {
    const entry = logsById.get(i + 1);
    if (!entry || entry.error || !Array.isArray(entry.result)) return;
    const move = latestMove(entry.result as MoveLog[]);
    if (move) picked.set(address.toLowerCase(), move);
  });
  if (picked.size === 0) return out;

  const blocks = [...new Set([...picked.values()].map((m) => m.blockNumber))];
  const blockCalls = blocks.map((b, i) => ({
    jsonrpc: "2.0",
    id: i + 1,
    method: "eth_getBlockByNumber",
    params: [blockHex(b), false],
  }));
  const timeByBlock = new Map<number, number>();
  for (const entry of await rpcBatch(blockCalls)) {
    const block = blocks[entry.id - 1];
    if (block === undefined || entry.error) continue;
    const ts = hexToBigInt((entry.result as { timestamp?: string } | null)?.timestamp);
    if (ts !== null) timeByBlock.set(block, Number(ts));
  }

  for (const [key, m] of picked) {
    out.set(key, {
      oldWad: m.oldWad,
      newWad: m.newWad,
      effectiveAtSec: m.effectiveAtSec,
      blockNumber: m.blockNumber,
      blockTimeSec: timeByBlock.get(m.blockNumber) ?? null,
    });
  }
  return out;
}

export type WireFacts = { address: `0x${string}`; poster: `0x${string}` };

/**
 * The poster's latest post per ticker, one `latest()` sub-call each through
 * `multicall`.
 *
 * A ticker gets a key only when its sub-call came back with call data: the
 * value is the decoded post, or null when the tuple is all zero (the poster
 * has posted nothing for that ticker). A sub-call that reverted, answered bare
 * `0x`, or went missing with its chunk leaves the key absent. The caller tells
 * "the read did not run" from "nothing posted yet" by the key's presence, never
 * by the value — `multicall` returns what it has and never throws.
 */
export async function readWire(
  wire: WireFacts,
  tickers: string[],
): Promise<Map<string, WireRead | null>> {
  const out = new Map<string, WireRead | null>();
  if (tickers.length === 0) return out;
  const results = await multicall(
    tickers.map((t) => ({ target: wire.address, callData: encodeLatest(wire.poster, t) })),
  );
  tickers.forEach((t, i) => {
    const hex = results[i];
    if (hex === null || hex === undefined) return;
    out.set(t, decodeLatest(hex));
  });
  return out;
}

export type WireStatus = { count: number | null; posterBalanceWei: string | null };

/** The poster's post count and ETH balance; null fields when a call did not decode. */
export async function readWireStatus(wire: WireFacts): Promise<WireStatus> {
  const raw = await rpcBatch([
    {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: wire.address, data: encodeCount(wire.poster) }, "latest"],
    },
    { jsonrpc: "2.0", id: 2, method: "eth_getBalance", params: [wire.poster, "latest"] },
  ]);
  const byId = new Map(raw.map((r) => [r.id, r]));
  const balance = hexToBigInt(hexResult(byId.get(2)));
  return {
    count: decodeCount(hexResult(byId.get(1))),
    posterBalanceWei: balance === null ? null : balance.toString(),
  };
}

/** VeilPass's price, burn share, period and house wallet in one batch; null unless all four decode. */
export async function readPass(address: `0x${string}`): Promise<PassRead | null> {
  const calls = (["price", "burnBps", "PERIOD", "house"] as const).map((name, i) => ({
    jsonrpc: "2.0",
    id: i + 1,
    method: "eth_call",
    params: [{ to: address, data: encodePassCall(name) }, "latest"],
  }));
  const byId = new Map((await rpcBatch(calls)).map((r) => [r.id, r]));
  return decodePass(address, {
    price: hexResult(byId.get(1)),
    burnBps: hexResult(byId.get(2)),
    period: hexResult(byId.get(3)),
    house: hexResult(byId.get(4)),
  });
}

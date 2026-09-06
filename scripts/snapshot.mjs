#!/usr/bin/env node
/**
 * Capture one real reading of the Robinhood Chain stock-token tape into
 * data/snapshot/ so the desk can render the last known reading, labelled and
 * dated, when the live tape does not answer.
 *
 * Run from a network that can reach robinhood.com (Vercel can; some ISPs
 * cannot):  npm run snapshot
 *
 * Writes raw upstream responses, not derived values, so the same parsing
 * code that serves the live tape serves the snapshot:
 *   assets.json             GET https://api.robinhood.com/rhj/assets
 *   corporate-actions.json  GET https://api.robinhood.com/rhj/corporate-actions
 *   tape.json               eth_chainId + eth_blockNumber (raw JSON-RPC entries)
 *   multipliers.json        eth_call results per contract: { [address]: { live, staged, at, paused } } (hex strings)
 *   prices.json             GET /rhj/prices/{symbol} per asset: { [ticker]: response | null }
 *   last-moves.json         eth_getLogs UIMultiplierUpdated per contract that can be due (an in-progress
 *                           action, or a staged figure that differs from live), same window the live desk
 *                           scans: { [address]: { log: <raw log>, blockTimestamp: hex | null } | null }
 *   meta.json               { readAt, chainId, block, assets, actions, contracts, prices, lastMoves }
 *
 * Imports the desk's own log decoder from src (a .ts module), so run it as
 * `npm run snapshot` (node --experimental-strip-types; a no-op on Node >= 22.18).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  UI_MULTIPLIER_UPDATED_TOPIC,
  blockWindow,
  latestMoveLog,
} from "../src/lib/terminus/last-move.ts";

const RHJ_API = "https://api.robinhood.com/rhj";
const RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
const CHAIN_ID = 4663;
const SELECTORS = {
  live: "0xa60bf13d", // uiMultiplier()
  staged: "0xdc767007", // newUIMultiplier()
  at: "0x97a4064f", // effectiveAt()
  paused: "0x7706ba52", // oraclePaused()
  transferPaused: "0x5c975abb", // paused()
};
const CHUNK = 20;
/** eth_getLogs: the RPC spends ~0.5 s per entry and answers 429 to a batch of twenty. */
const LOG_CHUNK = 5;
const PRICE_CONCURRENCY = 2;

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, "data", "snapshot");
mkdirSync(out, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch JSON; retry 429 / 5xx / network errors with exponential backoff (5 tries). */
async function getJson(url, init = {}) {
  let delay = 600;
  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { accept: "application/json", ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`${url} -> HTTP ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`${url} -> HTTP ${res.status}`), { fatal: true });
      return await res.json();
    } catch (err) {
      if (err?.fatal || attempt >= 5) throw err;
      console.log(`[snapshot] retry ${attempt}/4 after ${delay} ms: ${err?.message ?? err}`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

function rpcBody(entries) {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(entries),
  };
}

function write(name, value) {
  writeFileSync(join(out, name), JSON.stringify(value, null, 2) + "\n");
  console.log(`[snapshot] wrote data/snapshot/${name}`);
}

const readAt = new Date().toISOString();

console.log("[snapshot] issuer feed");
const assets = await getJson(`${RHJ_API}/assets`);
const actions = await getJson(`${RHJ_API}/corporate-actions`);
if (!Array.isArray(assets?.assets)) throw new Error("assets response has no `assets` array");
if (!Array.isArray(actions?.corpActions))
  throw new Error("corporate-actions response has no `corpActions` array");

console.log("[snapshot] chain tape");
const tapeRaw = await getJson(
  RPC_URL,
  rpcBody([
    { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
    { jsonrpc: "2.0", id: 2, method: "eth_blockNumber", params: [] },
  ]),
);
const chainHex = tapeRaw.find((r) => r.id === 1)?.result;
const blockHex = tapeRaw.find((r) => r.id === 2)?.result;
const chainId = chainHex ? Number(BigInt(chainHex)) : null;
const block = blockHex ? Number(BigInt(blockHex)) : null;
if (chainId !== CHAIN_ID) throw new Error(`unexpected chain id ${chainId}`);

const contracts = [];
for (const a of assets.assets) {
  if (a.status === "ASSET_STATUS_INACTIVE") continue;
  const dep = (a.deployments ?? []).find((d) => d.chainId === CHAIN_ID);
  const address = dep?.contractAddress;
  if (a.tokenSymbol && address && address.startsWith("0x") && address.length >= 42) {
    contracts.push({ ticker: a.tokenSymbol.toUpperCase(), address });
  }
}

console.log(`[snapshot] ${contracts.length} contracts × 4 reads`);
const batch = [];
const index = [];
let id = 1;
for (const { address } of contracts) {
  for (const [field, data] of Object.entries(SELECTORS)) {
    // Pinned to the captured block so every read agrees with tape.json.
    batch.push({
      jsonrpc: "2.0",
      id,
      method: "eth_call",
      params: [{ to: address, data }, blockHex],
    });
    index.push({ id, address, field });
    id += 1;
  }
}
const byId = new Map();
for (let i = 0; i < batch.length; i += CHUNK) {
  const raw = await getJson(RPC_URL, rpcBody(batch.slice(i, i + CHUNK)));
  for (const r of Array.isArray(raw) ? raw : []) byId.set(r.id, r);
  await sleep(500);
}
const multipliers = {};
for (const item of index) {
  const entry = byId.get(item.id);
  const row = (multipliers[item.address.toLowerCase()] ??= {
    live: null,
    staged: null,
    at: null,
    paused: null,
  });
  row[item.field] = entry && entry.result && !entry.error ? entry.result : null;
}

// Last move: the names that can be due are those with an in-progress action or
// a staged figure that differs from live. Same window as the live desk, pinned
// to the captured block; the latest raw log is kept with its block's timestamp.
const inProgress = new Set(
  actions.corpActions
    .filter((a) => String(a.status ?? "").includes("IN_PROGRESS"))
    .map((a) => String(a.tokenSymbol ?? "").toUpperCase()),
);
const moveContracts = contracts.filter(({ ticker, address }) => {
  const m = multipliers[address.toLowerCase()];
  const stagedDiffers = Boolean(
    m?.staged && m?.live && BigInt(m.staged) !== 0n && m.staged !== m.live,
  );
  return inProgress.has(ticker) || stagedDiffers;
});
const window = blockWindow(block);
const hex = (n) => "0x" + n.toString(16);
console.log(
  `[snapshot] ${moveContracts.length} contracts × last move, blocks ${window.fromBlock}..${window.toBlock}`,
);
const lastMoves = {};
for (const { address } of moveContracts) lastMoves[address.toLowerCase()] = null;
for (let i = 0; i < moveContracts.length; i += LOG_CHUNK) {
  const slice = moveContracts.slice(i, i + LOG_CHUNK);
  const body = rpcBody(
    slice.map(({ address }, j) => ({
      jsonrpc: "2.0",
      id: j + 1,
      method: "eth_getLogs",
      params: [
        {
          address,
          topics: [UI_MULTIPLIER_UPDATED_TOPIC],
          fromBlock: hex(window.fromBlock),
          toBlock: hex(window.toBlock),
        },
      ],
    })),
  );
  let raw = null;
  for (let attempt = 1; attempt <= 3 && !Array.isArray(raw); attempt += 1) {
    if (attempt > 1) await sleep(3_000 * attempt);
    raw = await getJson(RPC_URL, body);
    if (!Array.isArray(raw))
      console.log(`[snapshot] getLogs slice answered ${JSON.stringify(raw).slice(0, 120)}`);
  }
  for (const r of Array.isArray(raw) ? raw : []) {
    const address = slice[r.id - 1]?.address;
    const log = Array.isArray(r.result) ? latestMoveLog(r.result) : null;
    if (address && log) lastMoves[address.toLowerCase()] = { log, blockTimestamp: null };
  }
  await sleep(1_000);
}
const moveBlocks = [
  ...new Set(
    Object.values(lastMoves)
      .filter(Boolean)
      .map((m) => m.log.blockNumber),
  ),
];
if (moveBlocks.length > 0) {
  const raw = await getJson(
    RPC_URL,
    rpcBody(
      moveBlocks.map((b, i) => ({
        jsonrpc: "2.0",
        id: i + 1,
        method: "eth_getBlockByNumber",
        params: [b, false],
      })),
    ),
  );
  const timeByBlock = new Map();
  for (const r of Array.isArray(raw) ? raw : []) {
    const b = moveBlocks[r.id - 1];
    if (b && r.result?.timestamp && !r.error) timeByBlock.set(b, r.result.timestamp);
  }
  for (const m of Object.values(lastMoves)) {
    if (m) m.blockTimestamp = timeByBlock.get(m.log.blockNumber) ?? null;
  }
}
const moveCount = Object.values(lastMoves).filter(Boolean).length;
console.log(`[snapshot] ${moveCount} last moves found`);

console.log(`[snapshot] ${contracts.length} quotes`);
const prices = {};
for (let i = 0; i < contracts.length; i += PRICE_CONCURRENCY) {
  const slice = contracts.slice(i, i + PRICE_CONCURRENCY);
  const results = await Promise.all(
    slice.map(async ({ ticker }) => {
      try {
        return [ticker, await getJson(`${RHJ_API}/prices/${encodeURIComponent(ticker)}`)];
      } catch {
        return [ticker, null];
      }
    }),
  );
  for (const [ticker, quote] of results) prices[ticker] = quote;
  await new Promise((r) => setTimeout(r, 350));
}

write("assets.json", assets);
write("corporate-actions.json", actions);
write("tape.json", tapeRaw);
write("multipliers.json", multipliers);
write("prices.json", prices);
write("last-moves.json", lastMoves);
write("meta.json", {
  readAt,
  chainId,
  block,
  assets: assets.assets.length,
  actions: actions.corpActions.length,
  contracts: contracts.length,
  prices: Object.values(prices).filter(Boolean).length,
  lastMoves: {
    contracts: moveContracts.length,
    moves: moveCount,
    fromBlock: window.fromBlock,
    toBlock: window.toBlock,
  },
});
console.log(`[snapshot] done — read ${readAt}, block ${block}`);

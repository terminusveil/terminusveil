#!/usr/bin/env node
/**
 * Capture the windows index: for every stock token the desk reads, the pons
 * launches paired to it (Factory TokenLaunched, decoded; pairToken is not a
 * topic) and the Uniswap v4 pools that hold it (PoolManager Initialize,
 * bucketed by currency and classed by hook). Writes data/windows/index.json,
 * dated and stamped with the block it read to.
 *
 * Run from a network that reaches the RPC, or with TERMINUS_RPC_URL set to an
 * endpoint of your own:   TERMINUS_RPC_URL=… npm run windows
 *
 * Both sources are crawled in adaptive block chunks (halved on an error or a
 * cap, doubled after a light chunk). Progress is saved to
 * data/windows/progress.json (gitignored) every few chunks, so an interrupted
 * run resumes. A chunk that still fails at the smallest size is skipped and
 * the index is marked capped.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  INDEX_LAUNCH_CAP,
  INITIALIZE_TOPIC,
  PONS_FACTORY,
  PONS_V2_START_BLOCK,
  TOKEN_LAUNCHED_TOPIC,
  UNISWAP_V4_POOL_MANAGER,
  classifyHook,
  decodeInitialize,
  decodeTokenLaunched,
  emptyEntry,
  sortLaunches,
} from "../src/lib/terminus/windows.ts";
import { readLaunchDetails } from "../src/lib/terminus/windows-read.ts";

const PUBLIC_RPC = "https://rpc.mainnet.chain.robinhood.com";
/** Calls (symbol, phase) go to the owner's endpoint when set; logs go to the public RPC unless TERMINUS_LOGS_RPC_URL says otherwise: hosted free tiers cap a log query at a few blocks. */
const RPC_URL = process.env.TERMINUS_RPC_URL || PUBLIC_RPC;
const LOGS_RPC_URL = process.env.TERMINUS_LOGS_RPC_URL || PUBLIC_RPC;
/** A 429 or a 5xx is a wait, not a smaller chunk: the range was fine, the provider was busy. */
const BUSY_WAIT_MS = [5_000, 10_000, 20_000, 30_000, 60_000, 60_000];
const CHAIN_ID = 4663;
const START_CHUNK = 20_000;
const MIN_CHUNK = 500;
const MAX_CHUNK = 200_000;
const HEAVY = 5_000;
const LIGHT = 1_000;
const SAVE_EVERY = 10;

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "data", "windows");
mkdirSync(outDir, { recursive: true });
const progressPath = join(outDir, "progress.json");
const indexPath = join(outDir, "index.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (n) => "0x" + n.toString(16);

async function rpc(body, url = RPC_URL) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok)
    throw Object.assign(new Error(`HTTP ${res.status}`), {
      busy: res.status === 429 || res.status >= 500,
    });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "rpc error");
  return json.result;
}

// Addresses: the snapshot's assets on this chain, plus the desk's fallbacks.
const assets = JSON.parse(readFileSync(join(root, "data", "snapshot", "assets.json"), "utf8"));
const addresses = new Set();
for (const a of assets.assets ?? []) {
  const dep = (a.deployments ?? []).find((d) => d.chainId === CHAIN_ID);
  if (dep?.contractAddress?.startsWith("0x")) addresses.add(dep.contractAddress.toLowerCase());
}
console.log(`[windows] ${addresses.size} ticker addresses`);

const chainId = Number(
  BigInt(await rpc({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] })),
);
if (chainId !== CHAIN_ID) throw new Error(`unexpected chain id ${chainId}`);
const head = Number(
  BigInt(await rpc({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] })),
);

const progress = existsSync(progressPath)
  ? JSON.parse(readFileSync(progressPath, "utf8"))
  : { head, factoryBlock: PONS_V2_START_BLOCK - 1, poolBlock: 0, capped: false, byAddress: {} };
if (progress.head !== head && existsSync(progressPath)) {
  console.log(`[windows] resuming a run that targeted block ${progress.head}; keeping that head`);
}
const target = progress.head;
const entry = (k) => (progress.byAddress[k] ??= { pons: [], v4: { pons: 0, plain: 0, other: 0 } });
/** Tmp + rename: an interrupt mid-write must not leave a half-written resume file. */
const save = () => {
  const tmp = `${progressPath}.tmp`;
  writeFileSync(tmp, JSON.stringify(progress));
  renameSync(tmp, progressPath);
};

/** Crawl one source from `from` to `target`, calling onLog per log; returns when done. */
async function crawl(label, address, topic, fromKey, startBlock, onLog) {
  let chunk = START_CHUNK;
  let n = 0;
  const checkpoint = (to) => {
    n += 1;
    if (n % SAVE_EVERY === 0) {
      save();
      console.log(
        `[windows] ${label} to block ${to} (${(((to - startBlock) / (target - startBlock)) * 100).toFixed(1)} %)`,
      );
    }
  };
  let busy = 0;
  while (progress[fromKey] < target) {
    const from = progress[fromKey] + 1;
    const to = Math.min(target, from + chunk - 1);
    let logs = null;
    try {
      logs = await rpc(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getLogs",
          params: [{ address, topics: [topic], fromBlock: hex(from), toBlock: hex(to) }],
        },
        LOGS_RPC_URL,
      );
      busy = 0;
    } catch (err) {
      if (err.busy) {
        // A rate limit says nothing about the range: wait, and if the provider
        // stays busy, stop with progress saved rather than shrink or skip a
        // block range that was never the problem.
        if (busy < BUSY_WAIT_MS.length) {
          const wait = BUSY_WAIT_MS[busy];
          busy += 1;
          console.log(
            `[windows] ${label} ${from}..${to} busy (${err.message}); waiting ${wait / 1000} s`,
          );
          await sleep(wait);
          continue;
        }
        save();
        throw new Error(
          `${label} ${from}..${to}: the RPC stayed busy; progress saved, run again later`,
        );
      }
      if (chunk > MIN_CHUNK) {
        chunk = Math.max(MIN_CHUNK, Math.floor(chunk / 2));
        console.log(`[windows] ${label} ${from}..${to} failed (${err.message}); chunk → ${chunk}`);
        await sleep(1_000);
        continue;
      }
      console.log(
        `[windows] ${label} ${from}..${to} skipped at the smallest chunk; index marked capped`,
      );
      if (!progress.capped) {
        progress.capped = true;
        save();
      }
      progress[fromKey] = to;
      checkpoint(to);
      await sleep(1_000);
      continue;
    }
    for (const log of logs) onLog(log);
    progress[fromKey] = to;
    if (logs.length >= HEAVY && chunk > MIN_CHUNK)
      chunk = Math.max(MIN_CHUNK, Math.floor(chunk / 2));
    else if (logs.length < LIGHT && chunk < MAX_CHUNK) chunk = Math.min(MAX_CHUNK, chunk * 2);
    checkpoint(to);
    await sleep(LOGS_RPC_URL === PUBLIC_RPC ? 1_000 : 150);
  }
  save();
}

await crawl(
  "factory",
  PONS_FACTORY,
  TOKEN_LAUNCHED_TOPIC,
  "factoryBlock",
  PONS_V2_START_BLOCK,
  (log) => {
    const d = decodeTokenLaunched(log);
    if (d && addresses.has(d.pairToken))
      entry(d.pairToken).pons.push({ token: d.token, symbol: null, phase: null, block: d.block });
  },
);
await crawl("pools", UNISWAP_V4_POOL_MANAGER, INITIALIZE_TOPIC, "poolBlock", 0, (log) => {
  const d = decodeInitialize(log);
  if (!d) return;
  const cls = classifyHook(d.hooks);
  for (const c of [d.currency0, d.currency1]) if (addresses.has(c)) entry(c).v4[cls] += 1;
});

// Details for the launches kept per address (newest INDEX_LAUNCH_CAP by block).
const byAddress = {};
for (const [k, e] of Object.entries(progress.byAddress)) {
  const kept = [...e.pons].sort((a, b) => b.block - a.block).slice(0, INDEX_LAUNCH_CAP);
  byAddress[k] = {
    ...emptyEntry(),
    pons: kept,
    ponsTotal: e.pons.length,
    v4: e.v4,
    capped: progress.capped,
  };
}
const tokens = Object.values(byAddress).flatMap((e) => e.pons.map((p) => p.token));
console.log(`[windows] ${tokens.length} launches × symbol + phase`);
process.env.TERMINUS_RPC_URL ??= RPC_URL;
// Eight tokens (sixteen calls) a second stays under a hosted free tier's per-second budget.
for (let i = 0; i < tokens.length; i += 8) {
  if (i % 400 === 0) console.log(`[windows] details ${i}/${tokens.length}`);
  const details = await readLaunchDetails(tokens.slice(i, i + 8));
  for (const e of Object.values(byAddress)) {
    for (const p of e.pons) {
      const d = details.get(p.token.toLowerCase());
      if (d) {
        p.symbol = d.symbol;
        p.phase = d.phase;
      }
    }
  }
  await sleep(1_000);
}
for (const e of Object.values(byAddress)) e.pons = sortLaunches(e.pons);

const index = {
  readAt: new Date().toISOString(),
  toBlock: target,
  byAddress: Object.fromEntries(Object.entries(byAddress).sort()),
};
const indexTmpPath = `${indexPath}.tmp`;
writeFileSync(indexTmpPath, JSON.stringify(index, null, 2) + "\n");
renameSync(indexTmpPath, indexPath);
unlinkSync(progressPath);
const holes = Object.values(byAddress).reduce(
  (n, e) => n + e.pons.filter((l) => l.symbol === null).length,
  0,
);
if (holes > 0) {
  console.log(
    `[windows] ${holes} launches without a symbol (calls that did not answer); rerun to fill them`,
  );
}
console.log(
  `[windows] wrote data/windows/index.json · to block ${target} · ${Object.keys(byAddress).length} addresses with windows`,
);

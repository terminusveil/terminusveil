import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { CHAIN_ID, CHAIN_NAME } from "./chain.ts";
import { buildDesk } from "./desk.ts";
import { wireFacts } from "./house.ts";
import { readWire, rpcUrl, type WireFacts } from "./relay-live.ts";
import type { DeskPayload, WireRead } from "./types.ts";
import { WIRE_ABI, tickerBytes32 } from "./wire.ts";
import { planPosts, type WirePost } from "./wire-post.ts";

export type WireRunResult = {
  posted: number;
  skipped: number;
  txHash: `0x${string}` | null;
  /** The block the transaction landed in; null when the receipt wait timed out (the next run reads the chain and skips what landed). */
  block: number | null;
  reason: string | null;
};

/** What a receipt has to say for the run to report a block or a revert. */
export type WireReceipt = { status: "success" | "reverted"; blockNumber: bigint };

/**
 * Everything the run reaches outside itself. The default set is the real one;
 * tests pass their own so no test touches the network or holds a key.
 */
export type WireRunDeps = {
  /** The Wire facts as pasted; null when the Wire is not live. */
  facts: () => WireFacts | null;
  desk: () => Promise<DeskPayload>;
  readWire: (facts: WireFacts, tickers: string[]) => Promise<Map<string, WireRead | null>>;
  /** Signs and broadcasts one `postMany`; the hash it returns is what the run reports. */
  post: (
    account: PrivateKeyAccount,
    facts: WireFacts,
    posts: readonly WirePost[],
  ) => Promise<`0x${string}`>;
  /** The receipt for that hash; throws when the wait times out. */
  receipt: (hash: `0x${string}`) => Promise<WireReceipt>;
};

const RECEIPT_WAIT_MS = 20_000;
let inflight: Promise<WireRunResult> | null = null;

function robinhoodChain() {
  return defineChain({
    id: CHAIN_ID,
    name: CHAIN_NAME,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl()] } },
  });
}

const REAL: WireRunDeps = {
  facts: () => wireFacts(),
  desk: () => buildDesk(),
  readWire: (facts, tickers) => readWire(facts, tickers),
  post: (account, facts, posts) => {
    const transport = http(rpcUrl());
    const wallet = createWalletClient({ account, chain: robinhoodChain(), transport });
    return wallet.writeContract({
      address: facts.address,
      abi: WIRE_ABI,
      functionName: "postMany",
      args: [
        posts.map((p) => tickerBytes32(p.ticker)),
        posts.map((p) => BigInt(p.staged)),
        posts.map((p) => BigInt(p.terminus)),
      ],
    });
  },
  receipt: async (hash) => {
    const transport = http(rpcUrl());
    const reader = createPublicClient({ chain: robinhoodChain(), transport });
    const receipt = await reader.waitForTransactionReceipt({ hash, timeout: RECEIPT_WAIT_MS });
    return { status: receipt.status, blockNumber: receipt.blockNumber };
  },
};

/**
 * One run at a time within this instance: a second caller shares the
 * in-flight run — and its dependencies, so `over` is read only by the caller
 * that starts one. The guard is per-lambda-instance, not global — cron and the
 * external pinger can land in two separate instances and both attempt to
 * sign at the same pending nonce. That is bounded, not unsafe: the second
 * instance either re-reads a landed post via `readWire`/`planPosts` and
 * skips it, or broadcasts at the same nonce and is rejected by the RPC (a
 * 500, never a double post). The next run reconciles by content either way.
 */
export function runWirePost(over: Partial<WireRunDeps> = {}): Promise<WireRunResult> {
  if (inflight) return inflight;
  inflight = run({ ...REAL, ...over }).finally(() => {
    inflight = null;
  });
  return inflight;
}

/** How long a served read waits before it may trigger the poster again, per server instance. */
export const SELF_POST_INTERVAL_MS = 30 * 60_000;
let lastSelfPostAt = 0;

/** Tests only: forget the last self-post attempt. */
export function resetSelfPost(): void {
  lastSelfPostAt = 0;
}

/**
 * The desk posts on its own. Every served read past SELF_POST_INTERVAL_MS
 * since this instance's last attempt starts one run, so any reader, the
 * uptime pinger or Vercel's daily cron keeps the Wire moving without a
 * scheduler that holds the key. The run broadcasts and returns; the receipt
 * is never awaited here (the next run reads the chain and skips what landed),
 * so a reader waits for one signature at most. Never throws.
 */
export async function selfPost(
  now = Date.now(),
  over: Partial<WireRunDeps> = {},
  env: { WIRE_POSTER_KEY?: string } = process.env,
): Promise<WireRunResult | null> {
  if (!env.WIRE_POSTER_KEY) return null;
  if (now - lastSelfPostAt < SELF_POST_INTERVAL_MS) return null;
  lastSelfPostAt = now;
  try {
    const result = await runWirePost({
      ...over,
      receipt: async () => {
        throw new Error("self-post does not wait for the receipt");
      },
    });
    if (result.posted > 0 || result.reason) console.info("[wire] self-post", result);
    return result;
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).replaceAll(
      rpcUrl(),
      "<rpc>",
    );
    console.warn("[wire] self-post failed", { message: message.slice(0, 200) });
    return null;
  }
}

const none = (reason: string): WireRunResult => ({
  posted: 0,
  skipped: 0,
  txHash: null,
  block: null,
  reason,
});

async function run(deps: WireRunDeps): Promise<WireRunResult> {
  const facts = deps.facts();
  if (!facts) return none("wire not live");
  const key = process.env.WIRE_POSTER_KEY;
  if (!key) return none("WIRE_POSTER_KEY unset");
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return none("WIRE_POSTER_KEY malformed");
  const account = privateKeyToAccount(key as `0x${string}`);
  if (account.address.toLowerCase() !== facts.poster.toLowerCase())
    return none("WIRE_POSTER_KEY is not the pasted poster");

  const desk = await deps.desk();
  if (desk.source !== "live") return none("desk is a snapshot");
  // Every name with an address: the planner posts whatever the contract holds,
  // whatever the row's state (house decision 2026-09-06: every read is posted).
  const rows = desk.rows.filter((r) => r.address !== null);
  // Re-read rather than reuse row.wire: the desk is cached for up to 45 s and
  // a row whose `wireRead` is false carries null for a read that never ran, so
  // planning off the rows would post against a reading this run did not make.
  const latest = await deps.readWire(
    facts,
    rows.map((r) => r.ticker),
  );
  const posts = planPosts(rows, latest);
  const skipped = rows.length - posts.length;
  if (posts.length === 0) return { posted: 0, skipped, txHash: null, block: null, reason: null };

  const txHash = await deps.post(account, facts, posts);
  let block: number | null = null;
  try {
    const receipt = await deps.receipt(txHash);
    if (receipt.status !== "success") {
      return {
        posted: 0,
        skipped,
        txHash,
        block: Number(receipt.blockNumber),
        reason: "transaction reverted",
      };
    }
    block = Number(receipt.blockNumber);
  } catch {
    block = null;
  }
  return { posted: posts.length, skipped, txHash, block, reason: null };
}

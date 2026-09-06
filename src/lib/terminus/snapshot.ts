import assetsJson from "../../../data/snapshot/assets.json" with { type: "json" };
import actionsJson from "../../../data/snapshot/corporate-actions.json" with { type: "json" };
import tapeJson from "../../../data/snapshot/tape.json" with { type: "json" };
import multipliersJson from "../../../data/snapshot/multipliers.json" with { type: "json" };
import pricesJson from "../../../data/snapshot/prices.json" with { type: "json" };
import metaJson from "../../../data/snapshot/meta.json" with { type: "json" };
import lastMovesJson from "../../../data/snapshot/last-moves.json" with { type: "json" };
import { CHAIN_ID } from "./chain.ts";
import { hexToBigInt } from "./format.ts";
import { decodeMoveLog, type LastMoveRead, type MoveLog } from "./last-move.ts";
import type { OnchainRead } from "./relay-live.ts";
import { parseActions, parseAssets, type RhjSnapshot } from "./rhj.ts";
import { parseQuote, type RhjQuote } from "./rhj-prices.ts";
import type { Tape } from "./types.ts";

/** The last real reading of the tape, captured by `npm run snapshot`. */
export const SNAPSHOT = {
  readAt: String(metaJson.readAt),
  block: Number(metaJson.block),
  chainId: Number(metaJson.chainId),
} as const;

export function snapshotRhj(): RhjSnapshot {
  return {
    assets: parseAssets(assetsJson),
    actions: parseActions(actionsJson),
    absent: false,
    actionsAbsent: false,
    readAt: SNAPSHOT.readAt,
    stale: false,
  };
}

export function snapshotTape(): Tape {
  const entries = tapeJson as { id: number; result?: string }[];
  const chainHex = entries.find((r) => r.id === 1)?.result;
  const blockHex = entries.find((r) => r.id === 2)?.result;
  const chainId = chainHex ? Number(BigInt(chainHex)) : SNAPSHOT.chainId;
  const block = blockHex ? Number(BigInt(blockHex)) : SNAPSHOT.block;
  return {
    chainId,
    block,
    absent: chainId !== CHAIN_ID,
    reason: chainId !== CHAIN_ID ? `Unexpected chain id ${chainId}.` : null,
  };
}

type RawRead = {
  live: string | null;
  staged: string | null;
  at: string | null;
  paused: string | null;
  transferPaused?: string | null;
};

export function snapshotMultipliers(addresses: `0x${string}`[]): Map<string, OnchainRead> {
  const raw = multipliersJson as Record<string, RawRead>;
  const out = new Map<string, OnchainRead>();
  for (const address of addresses) {
    const key = address.toLowerCase();
    const r = raw[key];
    if (!r) continue;
    const at = hexToBigInt(r.at);
    const paused = hexToBigInt(r.paused);
    const transferPaused = hexToBigInt(r.transferPaused);
    out.set(key, {
      address,
      live: hexToBigInt(r.live),
      staged: hexToBigInt(r.staged),
      effectiveAtSec: at === null ? null : Number(at),
      paused: paused === null ? null : paused !== 0n,
      transferPaused: transferPaused === null ? null : transferPaused !== 0n,
    });
  }
  return out;
}

export function snapshotQuotes(tickers: string[]): Map<string, RhjQuote> {
  const raw = pricesJson as Record<string, unknown>;
  const out = new Map<string, RhjQuote>();
  for (const t of tickers) {
    const ticker = t.toUpperCase();
    const json = raw[ticker];
    if (!json) continue;
    out.set(ticker, parseQuote(ticker, json as Parameters<typeof parseQuote>[1]));
  }
  return out;
}

type RawMove = { log?: MoveLog | null; blockTimestamp?: string | null } | null;

/**
 * The latest `UIMultiplierUpdated` the snapshot script found per contract — the
 * raw log and its block's hex timestamp — decoded by the helper the live reader
 * uses. An address the script did not query, or an entry that does not decode,
 * is simply absent; an empty or missing file yields an empty map.
 */
export function snapshotLastMoves(addresses: `0x${string}`[]): Map<string, LastMoveRead> {
  const raw = (lastMovesJson ?? {}) as Record<string, RawMove>;
  const out = new Map<string, LastMoveRead>();
  for (const address of addresses) {
    const key = address.toLowerCase();
    const r = raw[key];
    if (!r || typeof r !== "object" || !r.log) continue;
    const m = decodeMoveLog(r.log);
    if (!m) continue;
    const ts = hexToBigInt(r.blockTimestamp);
    out.set(key, {
      oldWad: m.oldWad,
      newWad: m.newWad,
      effectiveAtSec: m.effectiveAtSec,
      blockNumber: m.blockNumber,
      blockTimeSec: ts === null ? null : Number(ts),
    });
  }
  return out;
}

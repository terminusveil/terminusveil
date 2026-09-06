import { hexToBigInt } from "./format.ts";
import type { TickerRow } from "./types.ts";

/**
 * keccak256("UIMultiplierUpdated(uint256,uint256,uint256)") — the event a stock
 * token contract emits when its multiplier is set: old, new, and the time the
 * new figure takes effect. Verified against the canonical signature.
 */
export const UI_MULTIPLIER_UPDATED_TOPIC =
  "0x2205df4534432b2f60654a3fdb48737ffdaf3e9edb1a498bd985bc026b15b055";

/**
 * How far below the tape's block the desk scans for the last move. Robinhood
 * Chain ran at ~10 blocks/s on 2026-09-04 (351,954 blocks in 35,604 s), so six
 * million blocks is about a week — wider than any name stays due. The RPC's
 * cost per eth_getLogs was flat across window sizes (~0.4 s); it is the fan-out,
 * not the window, that it rate-limits.
 *
 * A name still listed "in progress" by the issuer for longer than that week
 * after its move falls outside this window: the scan finds nothing, and the
 * row quietly reverts to the plain due copy ("Process date passed. No
 * multiplier move read yet.") instead of the moved line. That is a stale-feed
 * symptom, not a bug in the scan — the fix is the issuer closing the action,
 * not widening the window.
 */
export const LAST_MOVE_WINDOW_BLOCKS = 6_000_000;

export type BlockWindow = { fromBlock: number; toBlock: number };

/** The scan window below `block`, never before genesis. */
export function blockWindow(block: number): BlockWindow {
  return { fromBlock: Math.max(0, block - LAST_MOVE_WINDOW_BLOCKS), toBlock: block };
}

/** A log as the RPC prints it; only the fields the desk reads are typed. */
export type MoveLog = {
  address?: string;
  topics?: string[];
  data?: string;
  blockNumber?: string;
  logIndex?: string;
  transactionHash?: string;
  transactionIndex?: string;
  blockHash?: string;
  blockTimestamp?: string;
  removed?: boolean;
};

export type DecodedMove = {
  oldWad: bigint;
  newWad: bigint;
  effectiveAtSec: number;
  blockNumber: number;
  logIndex: number;
};

/** What the reader returns per contract: the latest log's figures plus its block's time. */
export type LastMoveRead = {
  oldWad: bigint;
  newWad: bigint;
  effectiveAtSec: number;
  blockNumber: number;
  blockTimeSec: number | null;
};

const WORD = 64;

function wordAt(data: string, i: number): bigint | null {
  return hexToBigInt("0x" + data.slice(2 + i * WORD, 2 + (i + 1) * WORD));
}

/**
 * The three data words of one `UIMultiplierUpdated` log. Null for a removed
 * (reorged) log, another event, or anything that does not decode.
 */
export function decodeMoveLog(log: MoveLog): DecodedMove | null {
  if (log.removed) return null;
  const topic = log.topics?.[0];
  if (topic && topic.toLowerCase() !== UI_MULTIPLIER_UPDATED_TOPIC) return null;
  const data = log.data ?? "";
  if (!data.startsWith("0x") || data.length < 2 + 3 * WORD) return null;
  const oldWad = wordAt(data, 0);
  const newWad = wordAt(data, 1);
  const at = wordAt(data, 2);
  const block = hexToBigInt(log.blockNumber);
  if (oldWad === null || newWad === null || at === null || block === null) return null;
  const idx = hexToBigInt(log.logIndex) ?? 0n;
  return {
    oldWad,
    newWad,
    effectiveAtSec: Number(at),
    blockNumber: Number(block),
    logIndex: Number(idx),
  };
}

/** The raw log of the latest decodable move: highest block, then highest log index. */
export function latestMoveLog(logs: MoveLog[]): MoveLog | null {
  let best: { log: MoveLog; move: DecodedMove } | null = null;
  for (const log of logs) {
    const move = decodeMoveLog(log);
    if (!move) continue;
    if (
      !best ||
      move.blockNumber > best.move.blockNumber ||
      (move.blockNumber === best.move.blockNumber && move.logIndex > best.move.logIndex)
    ) {
      best = { log, move };
    }
  }
  return best?.log ?? null;
}

/** The latest decodable move among `logs`; null when none decodes. */
export function latestMove(logs: MoveLog[]): DecodedMove | null {
  const log = latestMoveLog(logs);
  return log ? decodeMoveLog(log) : null;
}

function isoOf(sec: number | null): string | null {
  if (sec === null || !Number.isFinite(sec) || sec <= 0) return null;
  return new Date(sec * 1000).toISOString();
}

/** A read as the row carries it: decimal wei strings and ISO times (null when the chain printed none). */
export function lastMoveOf(read: LastMoveRead): NonNullable<TickerRow["lastMove"]> {
  return {
    old: read.oldWad.toString(),
    new: read.newWad.toString(),
    effectiveAtIso: isoOf(read.effectiveAtSec),
    atIso: isoOf(read.blockTimeSec),
    block: read.blockNumber,
  };
}

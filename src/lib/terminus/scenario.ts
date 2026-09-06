import { parseMultiplier, stagedDiffers } from "./format.ts";
import type { TickerRow } from "./types.ts";

/** A move staged on a contract but not live: the figure now and the figure to come, as decimal wei strings. */
export type TapeMove = {
  ticker: string;
  from: string;
  to: string;
  terminusIso: string | null;
};

/** |ln(staged / live)| as a number, for ranking; null when either figure is unreadable. */
function moveSize(row: TickerRow): number | null {
  if (!row.staged || !row.live || !stagedDiffers(row.staged, row.live)) return null;
  const live = parseMultiplier(row.live);
  const staged = parseMultiplier(row.staged);
  if (live === null || staged === null || live === 0n || staged === 0n) return null;
  const ratio = Number((staged * 1_000_000n) / live) / 1_000_000;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  return Math.abs(Math.log(ratio));
}

/**
 * The pending row whose staged figure moves furthest from its live figure,
 * either direction. Null when nothing pending stages a different figure, and
 * the card falls back to its labelled illustration.
 */
export function biggestStagedMove(rows: readonly TickerRow[]): TapeMove | null {
  let best: { row: TickerRow; size: number } | null = null;
  for (const row of rows) {
    if (row.state !== "veiled" && row.state !== "due") continue;
    const size = moveSize(row);
    if (size === null) continue;
    if (!best || size > best.size) best = { row, size };
  }
  if (!best || !best.row.staged || !best.row.live) return null;
  const live = parseMultiplier(best.row.live);
  const staged = parseMultiplier(best.row.staged);
  if (live === null || staged === null) return null;
  return {
    ticker: best.row.ticker,
    from: live.toString(),
    to: staged.toString(),
    terminusIso: best.row.effectiveAtIso,
  };
}

import type { CorporateAction, TickerRow } from "./types.ts";

export type Move = NonNullable<TickerRow["lastMove"]>;

/** The instant a move is dated by: the effective time the event names, else the block's time. */
function moveMs(move: Move): number {
  const t = Date.parse(move.effectiveAtIso ?? move.atIso ?? "");
  return Number.isFinite(t) ? t : 0;
}

/**
 * The newest `UIMultiplierUpdated` the desk has read across its rows, by
 * effective time then block. Null when no row carries a move.
 */
export function latestMove(rows: readonly TickerRow[]): { ticker: string; move: Move } | null {
  let best: { ticker: string; move: Move } | null = null;
  for (const row of rows) {
    const move = row.lastMove;
    if (!move) continue;
    if (!best) {
      best = { ticker: row.ticker, move };
      continue;
    }
    const dt = moveMs(move) - moveMs(best.move);
    if (dt > 0 || (dt === 0 && move.block > best.move.block)) best = { ticker: row.ticker, move };
  }
  return best;
}

/** The instant a completed action is dated by: its terminus, else its process date at midnight UTC. */
function completedMs(a: CorporateAction): number {
  const t = Date.parse(a.terminusIso ?? "");
  if (Number.isFinite(t)) return t;
  const d = a.processDate;
  return d ? Date.UTC(d.year, d.month - 1, d.day) : 0;
}

/** The newest completed action on the issuer feed; ties keep feed order. Null when the feed lists none. */
export function latestCompleted(actions: readonly CorporateAction[]): CorporateAction | null {
  let best: CorporateAction | null = null;
  for (const a of actions) {
    if (a.status !== "completed") continue;
    if (!best || completedMs(a) > completedMs(best)) best = a;
  }
  return best;
}

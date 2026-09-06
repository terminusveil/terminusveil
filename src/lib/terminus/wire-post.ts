import type { TickerRow, WireRead } from "./types.ts";
import { contractFigure } from "./wire.ts";

export type WirePost = { ticker: string; staged: string; terminus: number };

/** The Wire's batch limit (`MAX_BATCH` in TerminusWire.sol). */
export const MAX_POSTS = 64;

/**
 * Pure. What the poster writes this run: every row whose contract was read,
 * whatever its state, as the contract holds it: `newUIMultiplier()` (the live
 * figure when nothing is staged) and `effectiveAt()` (0 when unset). A row is
 * skipped when the poster's latest already carries the same figure and
 * terminus, so the Wire only moves when the contract does. Never the issuer's
 * figure, never an assumed time. Soonest terminus first; 0 ("not set") last.
 * Capped at MAX_POSTS per run; a wider desk mirrors over a few runs.
 *
 * House decision 2026-09-06: every read is posted, not only the pending names,
 * so the site's "every read the desk makes is posted" is literal.
 */
export function planPosts(
  rows: readonly TickerRow[],
  latest: ReadonlyMap<string, WireRead | null>,
): WirePost[] {
  const out: WirePost[] = [];
  for (const r of rows) {
    const c = contractFigure(r);
    if (!c) continue;
    const have = latest.get(r.ticker) ?? null;
    if (have && BigInt(have.staged) === BigInt(c.staged) && have.terminus === c.terminus) continue;
    out.push({ ticker: r.ticker, staged: c.staged, terminus: c.terminus });
  }
  const key = (p: WirePost) => (p.terminus === 0 ? Number.MAX_SAFE_INTEGER : p.terminus);
  out.sort((a, b) => key(a) - key(b) || a.ticker.localeCompare(b.ticker));
  return out.slice(0, MAX_POSTS);
}

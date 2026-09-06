import { Link } from "@tanstack/react-router";
import { explorerAddress, FEATURED_TICKERS } from "@/lib/terminus/chain";
import { formatMultiplier, formatTerminus, stagedFact } from "@/lib/terminus/format";
import { pendingPlates, rowFor, type DeskPayload, type TickerRow } from "@/lib/terminus/types";

/**
 * Eight names on the board grid (`row-grid row-grid-board`).
 * md+: name | state | live | staged | terminus | verify.
 * Below md: name, state, live on line one; terminus on line two under the detail track.
 */
export function FeaturedBoard({ desk }: { desk: DeskPayload }) {
  const seen = new Set<string>();
  const order = [...FEATURED_TICKERS, ...pendingPlates(desk.rows, 6, desk.clockMs).map((r) => r.ticker)];
  const rows: TickerRow[] = [];
  for (const t of order) {
    if (seen.has(t)) continue;
    seen.add(t);
    const r = rowFor(desk, t);
    if (r) rows.push(r);
    if (rows.length >= 8) break;
  }

  if (rows.length === 0) {
    return <p className="mt-4 text-sm text-ink-muted">No featured ticker could be read.</p>;
  }

  return (
    <div className="panel mt-8 divide-y divide-line">
      <div className="row-grid row-grid-board hidden min-h-0 py-2 md:grid">
        <span className="kicker-muted">Ticker</span>
        <span className="kicker-muted">State</span>
        <span className="kicker-muted">Live</span>
        <span className="kicker-muted">Staged</span>
        <span className="kicker-muted">Terminus</span>
        <span className="kicker-muted text-right">Verify</span>
      </div>
      {rows.map((r) => (
        <div key={r.ticker} className="row-grid row-grid-board row-veil row-hover gap-y-1">
          <Link
            to="/events/$ticker"
            params={{ ticker: r.ticker }}
            className="font-mono text-sm text-accent hover:underline"
          >
            {r.ticker}
          </Link>
          <span className="min-w-0 truncate font-mono text-xs uppercase tracking-widest text-ink-subtle">
            {r.state}
          </span>
          <span className="text-right font-mono text-sm tabular text-ink md:text-left">
            {formatMultiplier(r.live)}
          </span>
          <span className="hidden min-w-0 truncate font-mono text-sm tabular text-ink-muted md:block">
            {r.state === "veiled" || r.state === "due" ? stagedFact(r) : "—"}
          </span>
          <span className="col-span-full pl-[calc(4rem+.75rem)] font-mono text-xs tabular text-ink-subtle md:col-span-1 md:pl-0">
            {formatTerminus(r.effectiveAtIso)}
          </span>
          <span className="hidden text-right md:block">
            {r.address ? (
              <a
                href={explorerAddress(r.address)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Verify ${r.ticker} on explorer`}
                className="font-mono text-xs text-ink-subtle transition-[color] duration-150 hover:text-accent"
              >
                Verify ↗
              </a>
            ) : (
              <span className="font-mono text-xs text-ink-subtle">—</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

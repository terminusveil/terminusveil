import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { Countdown } from "@/components/countdown";
import { isToday } from "@/lib/terminus/calendar";
import { useDeskClock } from "@/lib/terminus/desk-clock";
import { actionFigure, actionLabel, formatTerminus } from "@/lib/terminus/format";
import type { TickerRow } from "@/lib/terminus/types";
import { cn } from "@/lib/utils";

/** Deck `nearest.emptyBody`. */
const EMPTY_BODY =
  "Nothing is on the clock right now. Every live figure stands until the issuer stages the next action.";
/** Deck `nearest.emptyCta` (`Open the board →`); the arrow is drawn, not typed. */
const BOARD_CTA = "Open the board";

/** Column labels over the row grid (sm+). */
const COLUMNS = ["Ticker", "Action", "Terminus", "Clock"] as const;

const ROW_CLASSES =
  "row-grid row-veil row-hover w-full text-left focus-visible:outline-offset-[-2px]";

function BoardLink({ className }: { className?: string }) {
  return (
    <Link to="/events" className={cn("btn-ghost-sm gap-2", className)}>
      {BOARD_CTA}
      <ArrowRight className="btn-icon" strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}

/**
 * The Nearest-terminus list on `/`: eight rows on the shared row grid, soonest first.
 * Rows are buttons when `onPick` drives the hero plate, links otherwise.
 * Only rendered on `/`, so the first-reveal stagger (`--reveal-delay` per row) lives here.
 */
export function PendingTape({
  rows,
  selected,
  onPick,
}: {
  rows: TickerRow[];
  selected?: string;
  onPick?: (ticker: string) => void;
}) {
  const clock = useDeskClock() ?? Date.now();
  if (rows.length === 0) {
    return (
      <div className="panel mt-6 grid gap-4 p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-8">
        <p className="max-w-md text-sm leading-relaxed text-ink-muted">{EMPTY_BODY}</p>
        <BoardLink className="justify-self-start sm:justify-self-end" />
      </div>
    );
  }

  return (
    <>
      <div className="row-grid mt-6 hidden min-h-0 py-2 sm:grid">
        {COLUMNS.map((label, i) => (
          <span
            key={label}
            className={cn("kicker-muted", i === COLUMNS.length - 1 && "text-right")}
          >
            {label}
          </span>
        ))}
      </div>
      <ul className="panel mt-6 divide-y divide-line sm:mt-0">
        {rows.map((r, i) => {
          const label = r.action ? actionLabel(r.action.type) : r.state;
          const figure = actionFigure(r.action);
          const active = selected === r.ticker;
          const today = isToday(r.effectiveAtIso, clock);
          // The chip carries the day, so the meta cell keeps only the clock time; chip + full
          // date (`Fri, 05 Sep, 09:30 ET`) does not fit the 10.5rem meta track at text-xs mono.
          const terminus = formatTerminus(r.effectiveAtIso);
          const meta = today ? terminus.replace(/^.*,\s*/, "") : terminus;
          const body = (
            <>
              <span className="font-mono text-sm text-accent">{r.ticker}</span>
              <span className="min-w-0 flex flex-col gap-0.5 text-sm sm:flex-row sm:items-baseline sm:gap-2">
                <span className="min-w-0 truncate text-ink-muted">{label}</span>
                {figure ? (
                  <span className="whitespace-nowrap font-mono tabular text-ink">{figure}</span>
                ) : null}
              </span>
              <span className="hidden font-mono text-xs tabular text-ink-subtle sm:block">
                {today ? (
                  <span className="mr-2 rounded-pill border border-accent/40 px-1.5 py-px font-mono text-[11px] uppercase tracking-widest text-accent">
                    today
                  </span>
                ) : null}
                {meta}
              </span>
              <span
                className={cn(
                  "text-right font-mono text-xs tabular text-ink-subtle",
                  today && "text-accent",
                )}
              >
                <Countdown iso={r.effectiveAtIso} variant="hero" />
              </span>
            </>
          );
          return (
            <li
              key={r.ticker}
              className="row-reveal"
              style={{ "--reveal-delay": `${i * 30}ms` } as CSSProperties}
            >
              {onPick ? (
                <button
                  type="button"
                  data-walk={r.ticker}
                  data-selected={active ? "" : undefined}
                  aria-current={active ? "true" : undefined}
                  onClick={() => onPick(r.ticker)}
                  className={ROW_CLASSES}
                >
                  {body}
                </button>
              ) : (
                <Link
                  to="/events/$ticker"
                  params={{ ticker: r.ticker }}
                  data-walk={r.ticker}
                  data-selected={active ? "" : undefined}
                  aria-current={active ? "true" : undefined}
                  className={ROW_CLASSES}
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex justify-end">
        <BoardLink />
      </div>
    </>
  );
}

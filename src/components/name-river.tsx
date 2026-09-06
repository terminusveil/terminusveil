import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useDeskClock } from "@/lib/terminus/desk-clock";
import { pendingPlates, type TickerRow } from "@/lib/terminus/types";

/** Pixels per second the river drifts; the duration is derived so the pace is the same on every screen. */
const SPEED_PX_PER_S = 70;
/** Every veiled or due name rides the river; the cap only bounds a runaway tape. */
const MAX_NAMES = 64;

function Chip({ ticker, state, hidden }: { ticker: string; state: string; hidden?: boolean }) {
  return (
    <span
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-baseline gap-2 font-mono text-xs tabular text-ink-muted"
    >
      <span className="text-accent">{ticker}</span>
      <span className="uppercase tracking-widest text-ink-subtle">{state}</span>
    </span>
  );
}

/**
 * The strip under the nav: every name on the clock, soonest first, drifting
 * left without a seam. The first set is real links; the copies are hidden
 * from assistive tech. Enough copies are rendered to cover twice the viewport,
 * so a wide screen never sees the tape run out, and the track's duration is
 * set from its measured width so the pace is constant.
 */
export function NameRiver({ rows }: { rows: TickerRow[] }) {
  const clock = useDeskClock() ?? Date.now();
  const names = pendingPlates(rows, MAX_NAMES, clock);
  const setRef = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState<{ copies: number; durationS: number }>({
    copies: 2,
    durationS: 42,
  });

  useEffect(() => {
    const set = setRef.current;
    if (!set) return;
    const measure = () => {
      const style = getComputedStyle(set.parentElement as Element);
      const gap = parseFloat(style.columnGap || style.gap || "0") || 0;
      const setWidth = set.getBoundingClientRect().width + gap;
      if (setWidth <= 0) return;
      // Half the track must cover the viewport; the other half is its identical twin, so the loop has no seam.
      const perHalf = Math.max(1, Math.ceil(window.innerWidth / setWidth));
      setFit({ copies: perHalf * 2, durationS: Math.round((perHalf * setWidth) / SPEED_PX_PER_S) });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [names.length]);

  if (names.length === 0) return null;

  return (
    <div
      className="name-river border-b border-line"
      data-loop={names.length > 0 ? "1" : "0"}
      style={{ "--river-duration": `${fit.durationS}s` } as CSSProperties}
    >
      <div className="name-river-track">
        {Array.from({ length: fit.copies }, (_, c) => (
          <span key={c} ref={c === 0 ? setRef : undefined} className="name-river-set">
            {names.map((r) =>
              c === 0 ? (
                <Link
                  key={r.ticker}
                  to="/events/$ticker"
                  params={{ ticker: r.ticker }}
                  className="flex shrink-0 items-baseline gap-2 font-mono text-xs tabular text-ink-muted hover:text-accent"
                  tabIndex={-1}
                >
                  <span className="text-accent">{r.ticker}</span>
                  <span className="uppercase tracking-widest text-ink-subtle">{r.state}</span>
                </Link>
              ) : (
                <Chip key={`${r.ticker}-${c}`} ticker={r.ticker} state={r.state} hidden />
              ),
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

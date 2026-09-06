import { Link } from "@tanstack/react-router";
import { dayKey, monthCells, monthLabel, shiftMonth } from "@/lib/terminus/calendar";
import { useDeskClock } from "@/lib/terminus/desk-clock";
import { actionFigure, actionLabel } from "@/lib/terminus/format";
import type { CorporateAction } from "@/lib/terminus/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthCalendar({
  year,
  month,
  actions,
  selected,
  onMonth,
  onSelectDay,
}: {
  year: number;
  month: number;
  actions: CorporateAction[];
  selected: string | null;
  onMonth: (year: number, month: number) => void;
  onSelectDay: (key: string) => void;
}) {
  const clock = useDeskClock() ?? Date.now();
  const cells = monthCells(year, month, clock);
  const byDay = new Map<string, CorporateAction[]>();
  for (const a of actions) {
    const key = dayKey(a.terminusIso);
    if (key === "undated") continue;
    const list = byDay.get(key) ?? [];
    list.push(a);
    byDay.set(key, list);
  }

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex h-11 items-center rounded-pill border border-line px-4 font-mono text-xs uppercase tracking-widest text-ink-muted hover:text-ink"
          onClick={() => onMonth(prev.year, prev.month)}
        >
          {monthLabel(prev.year, prev.month, "short")}
        </button>
        <p className="font-display text-sm font-semibold">{monthLabel(year, month)}</p>
        <button
          type="button"
          className="inline-flex h-11 items-center rounded-pill border border-line px-4 font-mono text-xs uppercase tracking-widest text-ink-muted hover:text-ink"
          onClick={() => onMonth(next.year, next.month)}
        >
          {monthLabel(next.year, next.month, "short")}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-paper-elev px-1 py-2 text-center font-mono text-xs uppercase tracking-widest text-ink-subtle"
          >
            {d}
          </div>
        ))}
        {cells.map((c) => {
          const hits = byDay.get(c.key) ?? [];
          const active = selected === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onSelectDay(c.key)}
              className={cn(
                "min-h-16 bg-paper px-1.5 py-2 text-left transition-colors duration-150",
                c.inMonth ? "text-ink" : "text-ink-subtle",
                active ? "bg-paper-2" : "hover:bg-paper-elev",
              )}
            >
              <span className={cn("font-mono text-xs tabular", c.isToday ? "text-accent" : "")}>
                {c.day}
              </span>
              {hits.length > 0 ? (
                <span className="mt-1 block font-mono text-[10px] leading-tight tracking-tight text-accent">
                  {hits[0]?.ticker}
                  {hits.length > 1 ? ` +${hits.length - 1}` : ""}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selected ? <DayHits day={selected} items={byDay.get(selected) ?? []} /> : null}
    </div>
  );
}

function DayHits({ day, items }: { day: string; items: CorporateAction[] }) {
  if (items.length === 0) {
    return <p className="mt-6 text-sm text-ink-muted">No covering on {day}.</p>;
  }
  return (
    <ul className="panel mt-6 divide-y divide-line">
      {items.map((a, i) => (
        <li key={`${a.id}-${i}`}>
          <Link
            to="/events/$ticker"
            params={{ ticker: a.ticker }}
            className="row-grid row-grid-3 row-veil row-hover focus-visible:outline-offset-[-2px]"
          >
            <span className="font-mono text-sm text-accent">{a.ticker}</span>
            <span className="min-w-0 truncate text-sm text-ink-muted">
              {actionLabel(a.type)}
              {actionFigure(a) ? (
                <>
                  {" "}
                  <span className="ml-1 font-mono tabular text-ink">{actionFigure(a)}</span>
                </>
              ) : null}
            </span>
            <span className="text-right font-mono text-xs uppercase tracking-wide whitespace-nowrap text-ink-subtle">
              {a.status.replaceAll("_", " ")}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

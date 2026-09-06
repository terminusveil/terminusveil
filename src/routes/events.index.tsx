import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useState, type CSSProperties, type KeyboardEvent } from "react";
import { z } from "zod";
import { CalendarSubscribe } from "@/components/calendar-tools";
import { Countdown } from "@/components/countdown";
import { DeskShell } from "@/components/desk-shell";
import { MonthCalendar } from "@/components/month-calendar";
import { NameSearch } from "@/components/name-search";
import { PageHeader } from "@/components/page-header";
import { SnapshotNote } from "@/components/snapshot-note";
import { pageHead } from "@/lib/site-meta";
import {
  actionKind,
  etParts,
  groupActionsByDay,
  isPast,
  isToday,
  matchesQuery,
  type ActionKind,
  type DayGroup,
} from "@/lib/terminus/calendar";
import { getDesk } from "@/lib/terminus/fetch-desk";
import { actionFigure, actionLabel, formatMultiplier } from "@/lib/terminus/format";
import type { CorporateAction, DeskState, TickerRow } from "@/lib/terminus/types";
import { useCoveringKeys } from "@/lib/terminus/use-covering-keys";
import { cn } from "@/lib/utils";

/** Deck `events.title`. */
const TITLE = "Every pending action, by terminus.";
/** Deck `events.lede` without its trailing `Pending {n}. Names {n}.`: the readout carries the counts (spec §2.3). */
const LEDE = "Grouped by process date at 09:30 ET. Export the board to your calendar.";
/** Deck `events.emptyVeiled`; `{n}` is the asset count. */
function emptyVeiled(n: number): string {
  return `Nothing staged across ${n} tickers. Live × is the only figure on every plate.`;
}
/** Deck `events.emptyCompleted`. */
const EMPTY_COMPLETED = "No action has completed on the feed yet. The first one lands here.";
/** Query feedback (attribute-like text, outside the deck). */
function noMatch(q: string): string {
  return q ? `No ticker matches "${q}".` : "No ticker matches.";
}

const VIEWS = ["veiled", "completed", "tickers", "calendar"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABEL: Record<View, string> = {
  veiled: "Veiled",
  completed: "Completed",
  tickers: "Tickers",
  calendar: "Calendar",
};
const KINDS = ["all", "split", "dividend", "other"] as const;
type Kind = (typeof KINDS)[number];

const searchSchema = z.object({
  view: z.enum(VIEWS).optional(),
  q: z.string().optional(),
  kind: z.enum(KINDS).optional(),
});

export const Route = createFileRoute("/events/")({
  validateSearch: searchSchema,
  loader: () => getDesk(),
  head: () =>
    pageHead({
      title: "Events · pending corporate actions by terminus",
      description:
        "Issuer actions on Robinhood Chain stock tokens, grouped by process date at 09:30 ET, with a calendar and ICS export.",
      path: "/events",
    }),
  component: EventsIndex,
});

function kindOf(kind: ActionKind | "all", type: string): boolean {
  if (kind === "all") return true;
  return actionKind(type) === kind;
}

/** Every ticker row on this page: shared grid, veil bar, pointer hover; `scroll-mt` keeps a walked row clear of the nav and the sticky day label. */
const ROW_CLASSES = "row-grid row-veil row-hover scroll-mt-24 focus-visible:outline-offset-[-2px]";
const SECTION_TITLE = "font-display text-xl leading-snug tracking-tight text-ink";
const TAB_CLASSES =
  "relative z-[1] inline-flex h-10 items-center justify-center gap-1.5 rounded-pill px-3 font-mono text-xs uppercase tracking-wider text-ink-muted transition-[color] duration-200 ease-out hover:text-ink aria-selected:text-accent-fg aria-selected:hover:text-accent-fg";
const KIND_CLASSES =
  "inline-flex h-8 items-center rounded-pill px-3 font-mono text-[11px] uppercase tracking-wider text-ink-muted transition-[color] duration-150 hover:text-ink aria-pressed:bg-paper-2 aria-pressed:text-ink";

function EventsIndex() {
  const desk = Route.useLoaderData();
  const { view: viewRaw, q: qRaw, kind: kindRaw } = Route.useSearch();
  const navigate = useNavigate({ from: "/events/" });
  const view: View = viewRaw ?? "veiled";
  const q = qRaw ?? "";
  const kind: Kind = kindRaw ?? "all";
  const today = etParts(new Date(desk.clockMs));
  const [cal, setCal] = useState({ year: today.year, month: today.month });
  const [day, setDay] = useState<string | null>(null);
  const [keyed, setKeyed] = useState(false);

  const pending = desk.actions
    .filter((a) => a.status === "in_progress")
    .filter((a) => matchesQuery(q, a.ticker))
    .filter((a) => kindOf(kind, a.type));
  const done = desk.actions
    .filter((a) => a.status === "completed")
    .filter((a) => matchesQuery(q, a.ticker))
    .filter((a) => kindOf(kind, a.type));
  const names = [...desk.rows]
    .filter((r) => matchesQuery(q, r.ticker, r.name))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  const calendarActions = desk.actions
    .filter((a) => matchesQuery(q, a.ticker))
    .filter((a) => kindOf(kind, a.type));
  const completedCount = desk.actions.filter((a) => a.status === "completed").length;

  const upcoming = pending.filter((a) => !isPast(a.terminusIso, desk.clockMs));
  const due = pending.filter((a) => isPast(a.terminusIso, desk.clockMs));
  const upcomingGroups = groupActionsByDay(upcoming);
  const dueGroups = groupActionsByDay(due).reverse();
  const completedGroups = groupActionsByDay(done);

  // The walk follows the rows as rendered (grouped by day), so ArrowDown is always the next visible row.
  const walk =
    view === "tickers"
      ? names.map((r) => r.ticker)
      : view === "completed"
        ? completedGroups.flatMap((g) => g.items.map((a) => a.ticker))
        : view === "calendar"
          ? calendarActions.map((a) => a.ticker)
          : [...upcomingGroups, ...dueGroups].flatMap((g) => g.items.map((a) => a.ticker));
  const cursor = useCoveringKeys(walk);
  const selected = walk[cursor] ?? null;

  const viewIndex = VIEWS.indexOf(view);
  const tabCount: Partial<Record<View, number>> = {
    veiled: desk.pendingCount,
    completed: completedCount,
    tickers: desk.assetCount,
  };

  function setSearch(next: { view?: View; q?: string; kind?: Kind }) {
    void navigate({
      search: {
        view: next.view ?? view,
        q: (next.q ?? q) || undefined,
        kind: (next.kind ?? kind) === "all" ? undefined : (next.kind ?? kind),
      },
      replace: true,
    });
  }

  /** Tablist keys: Left/Right move the view; Up/Down stay with the covering walk. */
  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = VIEWS[(viewIndex + delta + VIEWS.length) % VIEWS.length];
    if (!next) return;
    setKeyed(true);
    setSearch({ view: next });
    e.currentTarget
      .querySelectorAll<HTMLButtonElement>("[role='tab']")
      [VIEWS.indexOf(next)]?.focus();
  }

  return (
    <DeskShell desk={desk}>
      <main>
        <div className="wrap py-10 sm:py-14">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <PageHeader kicker="events" title={TITLE} lede={LEDE}>
              <SnapshotNote desk={desk} className="mt-3" />
            </PageHeader>
            <dl className="flex gap-6 md:justify-end md:pt-12">
              <div>
                <dt className="kicker-muted">Pending</dt>
                <dd className="mt-1 font-mono text-lg tabular text-ink">{desk.pendingCount}</dd>
              </div>
              <div>
                <dt className="kicker-muted">Tickers</dt>
                <dd className="mt-1 font-mono text-lg tabular text-ink">{desk.assetCount}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center">
            <NameSearch
              desk={desk}
              value={q}
              onChange={(next) => setSearch({ q: next })}
              className="md:max-w-sm md:flex-1"
            />
            <div
              role="tablist"
              aria-label="View"
              onKeyDown={onTabKey}
              data-keyed={keyed ? "" : undefined}
              onPointerDown={() => setKeyed(false)}
              className="segmented relative grid h-12 grid-cols-4 rounded-pill border border-line-strong bg-paper-elev p-1 md:ml-auto md:inline-grid md:w-auto"
            >
              <span
                aria-hidden="true"
                className="segmented-thumb"
                style={{ "--i": viewIndex } as CSSProperties}
              />
              {VIEWS.map((v) => {
                const active = view === v;
                const count = tabCount[v];
                return (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    id={`events-tab-${v}`}
                    aria-selected={active}
                    aria-controls="events-panel"
                    tabIndex={active ? 0 : -1}
                    onClick={() => setSearch({ view: v })}
                    className={TAB_CLASSES}
                  >
                    {VIEW_LABEL[v]}
                    {count !== undefined ? (
                      <span className="hidden tabular opacity-70 sm:inline">{count}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {view !== "tickers" ? (
              <div
                role="group"
                aria-label="Kind"
                className="inline-flex h-10 items-center gap-1 self-start rounded-pill border border-line bg-transparent p-1"
              >
                {KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kind === k}
                    onClick={() => setSearch({ kind: k })}
                    className={KIND_CLASSES}
                  >
                    {k}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 md:ml-auto">
              <CalendarSubscribe />
            </div>
          </div>

          <div role="tabpanel" id="events-panel" aria-labelledby={`events-tab-${view}`}>
            {view === "calendar" ? (
              <div className="mt-8">
                <MonthCalendar
                  year={cal.year}
                  month={cal.month}
                  actions={calendarActions}
                  selected={day}
                  onMonth={(year, month) => {
                    setCal({ year, month });
                    setDay(null);
                  }}
                  onSelectDay={setDay}
                />
              </div>
            ) : view === "tickers" ? (
              names.length === 0 ? (
                <EmptyPanel>{noMatch(q)}</EmptyPanel>
              ) : (
                <NamesList rows={names} selected={selected} />
              )
            ) : view === "completed" ? (
              completedGroups.length === 0 ? (
                <EmptyPanel>{q ? noMatch(q) : EMPTY_COMPLETED}</EmptyPanel>
              ) : (
                <section className="mt-8">
                  <h2 className={SECTION_TITLE}>Completed</h2>
                  <DayPanel
                    className="mt-4"
                    groups={completedGroups}
                    mode="done"
                    selected={selected}
                    clock={desk.clockMs}
                  />
                </section>
              )
            ) : upcomingGroups.length === 0 && dueGroups.length === 0 ? (
              <EmptyPanel>{q ? noMatch(q) : emptyVeiled(desk.assetCount)}</EmptyPanel>
            ) : (
              <div className="mt-8 space-y-10">
                {upcomingGroups.length > 0 ? (
                  <DayPanel
                    groups={upcomingGroups}
                    mode="countdown"
                    selected={selected}
                    clock={desk.clockMs}
                  />
                ) : null}
                {dueGroups.length > 0 ? (
                  <section>
                    <h2 className={SECTION_TITLE}>Due</h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      Process date passed. The desk prints a move only when it reads one.
                    </p>
                    <DayPanel
                      className="mt-4"
                      groups={dueGroups}
                      mode="due"
                      selected={selected}
                      clock={desk.clockMs}
                    />
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </main>
    </DeskShell>
  );
}

/** Brief §2 empty-state panel, explanation slot only (no button: this is the board). */
function EmptyPanel({ children }: { children: string }) {
  return (
    <div className="panel mt-8 p-6 sm:p-8">
      <p className="max-w-md text-sm leading-relaxed text-ink-muted">{children}</p>
    </div>
  );
}

/**
 * One panel per section: sticky mono day-label rows under the nav, then ticker rows on the
 * shared grid (name · action · rate · clock). No stagger: an Operate surface, scanned many times.
 */
function DayPanel({
  groups,
  mode,
  selected,
  clock,
  className,
}: {
  groups: DayGroup<CorporateAction>[];
  mode: "countdown" | "due" | "done";
  selected: string | null;
  clock: number;
  className?: string;
}) {
  return (
    <ul className={cn("panel divide-y divide-line", className)}>
      {groups.map((g) => {
        const today = isToday(g.items[0]?.terminusIso ?? null, clock);
        return (
          <Fragment key={g.key}>
            <li className="sticky top-14 z-[1] border-b border-line bg-paper-elev/95 px-4 py-2 text-xs backdrop-blur-sm">
              <span className="font-mono text-xs uppercase tracking-widest text-ink">
                {g.label}
              </span>{" "}
              <span className="ml-2 font-mono text-xs uppercase tracking-widest text-ink-subtle">
                09:30 ET
              </span>
              {today ? (
                <>
                  {" "}
                  <span className="ml-2 rounded-pill border border-accent/40 px-1.5 py-px font-mono text-[10px] uppercase tracking-widest text-accent">
                    today
                  </span>
                </>
              ) : null}
            </li>
            {g.items.map((a, i) => {
              const active = selected === a.ticker;
              return (
                <li key={`${a.id}-${a.status}-${i}`}>
                  <Link
                    to="/events/$ticker"
                    params={{ ticker: a.ticker }}
                    data-walk={a.ticker}
                    data-selected={active ? "" : undefined}
                    aria-current={active ? "true" : undefined}
                    className={ROW_CLASSES}
                  >
                    <span className="font-mono text-sm text-accent">{a.ticker}</span>
                    <span className="min-w-0 truncate text-sm text-ink-muted">
                      {actionLabel(a.type)}
                      {actionFigure(a) ? (
                        <>
                          {" "}
                          <span className="ml-1 font-mono tabular text-ink sm:hidden">
                            {actionFigure(a)}
                          </span>
                        </>
                      ) : null}
                    </span>
                    <span className="hidden font-mono text-xs tabular text-ink sm:block">
                      {actionFigure(a) ?? "—"}
                    </span>
                    <span
                      className={cn(
                        "text-right font-mono text-xs tabular",
                        mode === "due" ? "text-ink" : "text-ink-subtle",
                      )}
                    >
                      {mode === "countdown" ? (
                        <Countdown iso={a.terminusIso} variant="hero" />
                      ) : mode === "due" ? (
                        "due"
                      ) : (
                        "done"
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </Fragment>
        );
      })}
    </ul>
  );
}

/** Names view: every name on the three-track grid (name · state · live ×), two columns at md. */
function NamesList({ rows, selected }: { rows: TickerRow[]; selected: string | null }) {
  return (
    <ul className="panel mt-8 grid md:grid-cols-2 [&>li:last-child]:border-b-0 md:[&>li:nth-last-child(2):nth-child(odd)]:border-b-0">
      {rows.map((r) => {
        const active = selected === r.ticker;
        return (
          <li key={r.ticker} className="border-b border-line md:odd:border-r">
            <Link
              to="/events/$ticker"
              params={{ ticker: r.ticker }}
              data-walk={r.ticker}
              data-selected={active ? "" : undefined}
              aria-current={active ? "true" : undefined}
              className={cn(ROW_CLASSES, "row-grid-3")}
            >
              <span className="font-mono text-sm text-accent">{r.ticker}</span>
              <span className="min-w-0">
                <StateCell state={r.state} />
              </span>
              <span className="text-right font-mono text-xs tabular text-ink-subtle">
                {formatMultiplier(r.live)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** `open` is plain text; anything else is a chip. Lime only on `veiled`, so the live names read first. */
function StateCell({ state }: { state: DeskState }) {
  if (state === "open") {
    return (
      <span className="font-mono text-xs uppercase tracking-widest text-ink-subtle">{state}</span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-pill border px-2 font-mono text-[11px] uppercase tracking-widest",
        state === "veiled"
          ? "border-accent/40 text-accent"
          : state === "due"
            ? "border-line-strong text-ink"
            : "border-dashed border-line text-ink-subtle",
      )}
    >
      {state}
    </span>
  );
}

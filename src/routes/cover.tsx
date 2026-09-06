import { createFileRoute, Link } from "@tanstack/react-router";
import { AddTerminus, CalendarSubscribe } from "@/components/calendar-tools";
import { Countdown } from "@/components/countdown";
import { DeskShell } from "@/components/desk-shell";
import { Mark } from "@/components/mark";
import { PageHeader } from "@/components/page-header";
import { pageHead } from "@/lib/site-meta";
import {
  coveringCounts,
  coveringLife,
  useCovering,
  type Covering,
  type CoveringLife,
} from "@/lib/terminus/covering";
import { useDeskClock } from "@/lib/terminus/desk-clock";
import { getDesk } from "@/lib/terminus/fetch-desk";
import { actionFigure, actionLabel, formatMultiplier, formatTerminus } from "@/lib/terminus/format";
import { rowFor, type DeskPayload } from "@/lib/terminus/types";

export const Route = createFileRoute("/cover")({
  loader: () => getDesk(),
  head: () =>
    pageHead({
      title: "Cover · Terminus Veil",
      description: "Your shortlist of veiled tickers, sealed until terminus. Kept in this browser.",
      path: "/cover",
    }),
  component: Cover,
});

function Cover() {
  const desk = Route.useLoaderData();
  const items = useCovering((s) => s.items);
  const ready = useCovering((s) => s.ready);
  const lift = useCovering((s) => s.lift);
  const clock = useDeskClock() ?? Date.now();
  const counts = coveringCounts(items, desk.rows, clock);

  return (
    <DeskShell desk={desk}>
      <main>
        <div className="wrap max-w-3xl py-12 sm:py-16">
          <PageHeader
            kicker="cover"
            title="Covering"
            lede="Your shortlist of veiled tickers, sealed until terminus. Kept in this browser today. Holders get it synced across devices with an alert before terminus in phase 2. Not a position."
          >
            <p className="mt-3">
              <Link to="/token" hash="phases" className="btn-ghost-sm">
                Phase 2 →
              </Link>
            </p>
          </PageHeader>

          {counts.sealed + counts.due + counts.opened > 0 ? (
            <p className="mt-8 font-mono text-sm tabular text-ink">
              Sealed {counts.sealed} · Due {counts.due} · Opened {counts.opened}
            </p>
          ) : null}
          <div className="mt-4">
            <CalendarSubscribe />
          </div>

          {!ready ? (
            <p className="mt-8 text-sm text-ink-muted">Reading the covering.</p>
          ) : items.length === 0 ? (
            <div className="panel mt-8 p-6 sm:p-8">
              <Mark className="size-16" drawn />
              <p className="mt-5 text-sm text-ink">Nothing sealed.</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Open a veiled ticker. Seal until terminus writes it here. Subscribe the pending tape
                so the clock lives on your calendar.
              </p>
              <p className="mt-6">
                <Link
                  to="/events/$ticker"
                  params={{ ticker: desk.heroTicker }}
                  className="btn-primary"
                >
                  Open {desk.heroTicker}
                </Link>
              </p>
            </div>
          ) : (
            <ul className="panel mt-8 divide-y divide-line">
              {items.map((item) => (
                <CoverRow
                  key={`${item.ticker}-${item.sealedAt}`}
                  item={item}
                  desk={desk}
                  onLift={lift}
                />
              ))}
            </ul>
          )}

          <p className="mt-10 text-sm leading-relaxed text-pretty text-ink-muted">
            The calendar is the copy that survives. This tab is not a position.
          </p>
        </div>
      </main>
    </DeskShell>
  );
}

function CoverRow({
  item,
  desk,
  onLift,
}: {
  item: Covering;
  desk: DeskPayload;
  onLift: (ticker: string) => void;
}) {
  const row = rowFor(desk, item.ticker);
  const clock = useDeskClock() ?? Date.now();
  const life: CoveringLife = coveringLife(item, row, clock);
  const figure = item.actionType
    ? actionFigure({ type: item.actionType, rate: item.actionRate })
    : null;
  const action = item.actionType
    ? `${actionLabel(item.actionType)}${figure ? ` ${figure}` : ""}`
    : null;
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-4">
      <div className="min-w-0">
        <Link
          to="/events/$ticker"
          params={{ ticker: item.ticker }}
          className="font-mono text-sm text-accent"
        >
          {item.ticker}
        </Link>
        <p className="mt-1 text-sm text-ink-muted">{action ?? "Sealed covering"}</p>
        <p className="mt-1 font-mono text-xs tabular text-ink-subtle">
          staged {formatMultiplier(item.staged)} · live {formatMultiplier(item.live)}
        </p>
        {row ? (
          <p className="mt-2">
            <AddTerminus row={row} />
          </p>
        ) : null}
      </div>
      <div className="text-right font-mono text-xs tabular">
        <p className="text-ink">
          <Countdown iso={item.terminusIso} />
        </p>
        <p className="mt-1 text-ink-subtle">{formatTerminus(item.terminusIso)}</p>
        <p className="mt-1 uppercase tracking-widest text-ink-subtle">{life}</p>
        <button
          type="button"
          className="mt-2 text-ink-muted hover:text-accent"
          onClick={() => onLift(item.ticker)}
        >
          Lift
        </button>
      </div>
    </li>
  );
}

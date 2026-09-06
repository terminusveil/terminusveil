import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Countdown } from "@/components/countdown";
import { DeskMap } from "@/components/desk-map";
import { DeskShell } from "@/components/desk-shell";
import { FeaturedBoard } from "@/components/featured-board";
import { HouseSection } from "@/components/house-section";
import { HouseWalk } from "@/components/house-walk";
import { LandingHero } from "@/components/landing-hero";
import { Manifesto } from "@/components/manifesto";
import { PendingTape } from "@/components/pending-tape";
import { PlainStrip } from "@/components/plain-strip";
import { Reveal } from "@/components/reveal";
import { SectionHead } from "@/components/section-head";
import { SnapshotNote } from "@/components/snapshot-note";
import { SITE_DESCRIPTION, SITE_NAME, pageHead } from "@/lib/site-meta";
import { getDesk } from "@/lib/terminus/fetch-desk";
import { actionFigure, actionLabel, formatTerminus } from "@/lib/terminus/format";
import { pendingPlates, rowFor } from "@/lib/terminus/types";
import { useCoveringKeys } from "@/lib/terminus/use-covering-keys";
import { z } from "zod";

const searchSchema = z.object({
  t: z.string().optional(),
});

/** Deck `nearest.kicker`, `nearest.lede`. */
const NEAREST_KICKER = "Up next";
const NEAREST_LEDE =
  "Tickers with an action staged, ordered by the moment it takes effect. Open one, or put it on your calendar.";
/** Deck `nearest.title` is `{n} names on the clock.`; `1 name on the clock.` when n === 1 (spec §2.2). */
function nearestTitleWords(n: number): string {
  return n === 1 ? "ticker on the clock." : "tickers on the clock.";
}
/** Deck `featured.title`, `featured.lede`. */
const FEATURED_TITLE = "Eight tickers. Four reads each.";
const FEATURED_LEDE =
  "Staged appears only when it differs from live. Terminus is the clock. Every figure links to the explorer.";
/** Deck `completed.title`. */
const COMPLETED_TITLE = "Actions already live.";

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  loader: () => getDesk(),
  head: ({ loaderData }) => {
    const row = loaderData ? rowFor(loaderData, loaderData.heroTicker) : null;
    // A snapshot is a real reading: its plate title is used even though the live tape is absent.
    const absent = loaderData?.source === "snapshot" ? false : (loaderData?.tape.absent ?? true);
    // Owner pass 2026-09-06: the tab reads the site's name, not the plate; the plate stays in the description.
    return pageHead({
      title: SITE_NAME,
      description: row && !absent ? (row.emptyCopy ?? SITE_DESCRIPTION) : SITE_DESCRIPTION,
      path: "/",
    });
  },
  component: Home,
});

function Home() {
  const desk = Route.useLoaderData();
  const { t } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const ticker = (t ?? desk.heroTicker).toUpperCase();
  const row = rowFor(desk, ticker) ?? rowFor(desk, desk.heroTicker) ?? desk.rows[0];
  const pending = pendingPlates(desk.rows, 8, desk.clockMs);
  const walk = pending.map((r) => r.ticker);
  // Next terminus must be a veiled row whose terminus is still ahead of the clock; `pendingPlates`
  // sorts veiled-and-future rows first, so the first veiled entry (if any) is the soonest one.
  const nextTerminus = pending.find((r) => r.state === "veiled");
  const completed = [...desk.actions]
    .filter((a) => a.status === "completed")
    .sort((a, b) => (b.terminusIso ?? "").localeCompare(a.terminusIso ?? ""))
    .slice(0, 4);

  function setTicker(next: string) {
    void navigate({ search: { t: next }, replace: true });
  }

  useCoveringKeys(walk, {
    active: row?.ticker,
    scroll: false,
    onMove: setTicker,
    onEnter: (name) => {
      void navigate({ to: "/events/$ticker", params: { ticker: name } });
    },
  });

  if (!row) {
    return (
      <DeskShell desk={desk} claim={false}>
        <main className="wrap py-16">
          <p className="text-ink-muted">No name could be read.</p>
        </main>
      </DeskShell>
    );
  }

  return (
    <DeskShell desk={desk} claim={false}>
      <main>
        <LandingHero row={row} chips={desk.chips} onChip={setTicker} desk={desk} />

        <PlainStrip desk={desk} />

        <Manifesto desk={desk} />

        <HouseWalk />

        <HouseSection />

        <Reveal>
          <section>
            <div className="wrap py-16 lg:py-20">
              <SectionHead title={FEATURED_TITLE} lede={FEATURED_LEDE} size="md" />
              <SnapshotNote desk={desk} className="mt-3" />
              <FeaturedBoard desk={desk} />
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section>
            <div className="wrap py-16 lg:py-20">
              <header className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="max-w-xl">
                  <p className="kicker">{NEAREST_KICKER}</p>
                  <h2 className="mt-3 font-display text-2xl leading-snug tracking-tight text-ink sm:text-3xl">
                    <span className="tabular">{desk.pendingCount}</span>{" "}
                    {nearestTitleWords(desk.pendingCount)}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">
                    {NEAREST_LEDE}
                  </p>
                </div>
                {nextTerminus || desk.dueCount > 0 ? (
                  <dl className="flex gap-6 sm:justify-end">
                    {nextTerminus ? (
                      <div>
                        <dt className="kicker-muted">Next terminus</dt>
                        <dd className="mt-1 font-mono text-lg tabular text-ink">
                          <Countdown iso={nextTerminus.effectiveAtIso} variant="hero" />
                        </dd>
                      </div>
                    ) : null}
                    {desk.dueCount > 0 ? (
                      <div>
                        <dt className="kicker-muted">Due</dt>
                        <dd className="mt-1 font-mono text-lg tabular text-ink">{desk.dueCount}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}
              </header>
              <SnapshotNote desk={desk} className="mt-3" />
              <PendingTape rows={pending} selected={row.ticker} onPick={setTicker} />
            </div>
          </section>
        </Reveal>

        {completed.length > 0 ? (
          <Reveal>
            <section>
              <div className="wrap py-16 lg:py-20">
                <SectionHead title={COMPLETED_TITLE} size="md" />
                <ul className="panel mt-8 divide-y divide-line">
                  {completed.map((a, i) => (
                    <li key={`${a.id}-${i}`}>
                      <Link
                        to="/events/$ticker"
                        params={{ ticker: a.ticker }}
                        className="row-grid row-veil row-hover focus-visible:outline-offset-[-2px]"
                      >
                        <span className="font-mono text-sm text-accent">{a.ticker}</span>
                        <span className="min-w-0 truncate text-sm text-ink-muted">
                          {actionLabel(a.type)}
                          {actionFigure(a) ? (
                            <>
                              {" "}
                              <span className="ml-1 font-mono tabular text-ink">
                                {actionFigure(a)}
                              </span>
                            </>
                          ) : null}
                        </span>
                        <span className="hidden font-mono text-xs tabular text-ink-subtle sm:block">
                          {formatTerminus(a.terminusIso)}
                        </span>
                        <span className="text-right font-mono text-xs tabular text-ink-subtle">
                          done
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </Reveal>
        ) : null}

        <DeskMap />
      </main>
    </DeskShell>
  );
}

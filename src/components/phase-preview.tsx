import { Countdown } from "@/components/countdown";
import { DocP } from "@/components/prose";
import { stagedFact } from "@/lib/terminus/format";
import { pendingPlates, type DeskPayload } from "@/lib/terminus/types";

const DEVICES = ["this browser", "phone", "desk"] as const;

/** Deck `token.previewHeading`. */
const PREVIEW_HEADING = "Phase 2 preview";
/** Deck `token.previewIntro`. */
const PREVIEW_INTRO = "Same reads. Opens to holders when it ships.";

/** Thin grey caption. Same style as SnapshotNote: a preview is labelled, never passed off as live. */
function Caption() {
  return (
    <p className="mt-4 font-mono text-xs tracking-wide text-ink-subtle">
      {"preview · phase 2 · pass holders"}
    </p>
  );
}

/** Section heading + intro, shown whether or not any name is currently veiled. */
function Heading() {
  return (
    <>
      <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
        {PREVIEW_HEADING}
      </h2>
      <DocP>{PREVIEW_INTRO}</DocP>
    </>
  );
}

/**
 * What phase 2 looks like, built from the top pending rows the desk actually read.
 * Nothing here is invented: every ticker, staged fact and terminus is a real read.
 * Owner pass 2026-09-05: the API feed card (a GET line and a JSON row) is gone; the
 * feed stays a phase-2 line in the copy, not a developer mock on the page.
 */
export function PhasePreview({ desk }: { desk: DeskPayload }) {
  const rows = pendingPlates(desk.rows, 3, desk.clockMs);

  if (rows.length === 0) {
    return (
      <>
        <Heading />
        <div className="panel mt-4 px-4 py-3">
          <p className="font-mono text-xs text-ink">Preview prints when a name is veiled.</p>
          <Caption />
        </div>
      </>
    );
  }

  const first = rows[0];

  return (
    <>
      <Heading />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="panel p-5">
          <p className="kicker-muted">Synced covering</p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-xs uppercase tracking-widest text-ink-subtle">
            {DEVICES.map((d) => (
              <li key={d} className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                {d}
              </li>
            ))}
          </ul>
          <ul className="mt-3 divide-y divide-line">
            {rows.map((r) => (
              <li key={r.ticker} className="flex items-baseline justify-between gap-x-3 py-2">
                <span className="font-mono text-sm text-accent">{r.ticker}</span>
                <span className="min-w-0 flex-1 text-sm text-ink-muted">{stagedFact(r)}</span>
                <span className="font-mono text-xs text-ink-subtle">
                  <Countdown iso={r.effectiveAtIso} />
                </span>
              </li>
            ))}
          </ul>
          <Caption />
        </div>

        <div className="panel p-5">
          <p className="kicker-muted">Terminus alert</p>
          <div className="mt-3 rounded-lg border border-line bg-paper/55 px-3 py-3">
            <p className="flex items-start gap-2 font-mono text-sm text-ink">
              <span
                className="tape-dot mt-[7px] size-1.5 shrink-0 rounded-full bg-accent"
                aria-hidden="true"
              />
              <span className="min-w-0">{`${first.ticker} · terminus in 60 min · ${stagedFact(first)}`}</span>
            </p>
            <p className="mt-1.5 font-mono text-xs text-ink-subtle">alert</p>
          </div>
          <Caption />
        </div>
      </div>
    </>
  );
}

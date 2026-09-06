import { Link } from "@tanstack/react-router";
import { SnapshotNote } from "@/components/snapshot-note";
import { stripTiles } from "@/lib/terminus/strip-tiles";
import type { DeskPayload } from "@/lib/terminus/types";
import { cn } from "@/lib/utils";

const TERMS = ["live ×", "staged ×", "terminus", "veiled"] as const;
/** Shown only when no ticker was read. */
const FALLBACK = "Every stock token on Robinhood Chain. Four reads each.";

/** The kicker carries the tense: a live reading is "right now", a snapshot is the last one. */
function kicker(desk: DeskPayload): string {
  return desk.source === "live" ? "Right now" : "Last reading";
}

/** The strip under the hero (spec §5.3, §9.1.5): four proof tiles, the four terms, the snapshot note. */
export function PlainStrip({ desk }: { desk: DeskPayload }) {
  const tiles = stripTiles(desk);

  return (
    <section aria-labelledby="plain-terms">
      <div className="wrap py-8 lg:py-10">
        <p id="plain-terms" className="kicker">
          {kicker(desk)}
        </p>
        {tiles ? (
          <dl className="mt-4 grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
            {tiles.map((t, i) => (
              <div
                key={t.label}
                className={cn(
                  "flex flex-col-reverse justify-start gap-2 py-3 sm:px-6",
                  i === 0 && "sm:pl-0",
                )}
              >
                <dt className="kicker-muted">{t.label}</dt>
                <dd
                  className={cn(
                    "tabular leading-none",
                    t.label === "block"
                      ? "font-mono text-lg sm:text-xl"
                      : "font-display text-2xl sm:text-3xl",
                    t.zero ? "text-ink-muted" : "text-ink",
                  )}
                >
                  {t.href ? (
                    <a href={t.href} target="_blank" rel="noreferrer" className="hover:text-accent">
                      {t.value} ↗
                    </a>
                  ) : (
                    t.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 font-display text-2xl leading-snug tracking-tight text-ink sm:text-3xl">
            {FALLBACK}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs">
          <ul className="flex flex-wrap items-center gap-x-3">
            {TERMS.map((term) => (
              <li key={term}>
                <Link
                  to="/docs"
                  hash="glossary"
                  className="inline-flex min-h-11 items-center text-accent hover:underline"
                >
                  {term}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to="/docs"
            hash="glossary"
            className="inline-flex min-h-11 items-center text-ink-subtle hover:text-accent"
          >
            Glossary →
          </Link>
        </div>
        <SnapshotNote desk={desk} className="mt-3" />
      </div>
    </section>
  );
}

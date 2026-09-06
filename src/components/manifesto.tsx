import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Chip } from "@/components/chip";
import { Frame } from "@/components/frame";
import { Reveal } from "@/components/reveal";
import { formatMultiplier, formatTerminus } from "@/lib/terminus/format";
import { biggestStagedMove, type TapeMove } from "@/lib/terminus/scenario";
import type { DeskPayload } from "@/lib/terminus/types";
import { cn } from "@/lib/utils";

/** Deck `manifesto.title`, one fragment per line: `Four reads. Zero opinions.` */
const TITLE = ["Four reads.", "Zero opinions."] as const;
/** Spec §5.4: the manifesto opens on why. */
const P0 =
  "Robinhood put stocks on-chain. Every split and reinvested dividend lands on the token as a multiplier, staged on the contract before it lives. A cash dividend prints in dollars.";
const P1 = "Until terminus, the staged figure is not the live figure.";
/** House trim 2026-09-05: the four reads are named on the strip and in the glossary, not here. */
const P2 = "When the feed and the chain disagree, the desk prints both.";

/** The illustration's figures: how a 4-for-1 split reads on the contract. Not a reading. */
const SPLIT_FROM = "1000000000000000000";
const SPLIT_TO = "4000000000000000000";

/**
 * The card beside the manifesto shows the figure to come. When a pending
 * ticker stages a different multiplier, that real move takes the card. Until
 * then it illustrates how a split reads, labelled as an illustration; no
 * money is named either way.
 */
export function Manifesto({ desk }: { desk: DeskPayload }) {
  const move = biggestStagedMove(desk.rows);
  const card = move ? <StagedCard move={move} /> : <SplitCard />;

  return (
    <Reveal>
      <section className="border-t border-line">
        <div className="wrap grid items-center gap-10 py-16 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16 lg:py-24">
          <Frame>{card}</Frame>
          <div>
            <h2 className="max-w-sm font-display text-3xl leading-tight tracking-tight text-ink">
              <span className="italic">{TITLE[0]}</span>
              <span className="mt-2 block">{TITLE[1]}</span>
            </h2>
            <div className="mt-8 max-w-xl space-y-5 text-base leading-relaxed text-pretty text-ink-muted">
              <p>{P0}</p>
              <p>{P1}</p>
              <p>{P2}</p>
            </div>
          </div>
        </div>
      </section>
    </Reveal>
  );
}

function Figure({ from, to, className }: { from: string; to: string; className?: string }) {
  return (
    <p className={cn("mt-4 font-mono text-2xl tabular leading-tight text-ink", className)}>
      {formatMultiplier(from)}
      <span className="mx-2 text-ink-subtle">→</span>
      <span className="text-accent">{formatMultiplier(to)}</span>
    </p>
  );
}

/** A real staged move: `1× → 4×` · `JNJ · terminus Tue 08 Sep · 09:30 ET` · `read from the contract · staged, not live`. */
function StagedCard({ move }: { move: TapeMove }) {
  return (
    <div className="panel p-6 sm:p-7">
      <p className="kicker-muted">Biggest staged move on the tape</p>
      <Figure from={move.from} to={move.to} />
      <p className="mt-3 font-mono text-sm tabular text-ink-muted">
        <span className="text-accent">{move.ticker}</span>
        {move.terminusIso
          ? ` · terminus ${formatTerminus(move.terminusIso).replace(", ", " · ")}`
          : null}
      </p>
      <p className="mt-1 font-mono text-xs text-ink-subtle">
        read from the contract · staged, not live
      </p>
      <Link
        to="/events/$ticker"
        params={{ ticker: move.ticker }}
        className="btn-ghost-sm mt-5 gap-2"
      >
        Open {move.ticker}
        <ArrowRight className="btn-icon" strokeWidth={2} aria-hidden="true" />
      </Link>
    </div>
  );
}

/** The illustration: `1× → 4×` · a 4-for-1 split, staged before it lives · two chips · one caption. */
function SplitCard() {
  return (
    <div className="panel p-6 sm:p-7">
      <p className="kicker-muted">How a split reads</p>
      <Figure from={SPLIT_FROM} to={SPLIT_TO} />
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        A 4-for-1 split, staged before it lives.
      </p>
      <ul className="mt-5 space-y-2.5">
        <li className="flex items-center gap-3">
          <Chip tone="accent">live</Chip>
          <span className="text-sm text-ink-muted">read from the contract</span>
        </li>
        <li className="flex items-center gap-3">
          <Chip tone="ink">phase 2</Chip>
          <span className="text-sm text-ink-muted">alert before it lands</span>
        </li>
      </ul>
      <p className="mt-5 font-mono text-xs tracking-wide text-ink-subtle">
        illustration · a real staged figure takes this card
      </p>
      <Link to="/token" className="btn-ghost-sm mt-5 gap-2">
        See what holders get
        <ArrowRight className="btn-icon" strokeWidth={2} aria-hidden="true" />
      </Link>
    </div>
  );
}

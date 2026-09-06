import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ActionPlate } from "@/components/action-plate";
import { CopyAddress } from "@/components/copy-address";
import { Countdown } from "@/components/countdown";
import { Frame } from "@/components/frame";
import { HeroMark } from "@/components/hero-mark";
import { usePointerField } from "@/components/pointer-field";
import { SnapshotNote } from "@/components/snapshot-note";
import { formatMultiplier, shortAddress } from "@/lib/terminus/format";
import { HOUSE, houseLaunched } from "@/lib/terminus/house";
import type { DeskPayload, TickerRow } from "@/lib/terminus/types";

/** Spec §5.1: the kicker is a status. */
function heroKicker(source: DeskPayload["source"]): string {
  return source === "live"
    ? "Reading Robinhood Chain · live"
    : "Reading Robinhood Chain · snapshot";
}
/** Spec §5.2: the deck is the category sentence. */
const DECK =
  "The corporate-actions desk for Robinhood Chain stock tokens. Every split and reinvested dividend, read from the contract before it lands. Free. Read-only. No wallet.";
/** Deck `hero.veilLine` (not launched), shortened per spec §9.2 O. The launched variant is `LiveHouseLine` below. */
const VEIL_LINE = "$VEIL · not launched · CA lands here first →";
/** The hero copy control (launched): lowercase to sit in the line; on failure the full CA is on /token. */
const HERO_COPY_LABELS = { idle: "copy", done: "copied", failed: "copy failed" };

/** `$VEIL · live on pons · CA 0x1234…abcd · copy` — the link still opens /token; `copy` copies the full CA. */
function LiveHouseLine({ address }: { address: `0x${string}` }) {
  const control =
    "inline-flex min-h-11 items-baseline transition-[color] duration-150 hover:text-accent";
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-sm text-ink-muted">
      <Link to="/token" className={control}>
        <span className="text-accent">{HOUSE.display}</span>
        <span className="whitespace-pre-wrap text-pretty">{` · live on pons · CA ${shortAddress(address)}`}</span>
      </Link>
      <span aria-hidden="true">·</span>
      <CopyAddress address={address} variant="full" labels={HERO_COPY_LABELS} className={control} />
    </p>
  );
}

export function LandingHero({
  row,
  chips,
  onChip,
  desk,
}: {
  row: TickerRow;
  chips: string[];
  onChip: (ticker: string) => void;
  desk: DeskPayload;
}) {
  const fieldRef = useRef<HTMLElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);
  const [loopSrc, setLoopSrc] = useState<string | null>(null);
  usePointerField(fieldRef);
  const veiled = row.state === "veiled" && row.effectiveAtIso;
  const figure =
    row.state === "due" ? (
      "due"
    ) : veiled ? (
      <Countdown iso={row.effectiveAtIso} variant="hero" />
    ) : (
      formatMultiplier(row.live)
    );
  const launched = houseLaunched();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    const boot = () => setLoopSrc("/brand/hero.mp4");
    const ric = window.requestIdleCallback;
    if (typeof ric === "function") {
      const id = ric(boot, { timeout: 400 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(boot, 120);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = loopRef.current;
    if (!el || !loopSrc) return;
    void el.play().catch(() => {});
  }, [loopSrc]);

  return (
    <section ref={fieldRef} className="hero-field relative overflow-hidden">
      <img
        src="/brand/hero.jpg"
        srcSet="/brand/hero-960.jpg 960w, /brand/hero.jpg 1920w"
        sizes="(min-width: 1024px) 1920px, 100vw"
        alt=""
        width={1920}
        height={1080}
        fetchPriority="high"
        decoding="async"
        className="hero-photo hero-still"
      />
      {loopSrc ? (
        <video
          ref={loopRef}
          className="hero-photo hero-loop hero-still"
          muted
          loop
          playsInline
          preload="none"
          poster="/brand/hero.jpg"
          aria-hidden="true"
        >
          <source src={loopSrc} type="video/mp4" />
        </video>
      ) : null}
      <div className="hero-wash" aria-hidden="true" />
      <div className="hero-hatch" aria-hidden="true" />
      <HeroMark />
      <div className="hero-light" aria-hidden="true" />
      <div className="hero-veil-line" aria-hidden="true" />
      <div className="hero-veil-tick" aria-hidden="true" />
      <div className="wrap relative z-10 grid grid-cols-1 items-center gap-8 py-10 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:grid-rows-[auto_auto] lg:content-center lg:gap-x-16 lg:gap-y-6 lg:py-12 lg:min-h-[calc(100svh-8.5rem)]">
        <header className="min-w-0 lg:col-start-1 lg:row-start-1">
          <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="kicker-muted">{heroKicker(desk.source)}</span>
            <span className="kicker">
              {row.ticker} · {row.state}
            </span>
          </p>
          <p className="mt-5 whitespace-nowrap font-mono text-hero font-medium leading-none tracking-tight tabular text-accent">
            {figure}
          </p>
          <h1 className="mt-6 max-w-xl font-display text-2xl leading-snug tracking-tight text-ink sm:text-3xl">
            <span className="block italic">The name is public.</span>
            <span className="mt-2 block text-ink-muted">
              The next action is veiled until terminus.
            </span>
          </h1>
        </header>

        <footer className="min-w-0 lg:col-start-1 lg:row-start-2">
          <p className="max-w-md text-base leading-relaxed text-pretty text-ink">{DECK}</p>
          {launched && HOUSE.address ? (
            <LiveHouseLine address={HOUSE.address} />
          ) : (
            <Link
              to="/token"
              className="mt-5 inline-flex min-h-11 items-baseline font-mono text-sm text-ink-muted transition-[color] duration-150 hover:text-accent"
            >
              <span className="text-accent">{HOUSE.display}</span>
              <span className="whitespace-pre-wrap text-pretty">
                {VEIL_LINE.slice(HOUSE.display.length)}
              </span>
            </Link>
          )}
          <SnapshotNote desk={desk} className="mt-6" />
        </footer>

        <div className="min-w-0 overflow-hidden lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Frame>
            <ActionPlate row={row} chips={chips} onChip={onChip} />
          </Frame>
        </div>
      </div>
    </section>
  );
}

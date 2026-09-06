import { Countdown } from "@/components/countdown";
import { formatMultiplier } from "@/lib/terminus/format";
import type { TickerRow } from "@/lib/terminus/types";

export function TickerReadout({ row }: { row: TickerRow }) {
  const live = formatMultiplier(row.live);
  const veiled = row.state === "veiled" && row.effectiveAtIso;
  const figure =
    row.state === "due" ? (
      "due"
    ) : veiled ? (
      <Countdown iso={row.effectiveAtIso} variant="hero" />
    ) : (
      live
    );

  return (
    <div className="relative min-w-0">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-subtle">
        {row.ticker} · {row.state}
      </p>
      <p className="mt-3 whitespace-nowrap font-display text-3xl font-semibold leading-none tracking-tight tabular text-accent">
        {figure}
      </p>
      <h1 className="mt-5 max-w-md font-display text-lg font-semibold leading-snug tracking-tight text-ink">
        The name is public.
        <br />
        The next action is veiled until terminus.
      </h1>
      <p className="mt-3 hidden max-w-md text-sm leading-relaxed text-pretty text-ink-muted sm:block">
        A split can sit on the contract before it lives. Anyone can read the name. They cannot treat
        the next multiplier as live until terminus.
      </p>
    </div>
  );
}

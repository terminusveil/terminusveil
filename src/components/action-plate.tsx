import { Link } from "@tanstack/react-router";
import type { KeyboardEvent } from "react";
import { AddTerminus } from "@/components/calendar-tools";
import { Chip } from "@/components/chip";
import { CopyLink } from "@/components/copy-link";
import { Countdown } from "@/components/countdown";
import { SealControl } from "@/components/seal-control";
import { explorerAddress } from "@/lib/terminus/chain";
import { useDeskClock } from "@/lib/terminus/desk-clock";
import {
  coveringCaption,
  formatCountdown,
  formatMultiplier,
  formatShareQuote,
  formatTerminus,
  formatTokenUsd,
  multipliersDiffer,
  stagedFact,
} from "@/lib/terminus/format";
import type { TickerRow } from "@/lib/terminus/types";
import { wireFact } from "@/lib/terminus/wire";
import { cn } from "@/lib/utils";

export function ActionPlate({
  row,
  chips,
  onChip,
  door = true,
}: {
  row: TickerRow;
  chips: string[];
  onChip?: (ticker: string) => void;
  door?: boolean;
}) {
  const live = formatMultiplier(row.live);
  const staged = stagedFact(row);
  const disagree = multipliersDiffer(row.liveOnchain, row.liveApi);
  const wire = wireFact(row);
  const clock = useDeskClock() ?? Date.now();
  const caption = coveringCaption(row, clock);
  const share = formatShareQuote(row.priceBid, row.priceAsk, row.priceHalt);
  const tokenUsd = formatTokenUsd(row.priceBid, row.live);
  const pastMs =
    row.state === "due" && row.effectiveAtIso ? clock - Date.parse(row.effectiveAtIso) : 0;

  function onChipKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!onChip || chips.length === 0) return;
    const i = Math.max(0, chips.indexOf(row.ticker));
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onChip(chips[(i + 1) % chips.length] ?? row.ticker);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onChip(chips[(i - 1 + chips.length) % chips.length] ?? row.ticker);
    }
  }

  const verify = row.address ? (
    <a
      className="btn-ghost-sm"
      href={explorerAddress(row.address)}
      target="_blank"
      rel="noreferrer"
    >
      Verify {row.ticker}
    </a>
  ) : null;

  return (
    <section className="panel panel-veil min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tickers" onKeyDown={onChipKey}>
        {chips.map((t) => {
          const active = t === row.ticker;
          const inner = (
            <span
              className={cn(
                "chip inline-flex h-11 min-w-11 items-center justify-center rounded-pill border px-3.5 font-mono text-sm",
                active
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
              )}
            >
              {t}
            </span>
          );
          if (onChip) {
            return (
              <button key={t} type="button" onClick={() => onChip(t)} aria-pressed={active}>
                {inner}
              </button>
            );
          }
          return (
            <Link key={t} to="/" search={{ t }} preload="intent">
              {inner}
            </Link>
          );
        })}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-2">
        <Row k="live" v={live} />
        <Row
          k="staged"
          v={staged}
          sub={row.state === "veiled" || row.state === "due" ? "staged · not live" : null}
        />
        <div className="rounded-lg border border-line bg-paper/55 px-3 py-3">
          <dt className="kicker-muted">terminus</dt>
          <dd className="mt-1.5 font-mono text-sm text-ink">
            <Countdown iso={row.effectiveAtIso} />
            {row.effectiveAtIso ? (
              <span className="mt-0.5 block text-xs text-ink-subtle">
                {formatTerminus(row.effectiveAtIso).replace(", ", " · ")}
                {row.terminusSource === "assumed" ? " · assumed" : ""}
                {pastMs > 0 ? ` · ${formatCountdown(pastMs)} past` : ""}
              </span>
            ) : null}
          </dd>
        </div>
        <Row k="oracle" v={row.oracle} />
      </dl>

      {row.transferPaused ? (
        <p className="mt-3">
          <Chip tone="ink">transfers paused</Chip>
        </p>
      ) : null}

      {wire ? (
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 font-mono text-xs">
          <span className="text-ink-subtle">Wire</span>
          <span className="text-ink-subtle">·</span>
          <span className="text-ink">{wire}</span>
        </p>
      ) : null}

      {tokenUsd !== "—" ? (
        <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-lg tabular leading-none text-ink">{tokenUsd}</span>
          <span className="font-mono text-xs tabular text-ink-subtle">token · share {share}</span>
        </p>
      ) : share !== "—" ? (
        <p className="mt-3 font-mono text-xs tabular text-ink-muted">share {share}</p>
      ) : null}

      {disagree ? (
        <p className="mt-3 rounded-md border border-line px-3 py-3 font-mono text-xs text-ink">
          Issuer {formatMultiplier(row.liveApi)}
          <span className="mx-2 text-ink-subtle">·</span>
          Chain {formatMultiplier(row.liveOnchain)}
          <span className="mt-1 block text-ink-muted">Disagree. Both figures are written.</span>
        </p>
      ) : null}

      {row.stagedDisagree ? (
        <p className="mt-3 rounded-md border border-line px-3 py-3 font-mono text-xs text-ink">
          <span className="text-ink-subtle">staged</span>
          <span className="mx-2 text-ink-subtle">·</span>
          Issuer {formatMultiplier(row.stagedApi)}
          <span className="mx-2 text-ink-subtle">·</span>
          Chain {formatMultiplier(row.stagedOnchain)}
          <span className="mt-1 block text-ink-muted">Disagree. Both figures are written.</span>
        </p>
      ) : null}

      {row.state === "due" || row.state === "paused" || row.state === "absent" ? (
        <p className="mt-5 flex flex-wrap items-baseline justify-between gap-2 font-mono text-sm">
          <span className="text-ink-subtle">{caption.k}</span>
          <span className="text-ink">{caption.v}</span>
        </p>
      ) : null}

      {door ? (
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-5">
          <Link
            to="/events/$ticker"
            params={{ ticker: row.ticker }}
            className="btn-primary min-w-40"
          >
            Open {row.ticker}
          </Link>
          {verify}
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-5">
          {verify}
          <CopyLink path={`/events/${row.ticker}`} className="btn-ghost-sm" />
          <AddTerminus row={row} />
          <SealControl row={row} quiet />
        </div>
      )}
    </section>
  );
}

function Row({ k, v, sub }: { k: string; v: string; sub?: string | null }) {
  return (
    <div className="rounded-lg border border-line bg-paper/55 px-3 py-3">
      <dt className="kicker-muted">{k}</dt>
      <dd className="mt-1.5 font-mono text-sm tabular text-ink">
        {v}
        {sub ? <span className="mt-0.5 block text-xs text-ink-subtle">{sub}</span> : null}
      </dd>
    </div>
  );
}

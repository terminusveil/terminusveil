import { Chip } from "@/components/chip";
import { Ext } from "@/components/prose";
import { EXPLORER_URL, explorerAddress } from "@/lib/terminus/chain";
import { formatBlock, formatReadAt, shortAddress } from "@/lib/terminus/format";
import { HOUSE } from "@/lib/terminus/house";
import type { TickerRow } from "@/lib/terminus/types";
import {
  factoryLogsUrl,
  indexEmpty,
  launchesToShow,
  phaseWord,
  ponsLaunchUrl,
  v4Total,
  windowsHead,
  withPronoun,
} from "@/lib/terminus/windows";

/** Spec §3.3: the pools that hold a veiled ticker. Not a trading surface: no prices, no liquidity, no swap links. */
export function WindowsSection({ row }: { row: TickerRow }) {
  const w = row.windows;
  if (!w) return null;
  const head = windowsHead(row.ticker, w);
  const { list, more } = launchesToShow(w);
  return (
    <section className="wrap pb-12">
      <h2 className="font-display text-sm font-semibold">Windows</h2>
      {indexEmpty(w) ? (
        <p className="mt-3 text-sm text-ink-muted">No windows index captured yet.</p>
      ) : (
        <>
          <p className="mt-3 text-sm text-ink">
            {head.pons ? (
              <>
                {head.pons.count} <Ext href={HOUSE.launchpad.url}>{HOUSE.launchpad.name}</Ext>{" "}
                {head.pons.noun} {head.pons.tail}
              </>
            ) : null}
            {head.pons && head.v4 ? <span className="mx-2 text-ink-subtle">·</span> : null}
            {head.v4 ? (head.pons ? withPronoun(head.v4, row.ticker) : head.v4) : null}
            {!head.pons && !head.v4 ? `No pool holds ${row.ticker} in the index.` : null}
          </p>
          {v4Total(w.v4) > 0 ? (
            <p className="mt-1 font-mono text-xs tabular text-ink-subtle">
              pons {formatBlock(w.v4.pons)} · plain {formatBlock(w.v4.plain)} · other{" "}
              {formatBlock(w.v4.other)}
            </p>
          ) : null}
          {row.transferPaused ? (
            <p className="mt-2 text-sm text-ink-muted">Transfers on {row.ticker} are paused.</p>
          ) : null}
          {list.length > 0 ? (
            <ul className="panel mt-4 divide-y divide-line">
              {list.map((l) => (
                <li
                  key={l.token}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
                >
                  <span className="font-mono text-sm text-ink">
                    {l.symbol ?? shortAddress(l.token)}
                  </span>
                  <Chip tone={l.phase === 2 ? "accent" : "muted"}>{phaseWord(l.phase)}</Chip>
                  <span className="flex gap-4 font-mono text-xs">
                    <a
                      href={ponsLaunchUrl(l.token)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink-subtle hover:text-accent"
                    >
                      pons ↗
                    </a>
                    <a
                      href={explorerAddress(l.token)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink-subtle hover:text-accent"
                    >
                      Explorer ↗
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {more > 0 ? (
            <p className="mt-2 font-mono text-xs text-ink-subtle">
              and {formatBlock(more)} more on the{" "}
              <a
                href={factoryLogsUrl(EXPLORER_URL)}
                target="_blank"
                rel="noreferrer"
                className="hover:text-accent"
              >
                explorer ↗
              </a>
            </p>
          ) : null}
          <p className="mt-4 font-mono text-xs tracking-wide text-ink-subtle">
            read from the pons Factory and the Uniswap v4 PoolManager · to block{" "}
            {formatBlock(w.toBlock)}
            {w.source === "index" ? ` · index read ${formatReadAt(w.readAt)}` : ""}
          </p>
        </>
      )}
    </section>
  );
}

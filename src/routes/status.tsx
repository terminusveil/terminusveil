import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Countdown } from "@/components/countdown";
import { DeskShell } from "@/components/desk-shell";
import { BUILD } from "@/lib/build";
import { HouseCa } from "@/components/house-ca";
import { PageHeader } from "@/components/page-header";
import { SnapshotNote } from "@/components/snapshot-note";
import { pageHead } from "@/lib/site-meta";
import { CHAIN_NAME, explorerAddress, explorerBlock } from "@/lib/terminus/chain";
import { getDesk } from "@/lib/terminus/fetch-desk";
import {
  actionFigure,
  actionLabel,
  formatBlock,
  formatEth,
  formatReadAt,
  shortAddress,
} from "@/lib/terminus/format";
import { houseLaunched, wireExplorerUrl } from "@/lib/terminus/house";
import { pendingPlates } from "@/lib/terminus/types";
import { indexEmpty } from "@/lib/terminus/windows";
import { WINDOWS_INDEX } from "@/lib/terminus/windows-index";

export const Route = createFileRoute("/status")({
  loader: () => getDesk(),
  head: () =>
    pageHead({
      title: "Status · Terminus Veil",
      description:
        "Tape, pending count, and the veiled-now list. Verify the block on the explorer.",
      path: "/status",
    }),
  component: Status,
});

function Status() {
  const desk = Route.useLoaderData();
  const next = pendingPlates(desk.rows, 16, desk.clockMs);
  const tapeAbsent = desk.absent === "tape" || desk.absent === "both" || desk.absent === "forced";
  const feedAbsent = desk.absent === "feed" || desk.absent === "both";
  const sourceWord = desk.source === "live" ? "reading" : "snapshot";
  const launched = houseLaunched();
  // The windows every veiled or due row carries are read in one pass, so the
  // first row that has them states the source and the cap for the whole read.
  const windows = desk.rows.find((r) => r.windows !== null)?.windows ?? null;

  return (
    <DeskShell desk={desk}>
      <main>
        <div className="wrap max-w-3xl py-12 sm:py-16">
          <PageHeader
            kicker="status"
            title="Desk reading"
            lede="Tape, pending count, and the veiled-now list. Verify the block on the explorer."
          />

          <section className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="panel p-5">
              <p className="kicker-muted">Reading</p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-muted">
                <li>Four reads: live ×, staged ×, terminus, oracle.</li>
                <li>Share bid/ask from the issuer quote. Token USD is share × live.</li>
                <li>If issuer and chain disagree, both figures are written.</li>
                <li>Calendar / ICS. Verify on explorer.</li>
              </ul>
            </div>
            <div className="panel p-5">
              <p className="kicker-muted">Not yet</p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-muted">
                {launched ? null : <li>Not launched.</li>}
                <li>Covering is this browser.</li>
                <li>
                  House <HouseCa />
                </li>
                <li>
                  <Link to="/token" className="btn-ghost-sm">
                    Token page
                  </Link>
                </li>
              </ul>
            </div>
          </section>

          <dl className="panel mt-8 divide-y divide-line px-4 font-mono text-sm">
            <Stat k="chain" v={CHAIN_NAME} />
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-ink-subtle">block</dt>
              <dd className="tabular text-ink">
                {desk.tape.block !== null ? (
                  <a
                    href={explorerBlock(desk.tape.block)}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-accent"
                  >
                    Verify {formatBlock(desk.tape.block)}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <Stat k="source" v={desk.source} />
            <Stat k="build" v={`${BUILD.commit} · ${formatReadAt(BUILD.at)}`} />
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-ink-subtle">read at</dt>
              <dd className="tabular text-ink" title={desk.readAt}>
                {formatReadAt(desk.readAt, { seconds: true })}
              </dd>
            </div>
            <Stat k="live tape" v={tapeAbsent ? "absent · retry 45 s" : sourceWord} />
            <Stat
              k="issuer feed"
              v={
                feedAbsent
                  ? "absent · retry 45 s"
                  : desk.feedStale && desk.feedReadAt
                    ? `stale since ${formatReadAt(desk.feedReadAt)}`
                    : sourceWord
              }
            />
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-ink-subtle">house CA</dt>
              <dd className="tabular text-ink">
                <HouseCa />
              </dd>
            </div>
            <Stat k="tickers" v={String(desk.assetCount)} />
            <Stat k="pending actions" v={String(desk.pendingCount)} />
            <Stat k="veiled plates" v={String(desk.veiledCount)} />
            <Stat k="due plates" v={String(desk.dueCount)} />
            <Stat k="staged multipliers" v={String(desk.stagedCount)} />
          </dl>

          <SnapshotNote desk={desk} className="mt-4" />

          <h2 className="mt-12 font-display text-sm font-semibold">Wire</h2>
          <dl className="panel mt-3 divide-y divide-line px-4 font-mono text-sm">
            {desk.wire ? (
              <>
                <Stat
                  k="contract"
                  v={
                    <a
                      href={wireExplorerUrl() ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-accent"
                    >
                      {shortAddress(desk.wire.address)}
                    </a>
                  }
                />
                <Stat
                  k="poster"
                  v={
                    <a
                      href={explorerAddress(desk.wire.poster)}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-accent"
                    >
                      {shortAddress(desk.wire.poster)}
                    </a>
                  }
                />
                <Stat k="posts" v={desk.wire.count === null ? "—" : String(desk.wire.count)} />
                <Stat k="poster balance" v={formatEth(desk.wire.posterBalanceWei)} />
              </>
            ) : (
              <Stat k="wire" v="next" />
            )}
          </dl>

          <h2 className="mt-12 font-display text-sm font-semibold">Windows</h2>
          <dl className="panel mt-3 divide-y divide-line px-4 font-mono text-sm">
            <Stat
              k="index read"
              v={indexEmpty(WINDOWS_INDEX) ? "—" : formatReadAt(WINDOWS_INDEX.readAt)}
            />
            <Stat
              k="to block"
              v={indexEmpty(WINDOWS_INDEX) ? "—" : formatBlock(WINDOWS_INDEX.toBlock)}
            />
            <Stat k="delta" v={windows ? windows.source : "—"} />
            <Stat k="capped" v={windows ? (windows.capped ? "yes" : "no") : "—"} />
          </dl>

          <h2 className="mt-12 font-display text-sm font-semibold">Veiled now</h2>
          {next.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              Nothing veiled. {desk.assetCount} tickers read, none staged or due.
            </p>
          ) : (
            <ul className="panel mt-3 divide-y divide-line">
              {next.map((r) => (
                <li key={r.ticker}>
                  <Link
                    to="/events/$ticker"
                    params={{ ticker: r.ticker }}
                    className="flex min-h-12 flex-wrap items-baseline justify-between gap-2 px-4 py-3"
                  >
                    <span className="font-mono text-sm text-accent">{r.ticker}</span>
                    <span className="text-sm text-ink-muted">
                      {r.action
                        ? `${actionLabel(r.action.type)}${actionFigure(r.action) ? ` ${actionFigure(r.action)}` : ""}`
                        : r.state}
                    </span>
                    <span className="font-mono text-xs tabular text-ink-subtle">
                      <Countdown iso={r.effectiveAtIso} variant="hero" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </DeskShell>
  );
}

function Stat({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-ink-subtle">{k}</dt>
      <dd className="tabular text-ink">{v}</dd>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { DeskShell } from "@/components/desk-shell";
import { DocsTocInline, DocsTocSidebar } from "@/components/docs-toc";
import { Glossary } from "@/components/glossary";
import { HousePill } from "@/components/house-pill";
import { PageHeader } from "@/components/page-header";
import { PhaseTable } from "@/components/phase-table";
import { DocP, DocSection, Ext } from "@/components/prose";
import { SnapshotNote } from "@/components/snapshot-note";
import { pageHead, siteUrl } from "@/lib/site-meta";
import { BUILD } from "@/lib/build";
import { healthPayload } from "@/lib/terminus/api-shape";
import { RHJ_API, SELECTORS, explorerAddress } from "@/lib/terminus/chain";
import { getDesk } from "@/lib/terminus/fetch-desk";
import { shortAddress } from "@/lib/terminus/format";
import {
  HOUSE,
  feeWalletExplorerUrl,
  houseLaunched,
  wireExplorerUrl,
  wireFacts,
} from "@/lib/terminus/house";
import { PONS_FACTORY, UNISWAP_V4_POOL_MANAGER } from "@/lib/terminus/windows";

/** The public mirror of this repository: snapshots, authored by the house, for reading and audit. */
const SOURCE_URL = "https://github.com/terminusveil/terminusveil";

const TOC = [
  { id: "what", label: "What this is" },
  { id: "glossary", label: "Glossary" },
  { id: "reads", label: "What the desk reads" },
  { id: "terminus", label: "Terminus" },
  { id: "states", label: "States" },
  { id: "prices", label: "Prices" },
  { id: "disagree", label: "When sources disagree" },
  { id: "verify", label: "Verify a number" },
  { id: "wire", label: "Wire" },
  { id: "api", label: "API (preview)" },
  { id: "covering", label: "Covering" },
  { id: "roadmap", label: "Roadmap" },
  { id: "token", label: "Token" },
  { id: "not", label: "What this is not" },
  { id: "trust", label: "Who controls what" },
] as const;

/** The public reads, in the order a reader would try them. */
const API_ROUTES = [
  {
    path: "/api/health",
    what: "The build that answered, the chain block and read time, the counts, the Wire and the Pass.",
    cache: "never cached",
  },
  {
    path: "/api/pending",
    what: "Every veiled or due ticker with its four reads, its terminus, its Wire post and its windows.",
    cache: "30 s at the edge",
  },
  {
    path: "/api/ticker/{ticker}",
    what: "One ticker: four reads, transfer pause, terminus, oracle, Wire post, windows, explorer link.",
    cache: "30 s at the edge",
  },
  {
    path: "/api/tape",
    what: "Chain id and the latest block as the desk read them.",
    cache: "30 s at the edge",
  },
  {
    path: "/api/openapi.json",
    what: "The reads above, described once, OpenAPI 3.1.",
    cache: "30 s at the edge",
  },
] as const;

const STATES = [
  { k: "open", v: "no pending action. Multiplier live." },
  { k: "veiled", v: "staged multiplier or in-progress issuer action. Terminus still ahead." },
  { k: "due", v: "process date passed, no multiplier move read yet. Will not guess." },
  {
    k: "paused",
    v: "oracle paused. On-chain price is treated as unavailable. The issuer share quote may still print.",
  },
  { k: "absent", v: "tape did not answer." },
] as const;

/** Spec §7. Party left, powers right; the fee wallet links to the explorer once it exists. */
function TrustTable() {
  const fee = feeWalletExplorerUrl();
  const rows: { party: string; controls: ReactNode }[] = [
    {
      party: "The house",
      controls: (
        <>
          this site and its reads · {fee ? <Ext href={fee}>the fee wallet</Ext> : "the fee wallet"}{" "}
          · the phases and when they ship · @terminus_veil. Cannot touch the token contract, the
          curve, the pool or any issuer figure.
        </>
      ),
    },
    {
      party: "The Wire poster",
      controls:
        "a dedicated wallet the house runs; it can post to the Wire and nothing else. Its address is on this page and on /status. A post cannot be edited or deleted; a new poster is a paste.",
    },
    {
      party: "The source",
      controls: (
        <>
          published at <Ext href={SOURCE_URL}>github.com/terminusveil/terminusveil</Ext> as
          snapshots of the working repository, for reading and audit. Nothing merges there; every
          change lands in the working repository first.
        </>
      ),
    },
    {
      party: "The Pass",
      controls:
        "price: the house's price setter. Burn share, period and the house wallet: nobody, fixed at deploy. No funds rest in the contract. Not deployed until the Key ships.",
    },
    {
      party: "pons",
      controls:
        "the token contract and curve · graduation and the locked pool · trade fee and creator tax mechanics · its Terms of Use.",
    },
    {
      party: "Robinhood, the issuer",
      controls:
        "every stock-token contract · every split, dividend and multiplier · the oracle pause · the feed the desk reads.",
    },
    { party: "Robinhood Chain", controls: "the chain, the RPC, the explorer." },
  ];
  return (
    <dl className="panel mt-4 divide-y divide-line">
      {rows.map((r) => (
        <div
          key={r.party}
          className="grid gap-2 px-5 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4"
        >
          <dt className="font-sans text-sm font-semibold text-ink">{r.party}</dt>
          <dd className="text-sm leading-relaxed text-pretty text-ink-muted">{r.controls}</dd>
        </div>
      ))}
    </dl>
  );
}

export const Route = createFileRoute("/docs")({
  loader: () => getDesk(),
  head: () =>
    pageHead({
      title: "Docs · how Terminus Veil reads Robinhood Chain stock tokens",
      description:
        "Every figure on the desk, where it comes from, and how to check it on the explorer.",
      path: "/docs",
    }),
  component: Docs,
});

function Code({ children }: { children: ReactNode }) {
  return <code className="text-ink">{children}</code>;
}

function Read({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-ink-subtle">{k}</dt>
      <dd className="tabular text-ink">{v}</dd>
    </div>
  );
}

function Docs() {
  const desk = Route.useLoaderData();
  const wire = wireFacts();
  const wireUrl = wireExplorerUrl();

  return (
    <DeskShell desk={desk}>
      <main>
        <div className="wrap py-12 sm:py-16 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-x-12">
          <DocsTocSidebar items={TOC} />
          <div className="min-w-0 max-w-3xl">
            <PageHeader
              kicker="docs"
              title={`How the desk reads, and what ${HOUSE.display} is for`}
              lede="The name is public. The next action is veiled until terminus."
            >
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                This page explains every figure on the desk, where it comes from, and how to check
                it yourself.
              </p>
            </PageHeader>

            <DocsTocInline items={TOC} />

            <DocSection id="what" title="What this is">
              <DocP>
                Terminus Veil is a free, read-only desk for corporate actions on Robinhood Chain
                stock tokens. It shows which tickers have a split or dividend pending, the
                multiplier in force now, the one that is staged, and the exact moment it switches.
                Nothing to sign. Every figure links to the explorer. It reads about 190 tickers on
                every pass and writes absent, never a guess, when a source does not answer, or
                serves its last committed reading with its read time.
              </DocP>
              <p className="mt-3 font-mono text-xs tabular text-ink">
                Pending {desk.pendingCount}. Tickers {desk.assetCount}.
              </p>
              <SnapshotNote desk={desk} className="mt-2" />
            </DocSection>

            <DocSection id="glossary" title="Glossary">
              <Glossary className="mt-5" />
            </DocSection>

            <div id="spec" className="scroll-mt-24" />
            <DocSection id="reads" title="What the desk reads">
              <h3 className="mt-5 font-sans text-sm font-semibold text-ink">From the contract</h3>
              <DocP>
                Every stock token on Robinhood Chain implements{" "}
                <Ext href="https://docs.robinhood.com/chain/building-with-stock-tokens/">
                  ERC-8056
                </Ext>
                , the Scaled UI Amount extension. The desk makes four calls per name:{" "}
                <Code>uiMultiplier()</Code> <Code>{SELECTORS.uiMultiplier}</Code>,{" "}
                <Code>newUIMultiplier()</Code> <Code>{SELECTORS.newUIMultiplier}</Code>,{" "}
                <Code>effectiveAt()</Code> <Code>{SELECTORS.effectiveAt}</Code>,{" "}
                <Code>oraclePaused()</Code> <Code>{SELECTORS.oraclePaused}</Code>. A fifth call,{" "}
                <Code>paused()</Code> <Code>{SELECTORS.transferPaused}</Code>, is Robinhood's
                transfer pause, per token or registry-wide; the plate prints transfers paused when
                it is true. Values are 18-decimal fixed point: 1e18 is 1.0×. The contract also emits{" "}
                <Code>UIMultiplierUpdated</Code> with the old value, the new value and the effective
                timestamp; the desk polls rather than subscribes today.
              </DocP>
              <h3 className="mt-6 font-sans text-sm font-semibold text-ink">
                From the issuer feed
              </h3>
              <DocP>
                <Ext href="https://docs.robinhood.com/chain/stock-token-apis/">
                  Three read-only endpoints
                </Ext>{" "}
                under <Code>{RHJ_API}</Code>: <Code>/assets</Code> (name, contract,
                currentMultiplier, pendingMultiplier, pendingMultiplierEffectiveTime),{" "}
                <Code>/corporate-actions</Code> (type, status, processDate, rate or oldRate and
                newRate), <Code>/prices/{"{symbol}"}</Code> (bid, ask, halt).
              </DocP>
              <h3 className="mt-6 font-sans text-sm font-semibold text-ink">
                From the <Ext href={HOUSE.launchpad.url}>{HOUSE.launchpad.name}</Ext> Factory and
                the Uniswap v4 PoolManager
              </h3>
              <DocP>
                Windows. For a veiled ticker the desk lists the {HOUSE.launchpad.name} launches
                that named it as their pair asset, the token they trade against, and counts the
                Uniswap v4 pools that hold it. Launches come from the
                Factory's <Code>TokenLaunched</Code> events at <Code>{PONS_FACTORY}</Code>; pools
                from the PoolManager's <Code>Initialize</Code> events at{" "}
                <Code>{UNISWAP_V4_POOL_MANAGER}</Code>, classed by hook: pons's own hook, none, or
                another protocol's. The history is a committed index, dated on the page with the
                block it reaches; a refresh reads a bounded stretch past it, never the whole gap,
                so that block is the edge of what is listed. Counts, names and links only: no
                prices, no liquidity, no swap links.
              </DocP>
              <h3 className="mt-6 font-sans text-sm font-semibold text-ink">How often</h3>
              <dl className="panel mt-3 divide-y divide-line px-4 font-mono text-sm">
                {[
                  ["chain tape", "every 45 s"],
                  ["issuer assets", "every 60 s"],
                  ["corporate actions", "every 60 min"],
                  ["quotes", "every 15 s"],
                  ["if a source is slow", "served stale up to 3 min"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 py-3">
                    <dt className="text-ink-subtle">{k}</dt>
                    <dd className="tabular text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              <DocP>
                When a source does not answer, the desk serves its last committed reading, captioned
                with its read time and block, and writes absent where that reading has nothing. It
                never guesses a figure.
              </DocP>
            </DocSection>

            <DocSection id="terminus" title="Terminus">
              <DocP>
                Terminus is the moment staged becomes live. The desk takes, in order: the issuer's{" "}
                <Code>pendingMultiplierEffectiveTime</Code>; else the contract's{" "}
                <Code>effectiveAt</Code> when it is in the future; else the issuer's{" "}
                <Code>processDate</Code> at 09:30 America/New_York, the cash-session open. The third
                is an assumption and the plate marks it "time assumed". After the process date, if
                no move has been read, the ticker is due. The desk will not guess.
              </DocP>
            </DocSection>

            <DocSection id="states" title="States">
              <ul className="mt-4 space-y-2 text-sm text-ink-muted">
                {STATES.map((s) => (
                  <li key={s.k}>
                    <span className="font-mono text-accent">{s.k}</span> · {s.v}
                  </li>
                ))}
              </ul>
            </DocSection>

            <DocSection id="prices" title="Prices">
              <DocP>
                Share bid/ask is the issuer's underlier quote, not multiplier-adjusted. Token USD is
                share × live.{" "}
                <Ext href="https://docs.chain.link/data-feeds/tokenized-equity-feeds/robinhood">
                  Robinhood's Chainlink feeds
                </Ext>{" "}
                quote the token price with the multiplier already applied, and honour{" "}
                <Code>oraclePaused</Code>; the desk does not read Chainlink today. Robinhood Chain
                is an L2; during a sequencer outage feeds can go stale, and so can this desk.
              </DocP>
            </DocSection>

            <DocSection id="disagree" title="When sources disagree">
              <DocP>
                If the issuer feed and the chain give different live multipliers, both are written
                on the plate. The chain is the judge of what is live.
              </DocP>
            </DocSection>

            <DocSection id="verify" title="Verify a number">
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-muted">
                <li>Open a plate.</li>
                <li>Follow Verify to the token on Blockscout.</li>
                <li>
                  Under Read contract, read <Code>uiMultiplier</Code>, <Code>newUIMultiplier</Code>,{" "}
                  <Code>effectiveAt</Code>, <Code>oraclePaused</Code>.
                </li>
                <li>Compare with the plate. Live, staged, terminus, oracle.</li>
                <li>
                  Open <Code>{RHJ_API}/corporate-actions</Code> for the issuer's reason.
                </li>
              </ol>
            </DocSection>

            <DocSection id="wire" title="Wire">
              <DocP>
                The Wire is the desk's reads, posted on Robinhood Chain. For a ticker it holds the
                staged multiplier and the terminus as the token contract held them at the time of
                the post, and the time of the post. Anyone may post; the desk reads only the house's
                poster. A post is the contract's value then, and the plate says whether it still
                matches the contract now. Every name the desk reads is posted, and posts land in
                batches: one transaction carries every name whose figure changed since the last
                post, so many posts share a time.
              </DocP>
              <dl className="panel mt-4 divide-y divide-line px-4 font-mono text-sm">
                {wire && wireUrl ? (
                  <>
                    <Read k="contract" v={<Ext href={wireUrl}>{shortAddress(wire.address)}</Ext>} />
                    <Read
                      k="poster"
                      v={<Ext href={explorerAddress(wire.poster)}>{shortAddress(wire.poster)}</Ext>}
                    />
                  </>
                ) : (
                  <Read k="wire" v="next" />
                )}
                <Read k="read" v="latest(poster, ticker) → staged, terminus, postedAt" />
                <Read k="ticker" v="UTF-8, right-padded to bytes32" />
                <Read k="terminus 0" v="the contract has not set one" />
              </dl>
              <DocP>
                To check one: open the Wire on the explorer, Read contract, <Code>latest</Code> with
                the poster and the ticker as bytes32, and compare with the token's{" "}
                <Code>newUIMultiplier</Code> and <Code>effectiveAt</Code>. No post is ever edited or
                deleted; a new post replaces the latest.
              </DocP>
            </DocSection>

            <DocSection id="api" title="API (preview)">
              <DocP>
                Public reads, JSON, no key: the same data the pages render. A preview of the phase 2
                feed; limits may follow.
              </DocP>
              <dl className="panel mt-4 divide-y divide-line">
                {API_ROUTES.map((r) => (
                  <div
                    key={r.path}
                    className="grid gap-1 px-5 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4"
                  >
                    <dt className="font-mono text-sm text-ink">{r.path}</dt>
                    <dd className="text-sm leading-relaxed text-ink-muted">
                      {r.what} <span className="text-ink-subtle">· {r.cache}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <pre className="panel mt-4 overflow-x-auto px-5 py-4 font-mono text-xs leading-relaxed text-ink-muted">
                <code>
                  {`$ curl -s ${siteUrl()}/api/health
`}
                  {JSON.stringify(healthPayload(desk, BUILD), null, 2)}
                </code>
              </pre>
              <p className="mt-2 font-mono text-xs tracking-wide text-ink-subtle">
                preview · free · no key · limits may follow
              </p>
            </DocSection>

            <DocSection id="covering" title="Covering">
              <DocP>
                Seal until terminus writes ticker, staged multiplier and terminus into this browser.
                It is not a wallet and not a trade. Lift removes it. Phase 2 syncs it across devices
                for pass holders.{" "}
                <Link to="/cover" className="text-accent hover:underline">
                  Open the covering
                </Link>
                .
              </DocP>
            </DocSection>

            <DocSection id="roadmap" title="Roadmap">
              <PhaseTable />
            </DocSection>

            <DocSection id="token" title="Token">
              <DocP>
                {HOUSE.display} is the house token. The pass to the Key.{" "}
                {houseLaunched() ? "Launched" : "Launches"} on{" "}
                <Ext href={HOUSE.launchpad.url}>{HOUSE.launchpad.name}</Ext>, on Robinhood Chain.
                Read why it exists, supply, fees and risks on the{" "}
                <Link to="/token" className="text-accent hover:underline">
                  token page
                </Link>
                .
              </DocP>
              <div className="mt-4">
                <HousePill />
              </div>
            </DocSection>

            <DocSection id="not" title="What this is not">
              <ul className="mt-4 space-y-2 text-sm text-ink-muted">
                <li>Not a share. No vote.</li>
                <li>Not a cash dividend from the issuer. The desk does not pay it.</li>
                <li>Not a wrap. 1 AAPL stays 1 AAPL.</li>
                <li>Not a broker, dealer or authorised participant.</li>
                <li>Not affiliated with, or endorsed by, Robinhood Markets, Inc.</li>
              </ul>
            </DocSection>

            <DocSection id="trust" title="Who controls what">
              <TrustTable />
              <DocP>
                The desk holds no funds and no wallet connection; the one key it runs is the Wire
                poster's, which can post and nothing else. When a source does not answer, the desk
                serves its last committed reading, captioned with its read time and block, and
                writes absent where that reading has nothing. It never guesses a figure.
              </DocP>
            </DocSection>
          </div>
        </div>
      </main>
    </DeskShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { DeskShell } from "@/components/desk-shell";
import { HouseCa, HouseCaBlock } from "@/components/house-ca";
import { HouseLinks } from "@/components/house-links";
import { HousePill } from "@/components/house-pill";
import { HouseSpec } from "@/components/house-spec";
import { LaunchStrip } from "@/components/launch-strip";
import { PageHeader } from "@/components/page-header";
import { PhasePreview } from "@/components/phase-preview";
import { PhaseTable } from "@/components/phase-table";
import { DocP, DocSection, Ext } from "@/components/prose";
import { VerifyTable } from "@/components/verify-table";
import { pageHead } from "@/lib/site-meta";
import { CHAIN_ID, EXPLORER_URL, explorerBlock } from "@/lib/terminus/chain";
import { getDesk } from "@/lib/terminus/fetch-desk";
import { formatBlock, formatReadAt } from "@/lib/terminus/format";
import { HOUSE, houseLaunched, launchpadTermsUrl } from "@/lib/terminus/house";
import { passFact } from "@/lib/terminus/pass";
import { cn } from "@/lib/utils";

/** Deck `token.lede`; v2 rewrite (spec §5): lowercase pons, its first mention linked to the app. */
const LEDE = "The house token of a desk that already runs. Launches on pons; the pass to the Key.";
/** Launched variant of deck 'token.lede' (house ruling). */
const LEDE_LAUNCHED =
  "The house token of a desk that already runs. Live on pons; the pass to the Key.";
/** Deck `token.whyHeading`. */
const WHY_HEADING = "Why $VEIL exists";
/** Deck `token.pullQuote`. */
const PULL_QUOTE = "Read the staged figure as live and you are wrong about what you hold.";
/** Deck `token.why1`. */
const WHY1 =
  "A corporate action sits on the contract before it lands. Every stock token carries uiMultiplier; a split or reinvested dividend rewrites it. The next value is staged as newUIMultiplier with an effectiveAt stamp, and on a large move the price feed pauses until the issuer confirms.";
/** Deck `token.why2`. */
const WHY2 =
  "The desk is live. For every stock token on Robinhood Chain it reads live ×, staged ×, terminus and oracle, shows the pools that hold a veiled ticker, groups pending actions by date, exports them to your calendar and links every figure to the explorer. Free, no wallet, and it stays that way.";
/** Deck `token.why3`. */
const WHY3 =
  "$VEIL is the pass to the Key: an alert before terminus, an API and webhook feed of the pending tape, the covering synced across devices. Public reads stay free.";
/** House ask 2026-09-06 (density): who the paid layer is for, named by what they hold or run, never by a return. */
const WHO =
  "The Key is for whoever holds a stock token through a process date, provides liquidity to a pool that holds a veiled ticker, or runs a strategy on the pending tape. The windows section lists those pools; the feed carries that tape.";
/** theKeyBurns: the mechanism, no number typed; the share prints from the pass contract (verify table). */
const WHY3B =
  "The Key is opened by a pass paid in $VEIL. A share of every pass burns; the rest funds the build. The share is a constant in the pass contract, printed on this page from the chain, not from this text.";
/** House ask 2026-09-06 (density): where a pass payment goes, as VeilPass moves it in one transaction. */
const FLOW =
  "A pass is paid in $VEIL. The burn share leaves the supply in the same transaction, sent to the dead address; the rest reaches the house wallet and funds the build. Nothing rests in the pass contract.";
/** Deck `token.why4`; v2 rewrite (readiness item 2): curve first, the locked pool at graduation. The last clause flips at launch (spec §5). */
const WHY4_LEAD =
  "The token launches before the Key ships because the desk was built without funding. pons launches a fixed-supply token on a bonding curve that graduates into a locked pool and pays the creator a share of trading fees. That share is the build budget for the Key, and ";
/** Launched variant of `token.why4`'s lead sentence (house ruling): tense only, same clause after. */
const WHY4_LEAD_LAUNCHED =
  "The token launched before the Key shipped because the desk was built without funding. pons launches a fixed-supply token on a bonding curve that graduates into a locked pool and pays the creator a share of trading fees. That share is the build budget for the Key, and ";
const WHY4_TAIL = "the fee wallet goes public at launch.";
const WHY4_TAIL_LAUNCHED = "the fee wallet is public.";
/** Deck `token.why5`. */
const WHY5 =
  "The house does not invent a number, gate public data, wrap a share, pay a dividend or hold funds. Phases carry a status, not a deadline.";

/** Spec §6.2: what $VEIL is, and is not; the same facts the phase table and the risks carry, gathered. */
const IS = [
  "the pass to the Key",
  "fixed supply, minted to the curve",
  "public on the explorer",
] as const;
const IS_NOT = [
  "a share or equity",
  "a claim on fees",
  "a share of pass revenue",
  "a vote",
  "required to read the desk",
] as const;

/**
 * House ask 2026-09-06 (density): the pass as VeilPass holds it (contracts/README.md), one line per
 * mechanism, no number: the period, the price and its ceiling, buying for another wallet, access by
 * signature, and what is fixed at deploy. Status "next" until the Pass is pasted.
 */
const PASS_HEADING = "The pass, in practice";
const PASS_KICKER = "phase 2 · next · as the pass contract holds it";
const PASS_LINES = [
  {
    strong: "Period.",
    rest: "A pass runs for a fixed period written into the contract. Buying again extends it from where it ends, never from today.",
  },
  {
    strong: "Price.",
    rest: "Set by the house and printed on this page from the chain. A purchase carries the price you were shown as a ceiling; if the price moved in between, the purchase fails instead of paying more.",
  },
  {
    strong: "For another wallet.",
    rest: "A pass can be bought for a wallet that is not the buyer's: the buyer pays, the wallet named is credited.",
  },
  {
    strong: "Access.",
    rest: "The Key opens to a signature from the wallet that holds a pass. No transaction, no funds move, and the public desk stays wallet-free.",
  },
  {
    strong: "Fixed at deploy.",
    rest: "The burn share, the period and the house wallet cannot change. Only the price can, and only the house can change it.",
  },
] as const;

/** Deck `token.launchHeading` (spec §6.3): the strip folds in what Supply and fees used to carry. */
const LAUNCH_HEADING = "Launch";
/** Deck `token.supply3`; v2 rewrite (spec §5). The words "pons docs" link to `HOUSE.launchpad.docs`. */
const SUPPLY3_PREFIX =
  "Trading fees are split between creator and protocol by pons; the creator share funds the build. Mechanics per ";
const SUPPLY3_LINK = "pons docs";
/** v2 rewrite (spec §2.4): the creator tax is a levy on trades, so one sentence and never a number. */
const SUPPLY_CREATOR_TAX = "A creator tax applies on pons trades; the rate is on the token page.";

/** Deck `token.getHeading`. */
const GET_HEADING = "Get $VEIL";
/** Deck `token.getNotLaunched`. */
const GET_NOT_LAUNCHED = "Not launched.";
/** Deck `token.getNotLaunchedSub`. */
const GET_NOT_LAUNCHED_SUB =
  "The contract address lands here first, then on X. Anything else is not us.";
/** Deck `token.step1`–`token.step4`. */
const STEP1 = "A wallet on Robinhood Chain.";
const STEP2 = "ETH on Robinhood Chain for gas and the trade.";
const STEP3 = "Open the pons page linked here and trade from your wallet.";
const STEP4 = "Check the CA against this page and the explorer. Lookalikes exist.";
/** Eligibility under step 3 (spec §5; readiness item 12). "Terms of Use" links to pons's terms. */
const ELIGIBILITY_PREFIX = "Trading happens on pons under its ";
const ELIGIBILITY_LINK = "Terms of Use";
const ELIGIBILITY_SUFFIX =
  ": 18 or older, and not in the United Kingdom, an EU member state or a sanctioned jurisdiction.";

/** Deck `token.risksHeading`. */
const RISKS_HEADING = "Risks";
/** Deck `token.risk1`–`token.risk4`; the first word before the period is bolded, as today. */
const RISKS = [
  { strong: "Price.", rest: "$VEIL trades in a thin public pool and can go to zero." },
  {
    strong: "Rights.",
    rest: "Not a share, not equity, no fee claim, no vote. A pass to the Key, nothing more.",
  },
  { strong: "Delivery.", rest: "Phases carry a status, not a date. Upstream feeds can go silent." },
  // v2 rewrite (spec §5): the audit fact, stated as a risk rather than under Supply, per the Pons v2 facts file.
  {
    strong: "Launchpad.",
    rest: "pons v2 is new and, by its own docs, unaudited. Its contracts and rules are pons's.",
  },
] as const;

/** Deck `token.verifyHeading`. */
const VERIFY_HEADING = "Verify $VEIL";

/** Links the first `pons` in a lede to the app (attribution rule: lowercase, and a link back). */
function withLaunchpadLink(text: string): ReactNode {
  const { name, url } = HOUSE.launchpad;
  const i = text.indexOf(name);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <Ext href={url}>{name}</Ext>
      {text.slice(i + name.length)}
    </>
  );
}

/** Launched: the pons page, and the pool once `links.pair` is set. */
function GetControls() {
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      {HOUSE.links.pons ? (
        <a href={HOUSE.links.pons} target="_blank" rel="noreferrer" className="btn-primary">
          Open on {HOUSE.launchpad.name}
        </a>
      ) : null}
      {HOUSE.links.pair ? (
        <a href={HOUSE.links.pair} target="_blank" rel="noreferrer" className="btn-ghost">
          Pool
        </a>
      ) : null}
    </div>
  );
}

function IsList({ head, items }: { head: "Is" | "Is not"; items: readonly string[] }) {
  return (
    <div className="panel p-5">
      <p className="kicker-muted">{head}</p>
      <ul className="mt-3 space-y-1.5 font-mono text-sm text-ink">
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

export const Route = createFileRoute("/token")({
  loader: () => getDesk(),
  head: () =>
    pageHead({
      title: `${HOUSE.display} · the house token of Terminus Veil`,
      description: `The pass to the Key of a live corporate-action desk on Robinhood Chain. ${houseLaunched() ? "Launched" : "Launches"} on pons. Supply, fees, phases and risks, in plain terms.`,
      path: "/token",
      // State-neutral card: wordmark, `$VEIL · house token · on pons`; no launch state, no numbers, never the CA.
      image: "/og-token.jpg",
      imageAlt: "$VEIL, the house token of Terminus Veil, on pons",
    }),
  component: Token,
});

function Token() {
  const desk = Route.useLoaderData();
  const live = houseLaunched();
  const lp = HOUSE.launchpad;

  return (
    <DeskShell desk={desk}>
      <main>
        <div className="wrap max-w-2xl py-12 sm:py-16">
          <PageHeader
            kicker="token"
            title={HOUSE.display}
            lede={withLaunchpadLink(live ? LEDE_LAUNCHED : LEDE)}
          >
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <HousePill asStamp />
              <HouseCa />
              <HouseLinks pills />
            </div>
            <HouseCaBlock className="mt-4" />
            <HouseSpec className="mt-5" />
          </PageHeader>

          <DocSection id="why" title={WHY_HEADING} rule>
            <blockquote className="mt-5 font-display text-2xl leading-snug tracking-tight text-ink">
              {PULL_QUOTE}
            </blockquote>
            <DocP className="mt-5">{WHY1}</DocP>
            <DocP>{WHY2}</DocP>
            <div className="panel mt-4 px-4 py-3 font-mono text-xs tabular text-ink">
              {desk.source === "snapshot" ? (
                <>
                  Snapshot · read {formatReadAt(desk.readAt)} · {desk.pendingCount} pending actions
                  across {desk.assetCount} tickers at block {formatBlock(desk.tape.block)}.
                </>
              ) : (
                <>
                  Right now: {desk.pendingCount} pending actions across {desk.assetCount} tickers,
                  read at block{" "}
                  {desk.tape.block !== null ? (
                    <a
                      href={explorerBlock(desk.tape.block)}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-accent"
                    >
                      {formatBlock(desk.tape.block)}
                    </a>
                  ) : (
                    formatBlock(desk.tape.block)
                  )}
                  .
                </>
              )}
            </div>
            <DocP>{WHY3}</DocP>
            <DocP>{WHO}</DocP>
            <DocP>{WHY3B}</DocP>
            <DocP>{FLOW}</DocP>
            <DocP>
              {live ? WHY4_LEAD_LAUNCHED : WHY4_LEAD}
              {live ? WHY4_TAIL_LAUNCHED : WHY4_TAIL}
            </DocP>
            <DocP>{WHY5}</DocP>
          </DocSection>

          <DocSection id="phases" title="Utility by phase" rule>
            <PhaseTable />
          </DocSection>

          <section id="preview" className="mt-12 scroll-mt-24">
            <PhasePreview desk={desk} />
          </section>

          <DocSection id="pass" title={PASS_HEADING} rule>
            <p className="kicker-muted mt-3">{PASS_KICKER}</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-muted">
              {PASS_LINES.map((l) => (
                <li key={l.strong}>
                  <strong className="font-medium text-ink">{l.strong}</strong> {l.rest}
                </li>
              ))}
            </ul>
          </DocSection>

          <DocSection id="is" title={`What ${HOUSE.display} is`} rule>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <IsList head="Is" items={IS} />
              <IsList head="Is not" items={IS_NOT} />
            </div>
          </DocSection>

          <DocSection id="launch" title={LAUNCH_HEADING} rule>
            <LaunchStrip />
            <DocP className="mt-6">
              {SUPPLY3_PREFIX}
              <Ext href={lp.docs}>{SUPPLY3_LINK}</Ext>.
            </DocP>
            <DocP>{SUPPLY_CREATOR_TAX}</DocP>
          </DocSection>

          <DocSection id="get" title={GET_HEADING} rule>
            {live ? (
              <GetControls />
            ) : (
              <div className="panel mt-4 p-5">
                <p className="font-display text-lg text-ink">{GET_NOT_LAUNCHED}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {GET_NOT_LAUNCHED_SUB}
                </p>
              </div>
            )}
            <ol className="mt-6 space-y-4 text-sm leading-relaxed text-ink-muted">
              <li>
                <span className="font-mono text-accent">01</span>
                <span className="ml-3 text-ink">{STEP1}</span>
                <span className="mt-2 grid gap-1 rounded-md border border-line bg-paper/55 px-3 py-2 font-mono text-xs text-ink-muted [overflow-wrap:anywhere]">
                  <span>chain id {CHAIN_ID}</span>
                  <span>
                    <Ext href={EXPLORER_URL}>explorer</Ext>
                  </span>
                </span>
              </li>
              <li>
                <span className="font-mono text-accent">02</span>
                <span className="ml-3">{STEP2}</span>
              </li>
              <li>
                <span className="font-mono text-accent">03</span>
                <span className={cn("ml-3", !live && "text-ink-subtle")}>{STEP3}</span>
                <DocP className="mt-2 sm:text-sm">
                  {ELIGIBILITY_PREFIX}
                  <Ext href={launchpadTermsUrl()}>{ELIGIBILITY_LINK}</Ext>
                  {ELIGIBILITY_SUFFIX}
                </DocP>
              </li>
              <li>
                <span className="font-mono text-accent">04</span>
                <span className="ml-3">{STEP4}</span>
              </li>
            </ol>
          </DocSection>

          <DocSection id="risks" title={RISKS_HEADING} rule>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-muted">
              {RISKS.map((r) => (
                <li key={r.strong}>
                  <strong className="font-medium text-ink">{r.strong}</strong> {r.rest}
                </li>
              ))}
            </ul>
          </DocSection>

          <DocSection id="verify" title={VERIFY_HEADING} rule>
            <VerifyTable passFact={desk.pass ? passFact(desk.pass) : null} />
          </DocSection>
        </div>
      </main>
    </DeskShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { DeskShell } from "@/components/desk-shell";
import { PageHeader } from "@/components/page-header";
import { Ext } from "@/components/prose";
import { pageHead, X_HANDLE } from "@/lib/site-meta";
import { getDesk } from "@/lib/terminus/fetch-desk";
import { HOUSE, launchpadTermsUrl } from "@/lib/terminus/house";

/** Spec §5 "Terms (T6)": rendered from the mono `Last updated` line. The owner updates this on a real copy change. */
const TERMS_UPDATED = "2026-09-05";

export const Route = createFileRoute("/terms")({
  loader: () => getDesk(),
  head: () =>
    pageHead({
      title: "Terms · Terminus Veil",
      description: `What this desk is, what it is not, and what ${HOUSE.display} is not.`,
      path: "/terms",
    }),
  component: Terms,
});

function Terms() {
  const desk = Route.useLoaderData();
  return (
    <DeskShell desk={desk}>
      <main className="wrap max-w-3xl py-12 sm:py-16">
        <PageHeader kicker="legal" title="Terms" />
        <div className="mt-8 space-y-4 text-sm leading-relaxed text-ink-muted">
          <p>
            Terminus Veil is a reading desk for public stock-token data on Robinhood Chain. It is
            not a broker, not a dealer, not an authorised participant, and not Robinhood Markets,
            Inc.
          </p>
          <p>
            Provided as is, without warranty. Figures can be wrong, late or stale. Verify on the
            explorer before you act.
          </p>
          <p>
            When a source does not answer, the desk serves its last committed reading, captioned
            with its read time and block, and writes absent where that reading has nothing. It never
            guesses a figure.
          </p>
          <p>
            {HOUSE.display} is an access token for Terminus Veil's holder features. It is not a
            share, not equity, not a claim on fees or revenue, and carries no vote. {HOUSE.display}{" "}
            is created on <Ext href={HOUSE.launchpad.url}>{HOUSE.launchpad.name}</Ext>{" "}
            {HOUSE.launchpad.version}. Its price is set by a public curve, then a public pool, that
            the house does not control. Nothing on this site is an offer, a solicitation, or advice.
          </p>
          <p>
            Trading {HOUSE.display} happens on {HOUSE.launchpad.name} under {HOUSE.launchpad.name}
            's <Ext href={launchpadTermsUrl()}>Terms of Use</Ext>, which require you to be 18 or
            older and exclude the United Kingdom, EU member states and sanctioned jurisdictions.
          </p>
          <p>
            Operated by {HOUSE.name}. Contact:{" "}
            {HOUSE.links.x ? <Ext href={HOUSE.links.x}>{X_HANDLE}</Ext> : X_HANDLE} on X.
          </p>
          <p className="font-mono text-xs text-ink-subtle">Last updated {TERMS_UPDATED}</p>
        </div>
      </main>
    </DeskShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { DeskShell } from "@/components/desk-shell";
import { PageHeader } from "@/components/page-header";
import { pageHead } from "@/lib/site-meta";
import { getDesk } from "@/lib/terminus/fetch-desk";

export const Route = createFileRoute("/privacy")({
  loader: () => getDesk(),
  head: () =>
    pageHead({
      title: "Privacy · Terminus Veil",
      description:
        "What this desk stores: a covering in your browser, and the host's request logs. No accounts, no cookies.",
      path: "/privacy",
    }),
  component: Privacy,
});

function Privacy() {
  const desk = Route.useLoaderData();
  return (
    <DeskShell desk={desk}>
      <main className="wrap max-w-3xl py-12 sm:py-16">
        <PageHeader kicker="legal" title="Privacy" />
        <div className="mt-8 space-y-4 text-sm leading-relaxed text-ink-muted">
          <p>
            This desk reads public chain data and the issuer's public stock-token API. It does not
            collect accounts, emails, or wallet connections on this surface.
          </p>
          <p>
            Tape, multipliers, and corporate-action rows are fetched server-side from public
            endpoints and shown as returned. When a source does not answer, the desk serves its last
            committed reading, captioned with its read time and block, and writes absent where that
            reading has nothing. It never guesses a figure. It does not store visitor identifiers.
          </p>
          <p>
            An open tab polls the desk every 45 seconds while the page stays open. An ICS calendar
            subscription is a public URL with no identifiers beyond the ticker you chose; whatever
            calendar app you point at it fetches that URL directly.
          </p>
          <p>
            No cookies. No analytics. The host (Vercel) keeps standard server logs, including IP
            address and user agent, under its own policy.
          </p>
          <p>
            Covering (Seal until terminus) is stored only in this browser, as ticker + staged
            multiplier + terminus. It does not leave the machine. Lift deletes it. Clearing site
            data deletes it.
          </p>
        </div>
      </main>
    </DeskShell>
  );
}

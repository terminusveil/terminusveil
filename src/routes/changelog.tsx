import { createFileRoute } from "@tanstack/react-router";
import { DeskShell } from "@/components/desk-shell";
import { PageHeader } from "@/components/page-header";
import { pageHead } from "@/lib/site-meta";
import { CHANGELOG } from "@/lib/terminus/changelog";
import { getDesk } from "@/lib/terminus/fetch-desk";

const TITLE = "What has shipped.";
const LEDE = "Dated the day it landed on the site. Nothing here is a promise.";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** `2026-09-05` → `05 Sep 2026`: calendar days, no timezone in play, never "Sept". */
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

export const Route = createFileRoute("/changelog")({
  loader: () => getDesk(),
  head: () =>
    pageHead({
      title: "Changelog · Terminus Veil",
      description:
        "What has shipped on the desk, dated the day it landed. Nothing here is a promise.",
      path: "/changelog",
    }),
  component: Changelog,
});

function Changelog() {
  const desk = Route.useLoaderData();
  return (
    <DeskShell desk={desk}>
      <main>
        <div className="wrap max-w-3xl py-12 sm:py-16">
          <PageHeader kicker="shipped" title={TITLE} lede={LEDE} />
          <ol className="mt-10 space-y-10">
            {CHANGELOG.map((e) => (
              <li key={e.date} className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
                <p className="kicker-muted">
                  <time dateTime={e.date}>{dayLabel(e.date)}</time>
                </p>
                <ul className="space-y-2 text-sm leading-relaxed text-pretty text-ink-muted sm:text-base">
                  {e.items.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </main>
    </DeskShell>
  );
}

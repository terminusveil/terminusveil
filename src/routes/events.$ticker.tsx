import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { ActionPlate } from "@/components/action-plate";
import { ContractReads } from "@/components/contract-reads";
import { CopyLink } from "@/components/copy-link";
import { Countdown } from "@/components/countdown";
import { DeskShell } from "@/components/desk-shell";
import { SnapshotNote } from "@/components/snapshot-note";
import { VeilList } from "@/components/veil-list";
import { WindowsSection } from "@/components/windows-section";
import { SITE_NAME, pageHead, pageMeta } from "@/lib/site-meta";
import { veiledNeighbors } from "@/lib/terminus/calendar";
import { getDesk } from "@/lib/terminus/fetch-desk";
import {
  actionFigure,
  actionLabel,
  formatMultiplier,
  formatTerminus,
  plateTitle,
} from "@/lib/terminus/format";
import { rowFor } from "@/lib/terminus/types";
import { useNeighborKeys } from "@/lib/terminus/use-covering-keys";

export const Route = createFileRoute("/events/$ticker")({
  // One URL per name: /events/nvda is a permanent redirect to /events/NVDA.
  beforeLoad: ({ params }) => {
    const name = params.ticker.toUpperCase();
    if (name !== params.ticker) {
      throw redirect({ to: "/events/$ticker", params: { ticker: name }, statusCode: 301 });
    }
  },
  // A name the desk does not read is a real 404 (DeskMissing, via the router's
  // defaultNotFoundComponent), not a 200 page that says "No token for that ticker."
  loader: async ({ params }) => {
    const desk = await getDesk();
    if (!rowFor(desk, params.ticker)) throw notFound();
    return desk;
  },
  head: ({ loaderData, params }) => {
    const name = params.ticker.toUpperCase();
    const path = `/events/${name}`;
    // The loader guarantees a row when it resolves; no loaderData means it
    // threw notFound(), and a 404 carries a title but no canonical.
    const row = loaderData ? rowFor(loaderData, name) : null;
    if (!row) {
      return {
        meta: pageMeta({
          title: `Not found · ${SITE_NAME}`,
          description: "No token for that ticker.",
          path,
        }),
      };
    }
    return pageHead({
      title: `${plateTitle(row, name, loaderData?.clockMs)} · ${SITE_NAME}`,
      description: row.emptyCopy ?? "No token for that ticker.",
      path,
    });
  },
  component: EventPlate,
});

function EventPlate() {
  const desk = Route.useLoaderData();
  const { ticker } = Route.useParams();
  const navigate = useNavigate();
  const name = ticker.toUpperCase();
  const row = rowFor(desk, name);
  const history = desk.actions.filter((a) => a.ticker === name);
  const neighbors = veiledNeighbors(desk.rows, name, desk.clockMs);
  const chips = [name, ...desk.chips.filter((t) => t !== name)].slice(0, 4);
  useNeighborKeys(neighbors.prev?.ticker ?? null, neighbors.next?.ticker ?? null);

  return (
    <DeskShell desk={desk}>
      <main>
        <section className="wrap grid items-start gap-6 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 lg:py-12">
          <div className="min-w-0 overflow-hidden lg:col-start-2 lg:row-start-1">
            {row ? (
              <>
                <ActionPlate
                  row={row}
                  chips={chips}
                  door={false}
                  onChip={(next) => {
                    void navigate({ to: "/events/$ticker", params: { ticker: next } });
                  }}
                />
                <SnapshotNote desk={desk} className="mt-3" />
              </>
            ) : (
              <p className="text-sm text-ink-muted">No token for that ticker.</p>
            )}
          </div>
          <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:self-center">
            <p className="kicker">
              {name} · {row?.state ?? "absent"}
            </p>
            {row ? (
              <p className="mt-5 whitespace-nowrap font-mono text-hero font-medium leading-none tracking-tight tabular text-accent">
                {row.state === "due" ? (
                  "due"
                ) : row.state === "veiled" && row.effectiveAtIso ? (
                  <Countdown iso={row.effectiveAtIso} variant="hero" />
                ) : (
                  formatMultiplier(row.live)
                )}
              </p>
            ) : null}
            <h1 className="mt-8 font-display text-3xl leading-tight tracking-tight text-ink">
              {row?.name ?? name}
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-pretty text-ink-muted">
              {row?.emptyCopy ?? "No token for that ticker."}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/events" className="btn-ghost-sm">
                All events
              </Link>
              <Link to="/cover" className="btn-ghost-sm">
                Cover
              </Link>
              <CopyLink path={`/events/${name}`} className="btn-ghost-sm" />
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs">
              {neighbors.prev ? (
                <Link
                  to="/events/$ticker"
                  params={{ ticker: neighbors.prev.ticker }}
                  className="text-ink-subtle hover:text-accent"
                >
                  ← {neighbors.prev.ticker}
                  <span className="ml-2 tabular">
                    <Countdown iso={neighbors.prev.effectiveAtIso} variant="hero" />
                  </span>
                </Link>
              ) : null}
              {neighbors.next ? (
                <Link
                  to="/events/$ticker"
                  params={{ ticker: neighbors.next.ticker }}
                  className="text-ink-subtle hover:text-accent"
                >
                  {neighbors.next.ticker} →
                  <span className="ml-2 tabular">
                    <Countdown iso={neighbors.next.effectiveAtIso} variant="hero" />
                  </span>
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section className="wrap grid gap-10 py-8 lg:grid-cols-2">
          {row ? <ContractReads row={row} /> : null}
          {row ? <VeilList row={row} /> : null}
        </section>

        {row ? <WindowsSection row={row} /> : null}

        <section className="wrap pb-16">
          <h2 className="font-display text-sm font-semibold">Issuer tape</h2>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No corporate actions on this name.</p>
          ) : (
            <ul className="panel mt-4 divide-y divide-line">
              {history.map((a, i) => (
                <li key={`${a.id}-${a.status}-${i}`} className="px-4 py-3">
                  <p className="font-mono text-xs text-ink-subtle">
                    {a.status.replaceAll("_", " ")}
                  </p>
                  <p className="text-sm">
                    {actionLabel(a.type)}
                    {actionFigure(a) ? (
                      <>
                        {" "}
                        <span className="ml-1 font-mono tabular text-ink">{actionFigure(a)}</span>
                      </>
                    ) : null}
                  </p>
                  <p className="font-mono text-xs tabular text-ink-subtle">
                    {formatTerminus(a.terminusIso)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {row ? (
            <p className="mt-4 font-mono text-xs text-ink-subtle">
              live {formatMultiplier(row.live)}
              {row.staged ? ` · staged ${formatMultiplier(row.staged)}` : ""}
            </p>
          ) : null}
        </section>
      </main>
    </DeskShell>
  );
}

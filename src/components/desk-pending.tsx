import { Link } from "@tanstack/react-router";
import { Mark } from "@/components/mark";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

export function DeskPending() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <Mark className="size-8" tile />
        <span className="font-display text-sm font-semibold tracking-tight">Terminus Veil</span>
      </div>
      <p className="px-4 py-16 font-mono text-sm text-ink-muted">Reading the tape.</p>
    </div>
  );
}

/**
 * The 404 page, rendered by the router's `defaultNotFoundComponent` for a path
 * no route matches and for `/events/{name}` when the loader throws
 * `notFound()`. Neither case has a desk payload (the root has no loader, and a
 * not-found loader leaves none), so this carries the site chrome without the
 * desk: rail, grain, nav and footer, but no name river or palette.
 */
export function DeskMissing() {
  return (
    <div className="relative min-h-dvh bg-paper text-ink">
      <div className="site-rail" aria-hidden="true" />
      <div className="site-grain" aria-hidden="true" />
      <div className="relative z-[1] flex min-h-dvh flex-col">
        <SiteNav />
        <main className="wrap flex flex-1 flex-col items-start py-16 lg:py-24">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-subtle">absent</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">No plate for that path.</h1>
          <p className="mt-3 max-w-md text-sm text-ink-muted">
            The desk only reads names that exist on Robinhood Chain. Open the plate from the start.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to="/" className="font-mono text-sm text-accent">
              Back to the plate
            </Link>
            <Link to="/events" className="btn-ghost-sm">
              All events
            </Link>
            <Link to="/token" className="btn-ghost-sm">
              Token
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}

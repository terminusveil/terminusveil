import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { HOUSE, SOURCE_URL, houseLaunched } from "@/lib/terminus/house";

/** Deck `claim.primaryCta` / `claim.ghostCta`. Launched: `Open on pons` (existing rule). */
const CLAIM_PRIMARY_CTA = "See what holders get";
const CLAIM_GHOST_CTA = "Follow the launch";
/** Launched variant of `claim.ghostCta` (spec §5). */
const CLAIM_GHOST_CTA_LAUNCHED = "Follow $VEIL";
/** Deck `footer.blurb`, `footer.creed`, `footer.line`. */
const BLURB = "Corporate actions on Robinhood Chain stock tokens, read from the contract.";
const CREED = "We do not harvest. We do not wrap. We do not pay the dividend.";
const LINE = "Independent. Not affiliated with or endorsed by Robinhood Markets, Inc.";

type InternalTo =
  | "/"
  | "/events"
  | "/cover"
  | "/status"
  | "/changelog"
  | "/token"
  | "/docs"
  | "/terms"
  | "/privacy";
type ExternalLink = { href: string; label: string };

const FOOTER_LINKS: { to: InternalTo; label: string }[] = [
  { to: "/events", label: "Events" },
  { to: "/token", label: "Token" },
  { to: "/docs", label: "Docs" },
  { to: "/status", label: "Status" },
  { to: "/changelog", label: "Changelog" },
  { to: "/cover", label: "Cover" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
];

export function SiteFooter({ claim = true }: { claim?: boolean }) {
  const social: ExternalLink[] = [];
  if (HOUSE.links.x) social.push({ href: HOUSE.links.x, label: "X" });
  social.push({ href: SOURCE_URL, label: "GitHub" });
  const launched = houseLaunched();
  const pons = HOUSE.links.pons;

  return (
    <footer className="border-t border-line">
      {claim ? (
        <div className="wrap border-b border-line py-12 lg:py-16">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-3xl font-display text-2xl leading-snug tracking-tight text-ink">
              <span className="italic">The name is public.</span> The next action is veiled until
              terminus.
            </p>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
              {launched && pons ? (
                <a
                  href={pons}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary btn-lg w-full sm:w-auto"
                >
                  Open on pons
                  <ArrowUpRight className="btn-icon" strokeWidth={2.25} aria-hidden="true" />
                </a>
              ) : (
                <Link to="/token" className="btn-primary btn-lg w-full sm:w-auto">
                  {CLAIM_PRIMARY_CTA}
                  <ArrowRight className="btn-icon" strokeWidth={2.25} aria-hidden="true" />
                </Link>
              )}
              {HOUSE.links.x ? (
                <a
                  href={HOUSE.links.x}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost btn-lg w-full sm:w-auto"
                >
                  {launched ? CLAIM_GHOST_CTA_LAUNCHED : CLAIM_GHOST_CTA}
                  <ArrowUpRight
                    className="btn-icon text-ink-subtle"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <div className="wrap grid gap-8 py-14 md:grid-cols-[1.4fr_1fr] md:items-end">
        <div className="max-w-sm">
          <Wordmark />
          <p className="mt-4 text-sm leading-relaxed text-pretty text-ink-muted">{BLURB}</p>
          <p className="mt-3 text-sm leading-relaxed text-pretty text-ink-subtle">{CREED}</p>
        </div>
        <nav
          aria-label="Site map"
          className="flex flex-wrap items-center gap-x-1 gap-y-1 font-mono text-xs uppercase tracking-widest text-ink-muted md:justify-end"
        >
          {FOOTER_LINKS.map((l, i) => (
            <span key={l.to} className="inline-flex items-center">
              {i > 0 ? (
                <span aria-hidden="true" className="mx-2 text-ink-subtle">
                  ·
                </span>
              ) : null}
              <Link to={l.to} className="inline-flex min-h-11 items-center hover:text-accent">
                {l.label}
              </Link>
            </span>
          ))}
          {social.map((l) => (
            <span key={l.href} className="inline-flex items-center">
              <span aria-hidden="true" className="mx-2 text-ink-subtle">
                ·
              </span>
              <a
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center hover:text-accent"
              >
                {l.label} ↗
              </a>
            </span>
          ))}
        </nav>
      </div>
      <div className="wrap border-t border-line py-6">
        <p className="max-w-3xl font-mono text-xs leading-relaxed text-ink-subtle">{LINE}</p>
      </div>
    </footer>
  );
}

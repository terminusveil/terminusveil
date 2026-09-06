import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { HouseCa } from "@/components/house-ca";
import { Reveal } from "@/components/reveal";
import { SectionHead } from "@/components/section-head";
import { HOUSE, houseLaunched, wireLive } from "@/lib/terminus/house";
import { houseCards } from "@/lib/terminus/house-cards";

/** Deck `house.title`. */
const TITLE = "The desk runs. $VEIL funds the build.";
/** Deck `house.primaryCta` / `house.ghostCta`. Launched: `Open on pons` (existing rule). */
const PRIMARY_CTA = "See what holders get";
const GHOST_CTA = "Follow the launch";
/** Launched variant of `house.ghostCta` (spec §5). */
const GHOST_CTA_LAUNCHED = "Follow $VEIL";
/** Deck `house.underCards`. */
const UNDER_CARDS = "The public reads stay free in every phase.";

export function HouseSection() {
  const launched = houseLaunched();
  const pons = launched ? HOUSE.links.pons : null;
  const list = houseCards(wireLive());

  return (
    <Reveal>
      <section className="border-t border-line">
        <div className="wrap py-16 lg:py-24">
          <SectionHead title={TITLE} />
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {pons ? (
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
                {PRIMARY_CTA}
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
                {launched ? GHOST_CTA_LAUNCHED : GHOST_CTA}
                <ArrowUpRight
                  className="btn-icon text-ink-subtle"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </a>
            ) : null}
          </div>
          <ul className="panel mt-10 grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
            {list.map((c) => (
              <li key={c.k} className="p-6 sm:p-7">
                <p className="kicker-muted">{c.k}</p>
                <p className="mt-3 text-sm leading-relaxed text-pretty text-ink-muted">
                  <span className="text-ink">{c.lead}</span> {c.body}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-ink-subtle">
            <p>{UNDER_CARDS}</p>
            <HouseCa />
          </div>
        </div>
      </section>
    </Reveal>
  );
}

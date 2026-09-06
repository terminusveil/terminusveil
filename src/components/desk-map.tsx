import { Link } from "@tanstack/react-router";
import { Mark } from "@/components/mark";
import { Reveal } from "@/components/reveal";
import { houseLaunched } from "@/lib/terminus/house";

/** Deck `map.tokenBody` (pre-launch) and its launched variant (spec §5). */
const TOKEN_BODY =
  "Why $VEIL exists, the phases, supply and fees, and how to verify. Not launched until it is.";
const TOKEN_BODY_LAUNCHED = "Live on pons. The phases, supply and fees, and how to verify.";

const MAP = [
  {
    to: "/events" as const,
    title: "Events",
    body: "Issuer actions grouped by process date; time assumed when the issuer publishes none. Calendar of the same tape.",
  },
  {
    to: "/token" as const,
    title: "Token",
    body: houseLaunched() ? TOKEN_BODY_LAUNCHED : TOKEN_BODY,
  },
  {
    to: "/docs" as const,
    title: "Docs",
    body: "What the desk reads, in Robinhood Chain's own terms. How to verify a number.",
  },
  {
    to: "/status" as const,
    title: "Status",
    body: "Tape, pending count, veiled now. Verify the block.",
  },
];

export function DeskMap() {
  return (
    <Reveal>
      <section className="border-t border-line">
        <div className="wrap relative py-16 lg:py-24">
      <Mark className="pointer-events-none absolute -right-8 top-4 hidden w-72 opacity-[0.18] lg:block" />
      <h2 className="max-w-xl font-display text-2xl leading-snug tracking-tight text-ink">
        A reading window around the tape. Not a marketplace.
      </h2>
      <ol className="mt-10 grid gap-3 sm:grid-cols-2">
        {MAP.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="panel panel-lift flex h-full flex-col p-6 sm:p-7"
            >
              <p className="font-sans text-lg font-semibold tracking-tight text-ink">
                {item.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-pretty text-ink-muted">{item.body}</p>
            </Link>
          </li>
        ))}
      </ol>
        </div>
    </section>
    </Reveal>
  );
}

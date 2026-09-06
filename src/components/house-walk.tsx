import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/reveal";

/** Deck `twoMoves.title`. */
const TITLE = "Two moves. One clock.";

/** Deck `twoMoves.step1*` / `twoMoves.step2*`. CTA arrows are drawn (`ArrowRight`), not typed. */
const STEPS = [
  {
    n: "01",
    title: "Open a ticker",
    body: "Live ×, staged ×, terminus and oracle for every stock token on Robinhood Chain. A Verify link on every plate.",
    to: "/events" as const,
    cta: "Open the board",
  },
  {
    n: "02",
    title: "Set the clock",
    body: "Subscribe to the pending board as an ICS feed, or add one terminus at a time.",
    to: "/events" as const,
    search: { view: "calendar" as const },
    cta: "Add to calendar",
  },
];

export function HouseWalk() {
  return (
    <Reveal>
      <section className="border-t border-line">
        <div className="wrap py-16 lg:py-24">
          <h2 className="max-w-xl font-display text-2xl leading-snug tracking-tight text-ink">
            {TITLE}
          </h2>
          <ol className="mt-10 divide-y divide-line border-y border-line">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="row-veil grid gap-4 py-8 sm:grid-cols-[4.5rem_1fr] sm:items-baseline sm:gap-8"
              >
                <p className="font-display text-3xl leading-none text-accent">{s.n}</p>
                <div className="max-w-xl">
                  <h3 className="font-sans text-lg font-semibold tracking-tight text-ink">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-pretty text-ink-muted">
                    {s.body}
                  </p>
                  <Link
                    to={s.to}
                    search={"search" in s ? s.search : undefined}
                    className="btn-ghost-sm mt-5 gap-2"
                  >
                    {s.cta}
                    <ArrowRight className="btn-icon" strokeWidth={2} aria-hidden="true" />
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </Reveal>
  );
}

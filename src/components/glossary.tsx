import { Fragment } from "react";
import { GLOSSARY, glossaryPick } from "@/lib/terminus/glossary";
import { cn } from "@/lib/utils";

/**
 * Full: a two-column definition list of every term.
 * Compact: one wrapping row of `term: plain` pairs for the terms asked. No interaction.
 */
export function Glossary({
  terms,
  compact = false,
  className,
}: {
  terms?: readonly string[];
  compact?: boolean;
  className?: string;
}) {
  const entries = terms ? glossaryPick(terms) : GLOSSARY;

  if (compact) {
    return (
      <ul
        className={cn(
          "flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs leading-relaxed",
          className,
        )}
      >
        {entries.map((e) => (
          <li key={e.term}>
            <span className="text-accent">{e.term}</span>
            <span className="text-ink-subtle">: </span>
            <span className="text-ink-muted">{e.plain}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <dl className={cn("grid gap-x-8 gap-y-3 sm:grid-cols-[9rem_1fr]", className)}>
      {entries.map((e) => (
        <Fragment key={e.term}>
          <dt className="font-mono text-sm text-accent">{e.term}</dt>
          <dd className="text-sm leading-relaxed text-ink-muted">{e.plain}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

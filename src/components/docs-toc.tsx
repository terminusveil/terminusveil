import { ChevronDown } from "lucide-react";
import { useActiveSection } from "@/lib/use-active-section";
import { cn } from "@/lib/utils";

export type TocItem = { id: string; label: string };

/** One link per section on a hairline rail; the section under the reading line carries the lime. */
function TocLinks({ items, active }: { items: readonly TocItem[]; active: string | null }) {
  return (
    <ol className="border-l border-line">
      {items.map((it) => {
        const on = it.id === active;
        return (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              aria-current={on ? "location" : undefined}
              className={cn(
                "-ml-px block border-l py-1.5 pl-3 font-mono text-xs",
                on
                  ? "border-accent text-accent"
                  : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {it.label}
            </a>
          </li>
        );
      })}
    </ol>
  );
}

/** lg and up: a sticky column beside the document. Hidden below lg (see `DocsTocInline`). */
export function DocsTocSidebar({ items }: { items: readonly TocItem[] }) {
  const active = useActiveSection(items);
  return (
    <nav
      aria-label="On this page"
      className="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto"
    >
      <p className="kicker-muted mb-3">On this page</p>
      <TocLinks items={items} active={active} />
    </nav>
  );
}

/** Below lg: one folded row under the page header that opens to the same list. Hidden at lg. */
export function DocsTocInline({ items }: { items: readonly TocItem[] }) {
  const active = useActiveSection(items);
  return (
    <details className="group mt-8 border-y border-line py-2 lg:hidden">
      <summary className="kicker-muted flex min-h-11 cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
        On this page
        <ChevronDown
          className="size-4 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="mt-2 pb-2">
        <TocLinks items={items} active={active} />
      </div>
    </details>
  );
}

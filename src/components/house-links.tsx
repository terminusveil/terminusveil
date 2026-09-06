import { X_HANDLE } from "@/lib/site-meta";
import { houseLinks } from "@/lib/terminus/house";
import { cn } from "@/lib/utils";

/** Only the links that exist. Renders nothing when there are none. `pills` renders each as a `.btn-ghost-sm`. */
export function HouseLinks({ className, pills = false }: { className?: string; pills?: boolean }) {
  const links = houseLinks();
  if (links.length === 0) return null;

  if (pills) {
    return (
      <ul className={cn("flex flex-wrap items-center gap-2", className)}>
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href} target="_blank" rel="noreferrer" className="btn-ghost-sm normal-case">
              {l.label === "X" ? `X · ${X_HANDLE}` : l.label} ↗
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className={cn("flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs", className)}>
      {links.map((l) => (
        <li key={l.href}>
          <a href={l.href} target="_blank" rel="noreferrer" className="text-ink-subtle hover:text-accent">
            {l.label} ↗
          </a>
        </li>
      ))}
    </ul>
  );
}

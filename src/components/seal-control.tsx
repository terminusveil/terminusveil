import { Link } from "@tanstack/react-router";
import { canSeal, coveringFromRow, useCovering } from "@/lib/terminus/covering";
import type { TickerRow } from "@/lib/terminus/types";

export function SealControl({ row, quiet = false }: { row: TickerRow; quiet?: boolean }) {
  const ready = useCovering((s) => s.ready);
  const sealed = useCovering((s) => s.has(row.ticker));
  const seal = useCovering((s) => s.seal);
  const lift = useCovering((s) => s.lift);
  const allowed = canSeal(row);

  if (!ready) return null;

  if (sealed) {
    return (
      <span className="flex flex-wrap items-center gap-3">
        <Link to="/cover" className="btn-ghost-sm">
          On the covering
        </Link>
        <button type="button" className="btn-ghost-sm" onClick={() => lift(row.ticker)}>
          Lift
        </button>
      </span>
    );
  }

  if (!allowed) return null;

  return (
    <button
      type="button"
      className={quiet ? "btn-ghost-sm" : "btn-ghost"}
      onClick={() => seal(coveringFromRow(row))}
    >
      Seal until terminus
    </button>
  );
}

import { Countdown } from "@/components/countdown";
import { formatMultiplier } from "@/lib/terminus/format";
import type { TickerRow } from "@/lib/terminus/types";

export function MechanismBlade({ row }: { row: TickerRow }) {
  return (
    <div className="mt-8 hidden lg:block">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-subtle">
        live × passes the blade at terminus
      </p>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="rounded-md border border-line bg-paper-elev/60 px-3 py-3">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-subtle">live</p>
          <p className="mt-1 font-mono text-lg tabular">{formatMultiplier(row.live)}</p>
        </div>
        <div className="flex flex-col items-center px-1" aria-hidden="true">
          <span className="h-8 w-px bg-accent" />
          <span className="font-mono text-xs uppercase tracking-widest text-accent">terminus</span>
          <span className="h-8 w-px bg-accent" />
        </div>
        <div className="rounded-md border border-line bg-paper-elev/60 px-3 py-3">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-subtle">staged</p>
          <p className="mt-1 font-mono text-lg tabular text-ink-muted">
            {formatMultiplier(row.staged)}
          </p>
        </div>
      </div>
      <p className="mt-3 font-mono text-xs tabular text-ink-subtle">
        <Countdown iso={row.effectiveAtIso} />
      </p>
    </div>
  );
}

import { Chip } from "@/components/chip";
import { PHASES, type Phase, type PhaseStatus } from "@/lib/terminus/house";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<PhaseStatus, "accent" | "ink" | "muted" | "subtle"> = {
  live: "accent",
  next: "ink",
  planned: "muted",
  vision: "subtle",
};

export function StatusChip({ status }: { status: PhaseStatus }) {
  return <Chip tone={STATUS_TONE[status]}>{status}</Chip>;
}

export function NumberedName({ n, name }: { n: string; name: string }) {
  return (
    <span className="inline-flex items-baseline gap-3">
      <span className="font-display text-xl leading-none text-accent">{n}</span>
      <span className="font-sans font-semibold text-ink">{name}</span>
    </span>
  );
}

function PhaseWhat({ p, className }: { p: Phase; className?: string }) {
  return (
    <ul className={cn("space-y-1 text-ink-muted", className)}>
      {p.what.map((w) => (
        <li key={w}>{w}</li>
      ))}
    </ul>
  );
}

export function PhaseTable({ phases = PHASES }: { phases?: readonly Phase[] }) {
  return (
    <div className="mt-6">
      <table className="hidden w-full border-collapse text-sm sm:table">
        <thead>
          <tr className="border-b border-line text-left">
            <th scope="col" className="kicker-muted py-3 pr-4 font-medium">
              Phase
            </th>
            <th scope="col" className="kicker-muted py-3 pr-4 font-medium">
              Status
            </th>
            <th scope="col" className="kicker-muted py-3 pr-4 font-medium">
              What
            </th>
            <th scope="col" className="kicker-muted py-3 font-medium">
              Who
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {phases.map((p) => (
            <tr key={p.n} className="align-top">
              <td className="py-4 pr-4 whitespace-nowrap">
                <NumberedName n={p.n} name={p.name} />
              </td>
              <td className="py-4 pr-4">
                <StatusChip status={p.status} />
              </td>
              <td className="py-4 pr-4">
                <PhaseWhat p={p} />
              </td>
              <td className="py-4 text-ink-muted">{p.who}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ol className="grid gap-3 sm:hidden">
        {phases.map((p) => (
          <li key={p.n} className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <NumberedName n={p.n} name={p.name} />
              <StatusChip status={p.status} />
            </div>
            <PhaseWhat p={p} className="mt-3 text-sm" />
            <p className="mt-3 font-mono text-xs text-ink-subtle">{p.who}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

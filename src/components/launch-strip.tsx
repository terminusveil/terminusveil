import { Chip } from "@/components/chip";
import { NumberedName } from "@/components/phase-table";
import { launchSteps, type StepWord } from "@/lib/terminus/launch-steps";
import { cn } from "@/lib/utils";

/** Lime marks only what is live now; `next` reads in ink; the rest sit muted (spec §6.3). */
const STEP_TONE: Record<StepWord, "accent" | "ink" | "muted"> = {
  live: "accent",
  next: "ink",
  done: "muted",
  ahead: "muted",
  "at launch": "muted",
  "after launch": "muted",
  "at graduation": "muted",
};

function StepChip({ status }: { status: StepWord }) {
  return <Chip tone={STEP_TONE[status]}>{status}</Chip>;
}

/**
 * The pons v2 lifecycle in four cells; the section's only boxed object.
 * Hairlines are per cell so they hold at one, two and four columns:
 * stacked → a top line on every cell but the first; two columns → a right
 * line on the odd cells and a top line on the second row; four columns → a
 * right line on the first three, no top lines.
 */
export function LaunchStrip() {
  const steps = launchSteps();
  return (
    <ol className="panel mt-6 grid sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <li
          key={s.n}
          className={cn(
            "flex flex-col gap-3 border-line p-5",
            i > 0 && "border-t",
            i === 1 && "sm:border-t-0",
            i % 2 === 0 && "sm:border-r",
            i >= 2 && "sm:border-t lg:border-t-0",
            i < 3 && "lg:border-r",
          )}
        >
          <NumberedName n={String(s.n)} name={s.name} />
          <p className="text-sm leading-relaxed text-pretty text-ink-muted">{s.line}</p>
          <div className="mt-auto">
            <StepChip status={s.status} />
          </div>
        </li>
      ))}
    </ol>
  );
}

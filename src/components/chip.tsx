import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE = {
  accent: "border-accent text-accent",
  ink: "border-line-strong text-ink",
  muted: "border-line text-ink-muted",
  subtle: "border-line text-ink-subtle",
};

/** Shared pill used by `StatusChip` (phase table) and `StepChip` (launch strip). */
export function Chip({
  tone,
  className,
  children,
}: {
  tone: "accent" | "ink" | "muted" | "subtle";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-pill border px-2 font-mono text-xs uppercase tracking-wider whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

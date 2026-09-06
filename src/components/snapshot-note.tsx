import { absentLabel, formatBlock, formatReadAt } from "@/lib/terminus/format";
import type { DeskPayload } from "@/lib/terminus/types";
import { cn } from "@/lib/utils";

/** Thin grey caption under any block that shows the snapshot instead of the live tape. */
export function SnapshotNote({
  desk,
  className,
}: {
  desk: Pick<DeskPayload, "source" | "readAt" | "tape" | "absent">;
  className?: string;
}) {
  if (desk.source !== "snapshot") return null;
  return (
    <p className={cn("font-mono text-xs tracking-wide text-ink-subtle", className)}>
      snapshot · read {formatReadAt(desk.readAt)} · block {formatBlock(desk.tape.block)} ·{" "}
      {absentLabel(desk.absent)}
    </p>
  );
}

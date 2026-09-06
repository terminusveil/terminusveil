import { useEffect, useState } from "react";
import { useDeskClock } from "@/lib/terminus/desk-clock";
import { formatCountdown, formatTerminus } from "@/lib/terminus/format";

export function Countdown({
  iso,
  variant = "inline",
}: {
  iso: string | null;
  variant?: "inline" | "hero";
}) {
  // Non-null while the desk serves a snapshot: render once from that clock, never tick.
  const clock = useDeskClock();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (clock !== null) return;
    if (!iso) {
      setNow(Date.now());
      return;
    }
    const target = Date.parse(iso);
    setNow(Date.now());
    let id = 0;
    function schedule() {
      const left = target - Date.now();
      const wait = !Number.isFinite(target) || left > 2 * 60 * 60 * 1000 ? 15_000 : 1_000;
      id = window.setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, wait);
    }
    schedule();
    return () => window.clearTimeout(id);
  }, [iso, clock]);

  if (!iso) return <span className="tabular text-ink-subtle">—</span>;
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return <span className="tabular text-ink-subtle">—</span>;

  if (clock !== null) {
    if (target - clock <= 0) return <span className="tabular">due</span>;
    return <span className="tabular">{formatCountdown(Math.max(target - clock, 0))}</span>;
  }

  const left = target - (now ?? Date.now());
  if (variant === "hero") {
    const text = left <= 0 ? "due" : formatCountdown(left);
    return (
      <span className="tabular" suppressHydrationWarning>
        {text}
      </span>
    );
  }

  if (now === null) {
    return <span className="tabular">{formatTerminus(iso)}</span>;
  }
  if (left <= 0) return <span className="tabular">due</span>;
  return <span className="tabular">{formatCountdown(left)}</span>;
}

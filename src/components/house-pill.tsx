import { Link } from "@tanstack/react-router";
import { HOUSE, houseLaunched, houseStamp } from "@/lib/terminus/house";
import { cn } from "@/lib/utils";

/** `$VEIL · Not launched` / `$VEIL · Live`. A link to /token unless `asStamp` (or `bare`, which implies `asStamp`). */
export function HousePill({
  className,
  asStamp = false,
  compact = false,
  bare = false,
}: {
  className?: string;
  asStamp?: boolean;
  compact?: boolean;
  bare?: boolean;
}) {
  const live = houseLaunched();
  const text = compact ? HOUSE.display : `${HOUSE.display} · ${houseStamp()}`;

  if (bare) {
    const dot = (
      <span
        className={cn("size-1.5 rounded-full", live ? "bg-accent tape-dot" : "bg-ink-subtle")}
        aria-hidden="true"
      />
    );
    return (
      <span
        className={cn(
          "inline-flex h-auto items-center gap-2 font-mono text-xs uppercase tracking-widest text-ink-subtle",
          live && "text-ink",
          className,
        )}
      >
        {dot}
        {text}
      </span>
    );
  }

  const hover = asStamp
    ? ""
    : live
      ? "hover:bg-accent hover:text-accent-fg"
      : "hover:border-line-strong hover:text-ink";
  const classes = cn(
    "inline-flex h-9 items-center gap-2 rounded-pill border font-mono text-xs uppercase tracking-widest whitespace-nowrap transition-[color,background-color,border-color] duration-150",
    compact ? "px-2.5" : "px-3",
    live ? "border-accent/60 text-accent" : "border-line text-ink-subtle",
    hover,
    className,
  );
  const dot = (
    <span
      className={cn("size-1.5 rounded-full", live ? "bg-accent tape-dot" : "bg-ink-subtle")}
      aria-hidden="true"
    />
  );
  if (asStamp) {
    return (
      <span className={classes}>
        {dot}
        {text}
      </span>
    );
  }
  return (
    <Link to="/token" className={classes} aria-label={`${HOUSE.display} token page. ${houseStamp()}.`}>
      {dot}
      {text}
    </Link>
  );
}

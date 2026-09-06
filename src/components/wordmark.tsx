import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mark } from "@/components/mark";

/** Module state: the mark draws on the first mount of a session, then it is a mark. */
let drawnOnce = false;

export function Wordmark({ drawn = false }: { drawn?: boolean }) {
  const [first] = useState(() => drawn && !drawnOnce);
  useEffect(() => {
    if (drawn) drawnOnce = true;
  }, [drawn]);
  return (
    <Link to="/" className="group flex min-w-0 items-center gap-2.5 text-ink">
      <Mark className="size-11 shrink-0" drawn={first} tile />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="font-sans text-[0.7rem] font-semibold tracking-[0.22em] text-ink-muted uppercase">
          Terminus
        </span>
        <span className="mt-0.5 font-display text-[1.12rem] italic tracking-tight text-ink">
          Veil
        </span>
      </span>
    </Link>
  );
}

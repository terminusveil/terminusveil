import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { rowFor, type DeskPayload } from "@/lib/terminus/types";

export function NameSearch({
  desk,
  value,
  onChange,
  className,
}: {
  desk: DeskPayload;
  value: string;
  onChange: (q: string) => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const t = value.trim().toUpperCase();
        if (!t) return;
        const row = rowFor(desk, t);
        if (row) {
          setHint(null);
          void navigate({ to: "/events/$ticker", params: { ticker: row.ticker } });
          return;
        }
        setHint("No token for that ticker.");
      }}
    >
      <label className="sr-only" htmlFor="name-search">
        Ticker
      </label>
      <input
        id="name-search"
        ref={inputRef}
        value={value}
        onChange={(e) => {
          setHint(null);
          onChange(e.target.value);
        }}
        placeholder="Filter tickers"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="h-12 w-full rounded-lg border border-line bg-paper-elev px-4 font-mono text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-accent"
      />
      {hint ? <p className="mt-2 text-sm text-ink-muted">{hint}</p> : null}
    </form>
  );
}

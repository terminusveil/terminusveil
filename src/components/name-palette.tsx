import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { matchesQuery } from "@/lib/terminus/calendar";
import { formatMultiplier } from "@/lib/terminus/format";
import type { DeskPayload } from "@/lib/terminus/types";
import { cn } from "@/lib/utils";

type Shortcut = {
  to: "/" | "/events" | "/token" | "/docs" | "/cover" | "/status";
  label: string;
  hint: string;
};

const SHORTCUTS: Shortcut[] = [
  { to: "/", label: "Home", hint: "plate" },
  { to: "/events", label: "Events", hint: "covering" },
  { to: "/token", label: "Token", hint: "house" },
  { to: "/docs", label: "Docs", hint: "rule" },
  { to: "/cover", label: "Cover", hint: "sealed" },
  { to: "/status", label: "Status", hint: "tape" },
];

export function NamePalette({ desk }: { desk: DeskPayload }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const names = useMemo(() => {
    const needle = q.trim();
    return desk.rows.filter((r) => matchesQuery(needle, r.ticker, r.name)).slice(0, 8);
  }, [desk.rows, q]);

  const routes = useMemo(() => {
    if (!q.trim()) return SHORTCUTS;
    const n = q.trim().toLowerCase();
    return SHORTCUTS.filter((s) => s.label.toLowerCase().includes(n) || s.hint.includes(n));
  }, [q]);

  const total = names.length + routes.length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("terminus:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("terminus:palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQ("");
      setIndex(0);
      return;
    }
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [q]);

  if (!open) return null;

  function go(i: number) {
    if (i < names.length) {
      const row = names[i];
      if (!row) return;
      setOpen(false);
      void navigate({ to: "/events/$ticker", params: { ticker: row.ticker } });
      return;
    }
    const route = routes[i - names.length];
    if (!route) return;
    setOpen(false);
    void navigate({ to: route.to });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-paper/70 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Open a name"
        className="panel w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(Math.max(total - 1, 0), i + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter") {
              e.preventDefault();
              go(index);
            }
          }}
          placeholder="Search tickers  ·  press / anywhere"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="h-14 w-full border-b border-line bg-transparent px-4 font-mono text-sm text-ink outline-none placeholder:text-ink-subtle"
        />
        <ul className="max-h-80 overflow-y-auto py-2">
          {names.map((r, i) => (
            <li key={r.ticker}>
              <button
                type="button"
                onClick={() => go(i)}
                className={cn(
                  "flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left",
                  i === index ? "bg-paper-2" : "hover:bg-paper-2/60",
                )}
              >
                <span className="font-mono text-sm text-accent">{r.ticker}</span>
                <span className="truncate text-sm text-ink-muted">{r.name ?? r.state}</span>
                <span className="font-mono text-xs tabular text-ink-subtle">
                  {formatMultiplier(r.live)}
                </span>
              </button>
            </li>
          ))}
          {routes.map((s, i) => {
            const abs = names.length + i;
            return (
              <li key={s.to}>
                <button
                  type="button"
                  onClick={() => go(abs)}
                  className={cn(
                    "flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left",
                    abs === index ? "bg-paper-2" : "hover:bg-paper-2/60",
                  )}
                >
                  <span className="font-mono text-sm text-ink">{s.label}</span>
                  <span className="font-mono text-xs text-ink-subtle">{s.hint}</span>
                </button>
              </li>
            );
          })}
          {total === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-muted">No token for that name.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

function isTypingTarget(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement
  );
}

export function useCoveringKeys(
  tickers: string[],
  opts: {
    enabled?: boolean;
    active?: string;
    scroll?: boolean;
    onMove?: (ticker: string) => void;
    onEnter?: (ticker: string) => void;
  } = {},
): number {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const key = tickers.join("|");
  const enabled = opts.enabled ?? true;
  const active = opts.active;
  const onMove = opts.onMove;
  const onEnter = opts.onEnter;
  const scroll = opts.scroll ?? true;

  useEffect(() => {
    const list = key.length === 0 ? [] : key.split("|");
    const i = active ? list.indexOf(active) : -1;
    setIndex(i >= 0 ? i : 0);
  }, [active, key]);

  useEffect(() => {
    const list = key.length === 0 ? [] : key.split("|");
    if (!enabled || list.length === 0) return;

    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => {
          const n = Math.min(list.length - 1, i + 1);
          const t = list[n];
          if (t && n !== i) onMove?.(t);
          return n;
        });
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => {
          const n = Math.max(0, i - 1);
          const t = list[n];
          if (t && n !== i) onMove?.(t);
          return n;
        });
      }
      if (e.key === "Enter") {
        const t = list[index];
        if (!t) return;
        e.preventDefault();
        if (onEnter) {
          onEnter(t);
          return;
        }
        void navigate({ to: "/events/$ticker", params: { ticker: t } });
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, index, key, navigate, onEnter, onMove]);

  useEffect(() => {
    const list = key.length === 0 ? [] : key.split("|");
    const t = list[index];
    if (!t || !scroll) return;
    document.querySelector(`[data-walk="${t}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index, key, scroll]);

  return index;
}

export function useNeighborKeys(prev: string | null, next: string | null) {
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const active = document.activeElement;
      if (active?.closest("[role='listbox']")) return;
      if (e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        void navigate({ to: "/events/$ticker", params: { ticker: prev } });
      }
      if (e.key === "ArrowRight" && next) {
        e.preventDefault();
        void navigate({ to: "/events/$ticker", params: { ticker: next } });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, next, prev]);
}

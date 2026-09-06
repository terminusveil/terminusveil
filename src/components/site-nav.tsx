import { Link } from "@tanstack/react-router";
import { Menu, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { HousePill } from "@/components/house-pill";
import { Wordmark } from "@/components/wordmark";

const LINKS = [
  { to: "/events", label: "Events" },
  { to: "/token", label: "Token" },
  { to: "/docs", label: "Docs" },
  { to: "/status", label: "Status" },
] as const;

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="site-nav sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="wrap flex items-center gap-3 py-2.5">
        <Wordmark drawn />
        <nav
          aria-label="Site"
          className="ml-auto hidden items-center gap-7 text-sm text-ink-muted lg:flex"
        >
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="transition-[color] duration-150 hover:text-ink [&.active]:text-ink"
            >
              {l.label}
            </Link>
          ))}
          <HousePill />
          <button
            type="button"
            aria-label="Search tickers"
            className="btn-ghost-sm gap-2"
            onClick={() => window.dispatchEvent(new Event("terminus:palette"))}
          >
            <Search className="size-3.5" />
            Search
          </button>
        </nav>
        <div className="ml-auto flex items-center gap-3 lg:hidden">
          <HousePill compact className="ml-auto" />
          <button
            type="button"
            aria-label="Search tickers"
            className="inline-flex size-11 items-center justify-center rounded-pill border border-line text-ink-muted hover:text-ink"
            onClick={() => window.dispatchEvent(new Event("terminus:palette"))}
          >
            <Search className="size-4" />
          </button>
          <button
            ref={toggleRef}
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-pill border border-line text-ink-muted hover:text-ink"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {open ? (
        <nav id="site-menu" aria-label="Site" className="menu-sheet border-t border-line lg:hidden">
          <div className="wrap flex flex-col gap-1 py-3">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center text-sm text-ink-muted hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

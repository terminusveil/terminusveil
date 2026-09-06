import { useState } from "react";
import { calendarPath, coveringAsAction } from "@/lib/terminus/ics";
import type { TickerRow } from "@/lib/terminus/types";

export function AddTerminus({ row }: { row: TickerRow }) {
  if (!row.effectiveAtIso) return null;
  const action = coveringAsAction(row);
  if (!action) return null;

  return (
    <a
      className="btn-ghost-sm"
      href={calendarPath(row.ticker)}
      download={`${row.ticker.toLowerCase()}-terminus.ics`}
    >
      Add {row.ticker} terminus
    </a>
  );
}

export function CalendarSubscribe({ ticker }: { ticker?: string }) {
  const [copied, setCopied] = useState(false);
  const path = calendarPath(ticker);

  function href(): string {
    return `${window.location.origin}${path}`;
  }

  function subscribe() {
    const https = href();
    const framed = window.parent !== window;
    if (framed) {
      window.location.assign(path);
      return;
    }
    const webcal = https.replace(/^https:/, "webcal:").replace(/^http:/, "webcal:");
    window.location.assign(webcal);
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button type="button" className="btn-ghost-sm" onClick={subscribe}>
        Subscribe
      </button>
      <a
        className="btn-ghost-sm"
        href={path}
        download={ticker ? `${ticker.toLowerCase()}-terminus.ics` : "terminus-veil.ics"}
      >
        Download ICS
      </a>
      <button
        type="button"
        className="btn-ghost-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(href());
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "copied" : "Copy feed"}
      </button>
    </span>
  );
}
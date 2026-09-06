import { actionFigure, actionLabel, formatMultiplier } from "./format.ts";
import type { CorporateAction, TickerRow } from "./types.ts";
import { siteUrl } from "../site-meta.ts";

/** Spec §5: the DESCRIPTION suffix when the event time is the assumed 09:30 ET process date. */
const ASSUMED_SUFFIX = " Terminus time assumed: process date, 09:30 ET.";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function icsUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcs(s: string): string {
  return s
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}

export function coveringAsAction(row: TickerRow): CorporateAction | null {
  if (row.action) {
    return {
      ...row.action,
      terminusIso: row.action.terminusIso ?? row.effectiveAtIso,
    };
  }
  if (!row.effectiveAtIso) return null;
  return {
    id: "covering",
    ticker: row.ticker,
    type: "VEIL",
    status: "in_progress",
    processDate: null,
    terminusIso: row.effectiveAtIso,
    rate: null,
    oldRate: null,
    newRate: null,
  };
}

/**
 * The desk row that speaks for this event's terminus: the ticker's row when its
 * action is this one, or when the event is the covering built from that row.
 * A second in-progress action on the same name keeps its own process date.
 */
function rowSpeakingFor(a: CorporateAction, row: TickerRow | undefined): TickerRow | undefined {
  if (!row) return undefined;
  return row.action === null || row.action.id === a.id ? row : undefined;
}

/**
 * The desk's row says where its terminus came from. Without a row, an action's
 * terminus is by construction the process date at 09:30 ET (see rhj.ts), so it
 * is assumed whenever a process date exists.
 */
function terminusAssumed(a: CorporateAction, row: TickerRow | undefined): boolean {
  if (row) return row.terminusSource === "assumed";
  return a.processDate !== null;
}

/** DTSTART: the published time when the row's source is the issuer or the chain; else the action's own terminus. */
function eventStartIso(a: CorporateAction, row: TickerRow | undefined): string | null {
  if (
    row &&
    (row.terminusSource === "issuer" || row.terminusSource === "chain") &&
    row.effectiveAtIso
  ) {
    return row.effectiveAtIso;
  }
  return a.terminusIso;
}

function eventDescription(a: CorporateAction): string {
  const bits = [
    `${a.ticker} terminus.`,
    `${actionLabel(a.type)}${actionFigure(a) ? ` ${actionFigure(a)}` : ""}.`,
    "Staged is not live.",
    "We do not harvest. We do not wrap. We do not pay the dividend.",
  ];
  return bits.join(" ");
}

export function buildIcs(actions: CorporateAction[], extras?: Map<string, TickerRow>): string {
  const stamp = icsUtc(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Terminus Veil//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Terminus Veil",
    "X-WR-TIMEZONE:America/New_York",
  ];
  const origin = siteUrl();

  for (const a of actions) {
    const row = extras?.get(a.ticker);
    const speaker = rowSpeakingFor(a, row);
    const startIso = eventStartIso(a, speaker);
    if (!startIso) continue;
    const start = icsUtc(startIso);
    if (!start) continue;
    const summary = `${a.ticker} terminus · ${actionLabel(a.type)}`;
    const live = row ? ` Live ${formatMultiplier(row.live)}.` : "";
    const staged = row?.staged ? ` Staged ${formatMultiplier(row.staged)}.` : "";
    const assumed = terminusAssumed(a, speaker);
    const desc = eventDescription(a) + live + staged + (assumed ? ASSUMED_SUFFIX : "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:terminus-veil-${a.ticker}-${a.id}@terminus-veil.desk`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(desc)}`,
    );
    if (origin) lines.push(`URL:${origin}/events/${a.ticker}`);
    // No alarm on an assumed time: the desk will not ring a bell it cannot vouch for.
    if (!assumed) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeIcs(`${a.ticker} terminus`)}`,
        "TRIGGER:PT0S",
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function downloadIcs(filename: string, body: string) {
  const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Same-origin ICS file — works inside the preview iframe. */
export function icsHref(ticker?: string) {
  return calendarPath(ticker);
}

export function calendarPath(ticker?: string): string {
  return ticker ? `/api/calendar?ticker=${encodeURIComponent(ticker)}` : "/api/calendar";
}

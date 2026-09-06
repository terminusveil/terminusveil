import { formatEtDay, formatTerminus } from "./format.ts";
import type { CorporateAction, TickerRow } from "./types.ts";

export type DayGroup<T> = {
  key: string;
  label: string;
  items: T[];
};

export function dayKey(iso: string | null, fallback = "undated"): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return y && m && day ? `${y}-${m}-${day}` : fallback;
}

/** `Fri 04 Sep` — the New York day a group of actions falls on. */
export function dayHeading(iso: string | null): string {
  const s = formatEtDay(iso);
  return s === "—" ? "Undated" : s;
}

export function isToday(iso: string | null, now = Date.now()): boolean {
  if (!iso) return false;
  return dayKey(iso) === dayKey(new Date(now).toISOString());
}

export function isPast(iso: string | null, now = Date.now()): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t <= now;
}

export function groupActionsByDay(actions: CorporateAction[]): DayGroup<CorporateAction>[] {
  const map = new Map<string, CorporateAction[]>();
  for (const a of actions) {
    const key = dayKey(a.terminusIso);
    const list = map.get(key) ?? [];
    list.push(a);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({
      key,
      label: items[0] ? dayHeading(items[0].terminusIso) : key,
      items: items.sort((x, y) => x.ticker.localeCompare(y.ticker)),
    }));
}

export function veiledNeighbors(
  rows: TickerRow[],
  ticker: string,
  now = Date.now(),
): { prev: TickerRow | null; next: TickerRow | null } {
  const upcoming = rows
    .filter((r) => r.state === "veiled" && r.effectiveAtIso && Date.parse(r.effectiveAtIso) > now)
    .sort(
      (a, b) =>
        (a.effectiveAtIso ?? "").localeCompare(b.effectiveAtIso ?? "") ||
        a.ticker.localeCompare(b.ticker),
    );
  const due = rows
    .filter((r) => r.state === "due")
    .sort(
      (a, b) =>
        (a.effectiveAtIso ?? "").localeCompare(b.effectiveAtIso ?? "") ||
        a.ticker.localeCompare(b.ticker),
    );
  const list = [...upcoming, ...due];
  if (list.length === 0) return { prev: null, next: null };
  const i = list.findIndex((r) => r.ticker === ticker);
  if (i < 0) return { prev: null, next: list[0] ?? null };
  return {
    prev: i > 0 ? list[i - 1] : null,
    next: i < list.length - 1 ? list[i + 1] : null,
  };
}

export function matchesQuery(q: string, ticker: string, name?: string | null): boolean {
  const needle = q.trim().toUpperCase();
  if (!needle) return true;
  if (ticker.toUpperCase().includes(needle)) return true;
  if (name && name.toUpperCase().includes(needle)) return true;
  return false;
}

export function terminusCaption(iso: string | null): string {
  return formatTerminus(iso);
}

export type ActionKind = "split" | "dividend" | "other";

export function actionKind(type: string): ActionKind {
  const t = type.replace(/^CORPORATE_ACTION_TYPE_/, "");
  if (t.includes("SPLIT")) return "split";
  if (t.includes("DIVIDEND")) return "dividend";
  return "other";
}

export function etParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value ?? "0"),
    month: Number(parts.find((p) => p.type === "month")?.value ?? "0"),
    day: Number(parts.find((p) => p.type === "day")?.value ?? "0"),
  };
}

export type CalendarCell = {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
};

export function monthCells(year: number, month: number, now = Date.now()): CalendarCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1, 17, 0, 0));
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).format(first);
  const weekIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const startOffset = weekIndex >= 0 ? weekIndex : 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const daysInPrev = new Date(prevYear, prevMonth, 0).getDate();
  const today = etParts(new Date(now));
  const cells: CalendarCell[] = [];

  for (let i = 0; i < startOffset; i++) {
    const day = daysInPrev - startOffset + i + 1;
    const m = String(prevMonth).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    cells.push({
      key: `${prevYear}-${m}-${d}`,
      day,
      inMonth: false,
      isToday: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const m = String(month).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    cells.push({
      key: `${year}-${m}-${d}`,
      day,
      inMonth: true,
      isToday: today.year === year && today.month === month && today.day === day,
    });
  }
  while (cells.length % 7 !== 0) {
    const extra = cells.length - startOffset - daysInMonth + 1;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const m = String(nextMonth).padStart(2, "0");
    const d = String(extra).padStart(2, "0");
    cells.push({
      key: `${nextYear}-${m}-${d}`,
      day: extra,
      inMonth: false,
      isToday: false,
    });
  }
  return cells;
}

export function monthLabel(year: number, month: number, style: "long" | "short" = "long"): string {
  const d = new Date(Date.UTC(year, month - 1, 15));
  return new Intl.DateTimeFormat("en-GB", {
    month: style,
    year: style === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(d);
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

import type { DeskPayload, TickerRow } from "./types.ts";

const WAD = 10n ** 18n;
/**
 * A bare digit string this long or longer is wei (18-decimal fixed point, the
 * contract's form: 5e16 is 0.05×); shorter ones are whole multipliers (the
 * issuer's form: "4" is 4×). 1e14× as a whole multiplier does not exist.
 */
const WEI_DIGITS = 15;

/** Caption suffix naming the live source that failed; empty when the desk is live. */
export function absentLabel(absent: DeskPayload["absent"]): string {
  switch (absent) {
    case "tape":
    case "forced":
      return "live tape absent";
    case "feed":
      return "issuer feed absent";
    case "both":
      return "feed and tape absent";
    default:
      return "";
  }
}

export function formatMultiplier(raw: string | bigint | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  try {
    const n = typeof raw === "bigint" ? raw : parseMultiplier(raw);
    if (n === null) return "—";
    const whole = n / WAD;
    const frac = n % WAD;
    if (frac === 0n) return `${whole.toString()}×`;
    const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
    const trimmed = fracStr.slice(0, 6).replace(/0+$/, "") || "0";
    return `${whole.toString()}.${trimmed}×`;
  } catch {
    return "—";
  }
}

/**
 * Wad from any form the desk meets: hex wei (`0xde0b6b3a7640000`), decimal wei
 * (`1000000000000000000`, `50000000000000000`), the issuer's whole (`4`) or
 * decimal (`1.002208724969205741`) figure. Null for anything else.
 */
export function parseMultiplier(raw: string): bigint | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("0x")) {
    try {
      return BigInt(s);
    } catch {
      return null;
    }
  }
  if (/^\d+$/.test(s)) {
    const n = BigInt(s);
    return s.length >= WEI_DIGITS ? n : n * WAD;
  }
  if (/^\d+\.\d+$/.test(s)) {
    const [a, b] = s.split(".");
    const frac = (b + "000000000000000000").slice(0, 18);
    return BigInt(a || "0") * WAD + BigInt(frac);
  }
  return null;
}

export function multipliersDiffer(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const pa = parseMultiplier(a);
  const pb = parseMultiplier(b);
  if (pa === null || pb === null) return a.trim() !== b.trim();
  return pa !== pb;
}

/** True when a staged figure exists and is not the same wad as live. */
export function stagedDiffers(
  staged: string | null | undefined,
  live: string | null | undefined,
): boolean {
  if (!staged) return false;
  const s = staged.trim();
  if (!s || s === "0" || s === "0.0" || s === "0.00") return false;
  const n = parseMultiplier(s);
  if (n === 0n) return false;
  if (!live) return true;
  return multipliersDiffer(s, live);
}

export function hexToBigInt(hex: string | null | undefined): bigint | null {
  if (!hex || hex === "0x") return null;
  try {
    return BigInt(hex);
  } catch {
    return null;
  }
}

/** `0x1234…abcd` — the first six and last four characters of an address. */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** `0.0421 ETH` from decimal wei; a dash for null. Four decimals, truncated. */
export function formatEth(wei: string | null): string {
  if (wei === null) return "—";
  let n: bigint;
  try {
    n = BigInt(wei);
  } catch {
    return "—";
  }
  if (n < 0n) return "—";
  const whole = n / WAD;
  const frac = (n % WAD).toString().padStart(18, "0").slice(0, 4);
  return `${whole.toString()}.${frac} ETH`;
}

export function formatBlock(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

export function formatRate(rate: string | null | undefined): string {
  if (!rate) return "—";
  const n = Number(rate);
  if (!Number.isFinite(n)) return rate;
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

/**
 * A cash dividend's per-share amount in dollars, as the issuer feed quotes it
 * (the same currency as its quotes): `$1.34`, `$0.306812`. Two decimals at
 * least, six at most, nothing rounded away.
 */
export function formatCashRate(rate: string | null | undefined): string {
  if (!rate) return "—";
  const n = Number(rate);
  if (!Number.isFinite(n)) return rate;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

/**
 * The figure that belongs beside an action's label: `$1.34` for a cash
 * dividend, `1→4` for a split with both rates, the bare rate otherwise, null
 * when the feed gives none.
 */
export function actionFigure(
  a:
    | { type: string; rate: string | null; oldRate?: string | null; newRate?: string | null }
    | null
    | undefined,
): string | null {
  if (!a) return null;
  if (isCashDividend(a.type)) return a.rate ? formatCashRate(a.rate) : null;
  if (a.oldRate && a.newRate) return `${a.oldRate}→${a.newRate}`;
  return a.rate ? formatRate(a.rate) : null;
}

export function actionKindRaw(type: string): string {
  return type.replace(/^CORPORATE_ACTION_TYPE_/, "");
}

export function actionLabel(type: string): string {
  const t = actionKindRaw(type);
  switch (t) {
    case "CASH_DIVIDEND":
      return "cash dividend";
    case "STOCK_DIVIDEND":
      return "stock dividend";
    case "FORWARD_SPLIT":
      return "forward split";
    case "REVERSE_SPLIT":
      return "reverse split";
    case "SPIN_OFF":
      return "spin-off";
    case "REDEMPTION":
      return "redemption";
    case "VEIL":
      return "covering";
    default:
      return t.replaceAll("_", " ").toLowerCase();
  }
}

export function isCashDividend(type: string | null | undefined): boolean {
  if (!type) return false;
  return actionKindRaw(type) === "CASH_DIVIDEND";
}

// ---- The one clock formatter ------------------------------------------------

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const ET = "America/New_York";

type Zone = typeof ET | "UTC";
type ClockParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Numeric wall-clock parts of `d` in `timeZone`, from Intl so New York DST is right. */
function clockParts(d: Date, timeZone: Zone): ClockParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "NaN");
  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    // Some ICU builds print midnight as 24 under h23.
    hour: num("hour") % 24,
    minute: num("minute"),
    second: num("second"),
  };
}

type Stamp = {
  weekday: string;
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
  second: string;
};

/**
 * Words and zero-padded digits for `d` in `timeZone`. The numbers come from
 * Intl; the words come from the tables above, so a month is always three
 * letters (ICU's en-GB abbreviates the ninth month to four) and the server and
 * every browser render the same text.
 */
function stampIn(d: Date, timeZone: Zone): Stamp {
  const p = clockParts(d, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    weekday: DAYS[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()] ?? "",
    day: pad(p.day),
    month: MONTHS[p.month - 1] ?? "",
    year: String(p.year),
    hour: pad(p.hour),
    minute: pad(p.minute),
    second: pad(p.second),
  };
}

function dateOf(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** processDate at 09:30 America/New_York — the cash-session open used as terminus. */
export function terminusFromProcessDate(d: { year: number; month: number; day: number }): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.year}-${pad(d.month)}-${pad(d.day)}T09:30:00`;
  for (const offset of ["-04:00", "-05:00"] as const) {
    const dt = new Date(`${stamp}${offset}`);
    if (Number.isNaN(dt.getTime())) continue;
    const p = clockParts(dt, ET);
    if (
      p.year === d.year &&
      p.month === d.month &&
      p.day === d.day &&
      p.hour === 9 &&
      p.minute === 30
    ) {
      return dt;
    }
  }
  return new Date(`${stamp}-04:00`);
}

/** `Fri 04 Sep, 09:30 ET` — a terminus, in New York time. */
export function formatTerminus(iso: string | null | undefined): string {
  const d = dateOf(iso);
  if (!d) return "—";
  const s = stampIn(d, ET);
  return `${s.weekday} ${s.day} ${s.month}, ${s.hour}:${s.minute} ET`;
}

/** `Fri 04 Sep` — the New York calendar day of an instant, for day headings. */
export function formatEtDay(iso: string | null | undefined): string {
  const d = dateOf(iso);
  if (!d) return "—";
  const s = stampIn(d, ET);
  return `${s.weekday} ${s.day} ${s.month}`;
}

/** `Fri 04 Sep 2026 12:03 UTC` — the read time of a desk payload, always UTC. */
export function formatReadAt(iso: string, opts: { seconds?: boolean } = {}): string {
  const d = dateOf(iso);
  if (!d) return "—";
  const s = stampIn(d, "UTC");
  const clock = `${s.hour}:${s.minute}` + (opts.seconds ? `:${s.second}` : "");
  return `${s.weekday} ${s.day} ${s.month} ${s.year} ${clock} UTC`;
}

/** `12:03 UTC` — only the clock of a read, for tight sub-captions. */
export function formatReadClock(iso: string): string {
  const d = dateOf(iso);
  if (!d) return "—";
  const s = stampIn(d, "UTC");
  return `${s.hour}:${s.minute} UTC`;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1e3);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function stagedFact(row: TickerRow): string {
  if (stagedDiffers(row.staged, row.live)) return formatMultiplier(row.staged);
  if (row.state !== "veiled" && row.state !== "due") return "—";
  const a = row.action;
  if (!a) return "in progress";
  if (isCashDividend(a.type))
    return a.rate ? `cash dividend ${formatCashRate(a.rate)}` : "cash dividend";
  if (a.oldRate && a.newRate) return `${a.oldRate}→${a.newRate}`;
  return actionLabel(a.type);
}

export type MoveFact = { when: string; old: string; new: string };

/**
 * A due name's last move when it took effect after the terminus and by `now`:
 * the effective time the event names (the block's time when it names none) and
 * the two figures. Null otherwise, and the desk says no move was read.
 */
export function moveAfterTerminus(
  row: Pick<TickerRow, "state" | "effectiveAtIso" | "lastMove">,
  now = Date.now(),
): MoveFact | null {
  if (row.state !== "due" || !row.lastMove || !row.effectiveAtIso) return null;
  const when = row.lastMove.effectiveAtIso ?? row.lastMove.atIso;
  if (!when) return null;
  const at = Date.parse(when);
  const terminus = Date.parse(row.effectiveAtIso);
  if (!Number.isFinite(at) || !Number.isFinite(terminus)) return null;
  if (at <= terminus || at > now) return null;
  return { when, old: row.lastMove.old, new: row.lastMove.new };
}

export function coveringCaption(row: TickerRow, now = Date.now()): { k: string; v: string } {
  if (row.state === "absent") return { k: "Not read", v: `${row.ticker} · tape absent` };
  if (row.state === "open")
    return { k: "You read", v: `${row.ticker} · ${formatMultiplier(row.live)}` };
  if (row.state === "due") {
    const moved = moveAfterTerminus(row, now);
    if (moved) {
      return {
        k: "Multiplier moved",
        v: `${formatMultiplier(moved.old)} → ${formatMultiplier(moved.new)}`,
      };
    }
    return { k: "Process date passed", v: "no move read" };
  }
  if (isCashDividend(row.action?.type))
    return { k: "Staged, not live", v: `${row.ticker} · cash dividend` };
  const action = row.action ? actionLabel(row.action.type) : "covering";
  const figure = actionFigure(row.action);
  return { k: "Staged, not live", v: `${row.ticker} · ${action}${figure ? ` ${figure}` : ""}` };
}

export function plateTitle(
  row: TickerRow | null | undefined,
  fallback: string,
  now = Date.now(),
): string {
  if (!row) return fallback;
  const live = formatMultiplier(row.live ?? null);
  const staged = stagedDiffers(row.staged, row.live) ? formatMultiplier(row.staged) : null;
  const delta = staged ? `${live} → ${staged}` : live;
  let clock: string = row.state;
  if (row.effectiveAtIso) {
    const ms = Date.parse(row.effectiveAtIso) - now;
    if (Number.isFinite(ms)) clock = ms <= 0 ? "due" : formatCountdown(ms);
  }
  return `${row.ticker} · ${delta} · ${clock}`;
}

export function formatUsd(raw: string | null | undefined): string {
  if (!raw) return "—";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: n >= 100 ? 2 : 4,
  });
}

export function formatShareQuote(bid: string | null, ask: string | null, halt: boolean): string {
  if (halt) return "halt";
  if (!bid && !ask) return "—";
  if (bid && ask && bid !== ask) return `${formatUsd(bid)} – ${formatUsd(ask)}`;
  return formatUsd(bid ?? ask);
}

/** Token USD = underlying share quote × live multiplier. API bid/ask is not pre-adjusted. */
export function formatTokenUsd(bid: string | null, live: string | null): string {
  if (!bid || !live) return "—";
  const share = Number(bid);
  const m = parseMultiplier(live);
  if (!Number.isFinite(share) || m === null) return "—";
  const token = share * (Number(m) / 1e18);
  if (!Number.isFinite(token)) return "—";
  return formatUsd(token.toFixed(6));
}

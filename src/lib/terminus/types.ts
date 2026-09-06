import type { Windows } from "./windows.ts";

export type DeskState = "open" | "veiled" | "due" | "paused" | "absent";

export type Tape = {
  chainId: number | null;
  block: number | null;
  absent: boolean;
  reason: string | null;
};

export type CorporateAction = {
  id: string;
  ticker: string;
  type: string;
  status: "in_progress" | "completed" | "other";
  processDate: { year: number; month: number; day: number } | null;
  terminusIso: string | null;
  rate: string | null;
  oldRate: string | null;
  newRate: string | null;
};

/** The house poster's latest Wire post for a ticker: figures as decimal wei, times as Unix seconds. */
export type WireRead = { staged: string; terminus: number; postedAt: number };

/** VeilPass as read from the chain: price in $VEIL wei (decimal string), the burn share in basis points, the period in seconds, the house wallet. */
export type PassRead = {
  address: `0x${string}`;
  price: string;
  burnBps: number;
  periodSec: number;
  house: `0x${string}`;
};

export type TickerRow = {
  ticker: string;
  name: string | null;
  address: `0x${string}` | null;
  live: string | null;
  liveApi: string | null;
  liveOnchain: string | null;
  /** The staged figure the desk shows: the issuer's when it publishes one that differs from live, else the contract's. */
  staged: string | null;
  /** The issuer's `pendingMultiplier` when it differs from live; null when the feed stages nothing. */
  stagedApi: string | null;
  /** The contract's `newUIMultiplier()` when it differs from live; null when the contract stages nothing. */
  stagedOnchain: string | null;
  /** True when the issuer and the contract stage different figures. Both are written. */
  stagedDisagree: boolean;
  effectiveAtIso: string | null;
  /**
   * Where `effectiveAtIso` came from: the issuer's `pendingMultiplierEffectiveTime`,
   * the contract's `effectiveAt()`, or the issuer's process date at 09:30 ET — the
   * last one is an assumption and the plate marks it. Null when no terminus is known.
   */
  terminusSource: "issuer" | "chain" | "assumed" | null;
  /** The contract's own `effectiveAt()` as read, seconds; null when unset or not read. The Wire posts this, never an assumed time. */
  effectiveAtOnchainSec: number | null;
  state: DeskState;
  /**
   * `oraclePaused()` as read: `paused` / `live` when the call decoded true / false,
   * `absent` when the tape did not answer, `unread` when the tape answered but this
   * call did not decode (the multiplier may still have).
   */
  oracle: "live" | "paused" | "absent" | "unread";
  /** The token's `paused()` (Robinhood's transfer pause): true / false when it decoded, null when it did not. */
  transferPaused: boolean | null;
  action: CorporateAction | null;
  emptyCopy: string;
  /**
   * The contract's latest `UIMultiplierUpdated` inside the scan window, read for
   * due names only: the figures as decimal wei, the effective time the event
   * names, the block's time, and the block. Null when no log was read.
   */
  lastMove: {
    old: string;
    new: string;
    effectiveAtIso: string | null;
    atIso: string | null;
    block: number;
  } | null;
  /** The house poster's latest Wire post for this ticker; null when the Wire is not live, the row is neither veiled nor due, nothing was posted, or the read failed. */
  wire: WireRead | null;
  /**
   * True only when the desk's Wire read ran for this row and the chain answered
   * for this ticker. With it false, `wire: null` says nothing about the Wire —
   * the read did not run (snapshot, tape absent, row neither veiled nor due) or
   * it failed. With it true, `wire: null` means the poster has posted nothing.
   */
  wireRead: boolean;
  /** The pools that hold this ticker (spec §3); set for veiled and due rows with an address, null otherwise. */
  windows: Windows | null;
  onchain: boolean;
  priceBid: string | null;
  priceAsk: string | null;
  priceHalt: boolean;
  priceAt: string | null;
};

export type DeskPayload = {
  fetchedAt: string;
  /** Where the reading came from: the live feed and tape, or the committed snapshot. */
  source: "live" | "snapshot";
  /** ISO time the data was read: `fetchedAt` when live, the snapshot's read time otherwise. */
  readAt: string;
  /** The clock every state was resolved against: wall time when live, frozen at `readAt` for a snapshot. */
  clockMs: number;
  /** Which live source failed when the snapshot is served (`forced` = `TERMINUS_TAPE=absent`); null when live. */
  absent: "tape" | "feed" | "both" | "forced" | null;
  tape: Tape;
  assetsAbsent: boolean;
  actionsAbsent: boolean;
  /**
   * True only for a live build where the tape answered but the whole
   * eth_call batch came back with nothing decodable (a full RPC outage, not
   * a per-name gap): the caller falls back to the committed snapshot rather
   * than caption a live desk whose contract reads cannot be trusted. Always
   * false for a snapshot build.
   */
  contractReadsUnavailable: boolean;
  /** The Wire as pasted, with the poster's post count and ETH balance (wei, decimal); null when the Wire is not live. Counts are null when the read failed or the desk is a snapshot. */
  wire: {
    address: `0x${string}`;
    poster: `0x${string}`;
    count: number | null;
    posterBalanceWei: string | null;
  } | null;
  /** VeilPass's price, burn share, period and house wallet, all four or null: never with the tape absent, and never a half-read pass. */
  pass: PassRead | null;
  /** When the served issuer assets were read (the snapshot's read time when the snapshot is served); null when absent. */
  feedReadAt: string | null;
  /** The issuer assets are past their refresh cadence because the feed stopped answering, but still inside the stale limit. */
  feedStale: boolean;
  assetCount: number;
  pendingCount: number;
  stagedCount: number;
  veiledCount: number;
  dueCount: number;
  heroTicker: string;
  chips: string[];
  rows: TickerRow[];
  actions: CorporateAction[];
};

export function rowFor(desk: DeskPayload, ticker: string): TickerRow | null {
  const t = ticker.toUpperCase();
  return desk.rows.find((r) => r.ticker === t) ?? null;
}

/**
 * A ticker-shaped string: 1–12 characters, uppercase letters, digits, `.` or
 * `-` only. Rejects anything that could carry a quote or a CR/LF into a
 * response header (`content-disposition`, e.g.) or a query.
 */
export const TICKER_PATTERN = /^[A-Z0-9.-]{1,12}$/;

export function isValidTicker(ticker: string): boolean {
  return TICKER_PATTERN.test(ticker);
}

function terminusMs(row: TickerRow): number {
  if (!row.effectiveAtIso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(row.effectiveAtIso);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

export function nearestVeiled(rows: TickerRow[], now = Date.now()): TickerRow | null {
  const upcoming = rows
    .filter((r) => r.state === "veiled" && terminusMs(r) > now)
    .sort((a, b) => terminusMs(a) - terminusMs(b) || a.ticker.localeCompare(b.ticker));
  return upcoming[0] ?? rows.find((r) => r.state === "veiled") ?? null;
}

/** SPEC sample: nearest veiled name with a live countdown. Due is a rail, not the cover. */
export function heroPlate(rows: TickerRow[], now = Date.now()): TickerRow | null {
  return nearestVeiled(rows, now) ?? rows.find((r) => r.state === "due") ?? null;
}

export function pendingPlates(rows: TickerRow[], n = 6, now = Date.now()): TickerRow[] {
  const upcoming = rows
    .filter((r) => r.state === "veiled" && terminusMs(r) > now)
    .sort((a, b) => terminusMs(a) - terminusMs(b) || a.ticker.localeCompare(b.ticker));
  const due = rows.filter((r) => r.state === "due");
  return [...upcoming, ...due].slice(0, n);
}

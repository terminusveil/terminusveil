import { CHIP_TICKERS, FALLBACK_ADDRESSES, FEATURED_TICKERS } from "./chain.ts";
import { multipliersDiffer, stagedDiffers } from "./format.ts";
import { HOUSE, wireFacts, type House } from "./house.ts";
import { blockWindow, lastMoveOf, type BlockWindow, type LastMoveRead } from "./last-move.ts";
import { warnGate, warnOnce } from "./log.ts";
import { emptyCopy, resolveState } from "./multiplier.ts";
import {
  readLastMoves,
  readMultipliers,
  readPass,
  readTape,
  readWire,
  readWireStatus,
  type OnchainRead,
  type WireStatus,
} from "./relay-live.ts";
import { fetchRhj, type RhjSnapshot } from "./rhj.ts";
import { fetchQuotes, type RhjQuote } from "./rhj-prices.ts";
import {
  SNAPSHOT,
  snapshotLastMoves,
  snapshotMultipliers,
  snapshotQuotes,
  snapshotRhj,
  snapshotTape,
} from "./snapshot.ts";
import {
  heroPlate,
  pendingPlates,
  type CorporateAction,
  type DeskPayload,
  type PassRead,
  type Tape,
  type TickerRow,
  type WireRead,
} from "./types.ts";
import { deltaRange, windowsFor, type WindowsDelta, type WindowsIndex } from "./windows.ts";
import { WINDOWS_INDEX } from "./windows-index.ts";
import { readWindowsDelta } from "./windows-read.ts";

const CACHE_MS = 45_000;
const STALE_MS = 180_000;
/**
 * The eth_getLogs fan-out for the last-move read is bounded to this many due
 * names — the most recently due first — so a feed with a long tail of
 * stale in-progress actions cannot turn one desk refresh into dozens of
 * rate-limited RPC slices.
 */
export const LAST_MOVE_FAN_OUT_CAP = 10;
let cache: { at: number; data: DeskPayload } | null = null;
let inflight: Promise<DeskPayload> | null = null;
/** Rate-limits the "serving snapshot" warning to once per cache window. */
const snapshotWarnGate = warnGate();

function pickAction(ticker: string, actions: CorporateAction[]): CorporateAction | null {
  const mine = actions.filter((a) => a.ticker === ticker);
  return mine.find((a) => a.status === "in_progress") ?? null;
}

function chipRow(hero: string): string[] {
  const chips: string[] = [];
  for (const t of [hero, ...CHIP_TICKERS]) {
    if (t && !chips.includes(t)) chips.push(t);
    if (chips.length >= 4) break;
  }
  return chips;
}

/** Last resort only: reached when even the committed snapshot could not be built. */
export function emptyDesk(reason = "RPC did not answer.", now = Date.now()): DeskPayload {
  const fetchedAt = new Date(now).toISOString();
  return {
    fetchedAt,
    source: "live",
    readAt: fetchedAt,
    clockMs: now,
    absent: "both",
    tape: { chainId: null, block: null, absent: true, reason },
    assetsAbsent: true,
    actionsAbsent: true,
    contractReadsUnavailable: false,
    wire: null,
    pass: null,
    feedReadAt: null,
    feedStale: false,
    assetCount: 0,
    pendingCount: 0,
    stagedCount: 0,
    veiledCount: 0,
    dueCount: 0,
    heroTicker: "AAPL",
    chips: [...CHIP_TICKERS],
    rows: [],
    actions: [],
  };
}

export function buildRow(input: {
  ticker: string;
  name: string | null;
  address: `0x${string}` | null;
  live: string | null;
  liveApi: string | null;
  liveOnchain: string | null;
  staged: string | null;
  stagedApi: string | null;
  stagedOnchain: string | null;
  effectiveAtIso: string | null;
  /** Who published `effectiveAtIso`; null when it is null. */
  effectiveAtSource: "issuer" | "chain" | null;
  effectiveAtOnchainSec: number | null;
  action: CorporateAction | null;
  tapeAbsent: boolean;
  /** `oraclePaused()` as read: true / false when it decoded, null when it did not. */
  paused: boolean | null;
  /** The token's `paused()` (Robinhood's transfer pause) as read: true / false when it decoded, null when it did not. */
  transferPaused: boolean | null;
  onchain: boolean;
  now: number;
}): TickerRow {
  const actionInProgress = input.action?.status === "in_progress";
  const stagedIsNew = stagedDiffers(input.staged, input.live);
  // A published time counts only while a staged figure is new; otherwise the
  // action's process date at 09:30 ET stands in, and that one is assumed.
  const publishedIso = stagedIsNew ? input.effectiveAtIso : null;
  const assumedIso = actionInProgress ? (input.action?.terminusIso ?? null) : null;
  const terminusIso = publishedIso ?? assumedIso;
  const terminusSource: TickerRow["terminusSource"] = publishedIso
    ? input.effectiveAtSource
    : assumedIso
      ? "assumed"
      : null;
  const effectiveAtMs = publishedIso ? Date.parse(publishedIso) : null;
  const actionTerminusMs = assumedIso ? Date.parse(assumedIso) : null;

  const state = resolveState({
    now: input.now,
    live: input.live,
    staged: stagedIsNew ? input.staged : null,
    effectiveAtMs: Number.isFinite(effectiveAtMs) ? effectiveAtMs : null,
    actionTerminusMs: Number.isFinite(actionTerminusMs) ? actionTerminusMs : null,
    actionInProgress,
    oraclePaused: input.paused,
    contractAbsent: input.tapeAbsent && !input.live && !input.action,
  });

  const row: TickerRow = {
    ticker: input.ticker,
    name: input.name,
    address: input.address,
    live: input.live,
    liveApi: input.liveApi,
    liveOnchain: input.liveOnchain,
    staged: stagedIsNew ? input.staged : null,
    stagedApi: input.stagedApi,
    stagedOnchain: input.stagedOnchain,
    stagedDisagree: multipliersDiffer(input.stagedApi, input.stagedOnchain),
    effectiveAtIso: terminusIso,
    terminusSource,
    effectiveAtOnchainSec: input.effectiveAtOnchainSec,
    state,
    oracle:
      input.paused === true
        ? "paused"
        : input.paused === false
          ? "live"
          : input.tapeAbsent
            ? "absent"
            : "unread",
    transferPaused: input.transferPaused,
    action: actionInProgress ? input.action : null,
    emptyCopy: "",
    lastMove: null,
    wire: null,
    // The Wire block flips this for the rows it actually read; a row that never
    // reaches it (snapshot, tape absent, no address) stays unread.
    wireRead: false,
    windows: null,
    onchain: input.onchain,
    priceBid: null,
    priceAsk: null,
    priceHalt: false,
    priceAt: null,
  };
  row.emptyCopy = emptyCopy(row, input.now);
  return row;
}

export async function buildDesk(): Promise<DeskPayload> {
  // Wall clock: this gates cache freshness only, never a row state.
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.data;
  if (cache && now - cache.at < STALE_MS) {
    if (!inflight)
      inflight = refreshDesk().finally(() => {
        inflight = null;
      });
    return cache.data;
  }
  if (inflight) return inflight;
  inflight = refreshDesk().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Everything a desk is built from. Live and snapshot never mix inside one payload. */
export type Sources = {
  rhj: RhjSnapshot;
  tape: Tape;
  /** The clock every state is resolved against: wall time when live, frozen at the snapshot's read time otherwise. */
  now: number;
  fetchedAt: string;
  source: DeskPayload["source"];
  readAt: string;
  /** What failed when the snapshot is served; null when live. */
  absent: DeskPayload["absent"];
  onchain: (addresses: `0x${string}`[]) => Promise<Map<string, OnchainRead>>;
  quotes: (tickers: string[]) => Promise<Map<string, RhjQuote>>;
  /** The latest `UIMultiplierUpdated` per contract inside the window; asked for due names only. */
  lastMoves: (
    addresses: `0x${string}`[],
    window: BlockWindow,
  ) => Promise<Map<string, LastMoveRead>>;
  /** The house facts to build against; the constant when omitted. Tests paste facts here. */
  house?: House;
  /** The poster's latest post per ticker; asked for every name with an address, never with the tape absent. */
  wire: (tickers: string[]) => Promise<Map<string, WireRead | null>>;
  wireStatus: () => Promise<WireStatus>;
  /** The windows delta past the index for these addresses; null when it could not be read. Live only. */
  windows: (
    addresses: `0x${string}`[],
    range: { fromBlock: number; toBlock: number },
  ) => Promise<WindowsDelta | null>;
  /** The committed index; tests inject one. */
  windowsIndex?: WindowsIndex;
  /** VeilPass's four reads; null when the Pass is not pasted or a read failed. */
  pass: () => Promise<PassRead | null>;
};

function snapshotSources(fetchedAt: string, absent: DeskPayload["absent"]): Sources {
  return {
    rhj: snapshotRhj(),
    tape: snapshotTape(),
    now: Date.parse(SNAPSHOT.readAt),
    fetchedAt,
    source: "snapshot",
    readAt: SNAPSHOT.readAt,
    absent,
    onchain: async (addresses) => snapshotMultipliers(addresses),
    quotes: async (tickers) => snapshotQuotes(tickers),
    lastMoves: async (addresses) => snapshotLastMoves(addresses),
    wire: async () => new Map(),
    wireStatus: async () => ({ count: null, posterBalanceWei: null }),
    windows: async () => null,
    pass: async () => null,
  };
}

/**
 * Decide the source. The issuer feed and the tape must both answer and
 * `TERMINUS_TAPE=absent` must not be set; otherwise the whole desk is built from
 * the committed snapshot with the clock frozen at its read time.
 */
async function refreshDesk(): Promise<DeskPayload> {
  // Wall clock: stamps the cache and, when live, is the clock rows resolve against.
  const wall = Date.now();
  const fetchedAt = new Date(wall).toISOString();
  const forced = process.env.TERMINUS_TAPE === "absent";
  // Which live source failed, for the caption. Stays "both" if the live build throws before we know.
  let absent: DeskPayload["absent"] = forced ? "forced" : "both";
  let reason: string | null = forced ? "TERMINUS_TAPE=absent" : null;

  try {
    let sources: Sources | null = null;
    if (!forced) {
      const [rhj, tape] = await Promise.all([fetchRhj(), readTape()]);
      absent =
        rhj.absent && tape.absent ? "both" : rhj.absent ? "feed" : tape.absent ? "tape" : null;
      reason = tape.absent ? tape.reason : rhj.absent ? "issuer feed absent" : null;
      if (absent === null) {
        sources = {
          rhj,
          tape,
          now: wall,
          fetchedAt,
          source: "live",
          readAt: fetchedAt,
          absent: null,
          onchain: readMultipliers,
          quotes: fetchQuotes,
          lastMoves: readLastMoves,
          wire: (tickers) => {
            const facts = wireFacts();
            return facts ? readWire(facts, tickers) : Promise.resolve(new Map());
          },
          wireStatus: () => {
            const facts = wireFacts();
            return facts
              ? readWireStatus(facts)
              : Promise.resolve({ count: null, posterBalanceWei: null });
          },
          windows: readWindowsDelta,
          pass: () => (HOUSE.pass.address ? readPass(HOUSE.pass.address) : Promise.resolve(null)),
        };
      }
    }
    let data = await buildFromSources(sources ?? snapshotSources(fetchedAt, absent));
    // The tape and issuer feed both answered but the whole eth_call batch came
    // back with nothing decodable: an RPC outage the tape check alone cannot
    // see. Treat it the same as the tape being absent rather than caption a
    // live desk whose contract reads cannot be trusted.
    if (data.source === "live" && data.contractReadsUnavailable) {
      absent = "tape";
      reason = "contract reads unavailable this refresh";
      data = await buildFromSources(snapshotSources(fetchedAt, absent));
    }
    if (data.source === "snapshot") {
      warnOnce(snapshotWarnGate, CACHE_MS, wall, "[desk] serving snapshot", { absent, reason });
    }
    cache = { at: wall, data };
    return data;
  } catch {
    warnOnce(snapshotWarnGate, CACHE_MS, wall, "[desk] serving snapshot", {
      absent: absent ?? "both",
      reason: reason ?? "RPC did not answer.",
    });
    try {
      const data = await buildFromSources(snapshotSources(fetchedAt, absent ?? "both"));
      cache = { at: wall, data };
      return data;
    } catch {
      return cache?.data ?? emptyDesk("RPC did not answer.", wall);
    }
  }
}

export async function buildFromSources(input: Sources): Promise<DeskPayload> {
  const { rhj, tape, now } = input;
  const byTicker = new Map(rhj.assets.map((a) => [a.ticker, a]));

  // Every asset's contract is read, not only the pending and featured names:
  // through Multicall3 the whole desk is a few eth_calls, so "four reads per
  // ticker" holds for every name and the Wire can carry every read.
  const onchainTickers = new Set<string>([...FEATURED_TICKERS, ...CHIP_TICKERS]);
  for (const a of rhj.assets) onchainTickers.add(a.ticker);
  for (const a of rhj.actions) {
    if (a.status === "in_progress") onchainTickers.add(a.ticker);
  }

  const addressList: `0x${string}`[] = [];
  const addrFor = new Map<string, `0x${string}`>();
  for (const ticker of onchainTickers) {
    const address = byTicker.get(ticker)?.address ?? FALLBACK_ADDRESSES[ticker] ?? null;
    if (address) {
      addrFor.set(ticker, address);
      addressList.push(address);
    }
  }

  const onchain = tape.absent ? new Map<string, OnchainRead>() : await input.onchain(addressList);
  // A full-batch RPC failure, not a per-name gap: the tape and issuer feed both
  // answered, addresses were asked for, and not one decoded a live multiplier.
  const contractReadsUnavailable =
    input.source === "live" &&
    !tape.absent &&
    addressList.length > 0 &&
    ![...onchain.values()].some((oc) => oc.live !== null);
  const rowMap = new Map<string, TickerRow>();

  const ensure = (ticker: string) => {
    if (rowMap.has(ticker)) return;
    const api = byTicker.get(ticker);
    const address = addrFor.get(ticker) ?? api?.address ?? FALLBACK_ADDRESSES[ticker] ?? null;
    const oc = address ? onchain.get(address.toLowerCase()) : undefined;
    const liveOnchain = oc?.live !== undefined && oc.live !== null ? oc.live.toString() : null;
    const live = liveOnchain ?? api?.currentMultiplier ?? null;
    const stagedOnchain =
      oc?.staged !== undefined &&
      oc.staged !== null &&
      oc.staged !== 0n &&
      (oc.live === null || oc.staged !== oc.live)
        ? oc.staged.toString()
        : null;
    // The issuer's pending figure counts only when it differs from live; the
    // issuer's figure leads, the contract's fills in, and both are kept.
    const stagedApi = stagedDiffers(api?.pendingMultiplier, live)
      ? (api?.pendingMultiplier ?? null)
      : null;
    const staged = stagedApi ?? stagedOnchain;
    // Issuer's published time first; else the contract's effectiveAt while it is
    // ahead, or behind while the contract still holds a different staged figure
    // (a terminus that passed with no move: due, never dropped). A past time with
    // nothing staged is the previous move's and says nothing about the next.
    const issuerIso = api?.pendingEffectiveIso ?? null;
    const chainAtSec = oc?.effectiveAtSec ?? 0;
    const chainIso =
      chainAtSec > 0 && (chainAtSec > now / 1000 || stagedOnchain !== null)
        ? new Date(chainAtSec * 1000).toISOString()
        : null;
    const effectiveAtIso = issuerIso ?? chainIso;
    const effectiveAtSource = issuerIso !== null ? "issuer" : chainIso !== null ? "chain" : null;

    rowMap.set(
      ticker,
      buildRow({
        ticker,
        name: api?.name ?? null,
        address,
        live,
        liveApi: api?.currentMultiplier ?? null,
        liveOnchain,
        staged,
        stagedApi,
        stagedOnchain,
        effectiveAtIso,
        effectiveAtSource,
        effectiveAtOnchainSec: chainAtSec > 0 ? chainAtSec : null,
        action: pickAction(ticker, rhj.actions),
        tapeAbsent: tape.absent,
        paused: oc?.paused ?? null,
        transferPaused: oc?.transferPaused ?? null,
        onchain: Boolean(oc?.live !== undefined && oc?.live !== null),
        now,
      }),
    );
  };

  for (const t of onchainTickers) ensure(t);
  for (const a of rhj.assets) ensure(a.ticker);

  const rows = [...rowMap.values()].sort((a, b) => {
    const rank = (s: TickerRow["state"]) =>
      s === "veiled" ? 0 : s === "due" ? 1 : s === "open" ? 2 : 3;
    const d = rank(a.state) - rank(b.state);
    if (d !== 0) return d;
    const ta = a.effectiveAtIso ?? "";
    const tb = b.effectiveAtIso ?? "";
    if (ta !== tb) return ta.localeCompare(tb);
    return a.ticker.localeCompare(b.ticker);
  });

  // The last move is read for due names only — the moved line is theirs and the
  // RPC rate-limits a wide eth_getLogs fan-out — and never with the tape absent.
  const dueRows = rows.filter((r) => r.state === "due" && r.address !== null);
  // Newest-due first, capped: a long tail of stale in-progress actions must not
  // grow the fan-out past LAST_MOVE_FAN_OUT_CAP slices. Names left off this cut
  // simply keep the no-move due copy until they age back into the top slice.
  const fanOutRows = [...dueRows]
    .sort((a, b) => (b.effectiveAtIso ?? "").localeCompare(a.effectiveAtIso ?? ""))
    .slice(0, LAST_MOVE_FAN_OUT_CAP);
  let moves = new Map<string, LastMoveRead>();
  if (!tape.absent && tape.block !== null && fanOutRows.length > 0) {
    try {
      moves = await input.lastMoves(
        fanOutRows.map((r) => r.address as `0x${string}`),
        blockWindow(tape.block),
      );
    } catch {
      moves = new Map();
    }
  }
  for (const row of dueRows) {
    const read = moves.get((row.address as string).toLowerCase());
    if (!read) continue;
    row.lastMove = lastMoveOf(read);
    row.emptyCopy = emptyCopy(row, now);
  }

  // The Wire: the house poster's latest post for every name the desk reads, and
  // the poster's own count and balance. Never asked with the tape absent. The
  // two reads settle separately, so a failed count does not discard a good
  // posts read or the other way round. A row the read did not answer for keeps
  // `wireRead: false` and the plate says so instead of claiming nothing was posted.
  const house = input.house ?? HOUSE;
  const facts = wireFacts(house);
  let wire: DeskPayload["wire"] = null;
  if (facts) {
    const wireRows = rows.filter((r) => r.address !== null);
    let reads = new Map<string, WireRead | null>();
    let status: WireStatus = { count: null, posterBalanceWei: null };
    if (!tape.absent) {
      const [read, counted] = await Promise.allSettled([
        input.wire(wireRows.map((r) => r.ticker)),
        input.wireStatus(),
      ]);
      if (read.status === "fulfilled") reads = read.value;
      if (counted.status === "fulfilled") status = counted.value;
    }
    for (const row of wireRows) {
      row.wire = reads.get(row.ticker) ?? null;
      row.wireRead = reads.has(row.ticker);
    }
    wire = {
      address: facts.address,
      poster: facts.poster,
      count: status.count,
      posterBalanceWei: status.posterBalanceWei,
    };
  }

  // Windows: the committed index for every veiled or due address, plus a
  // bounded live delta when the tape is live and the index is not empty. A
  // failed delta serves the index alone, captioned by its date.
  const windowsIndex = input.windowsIndex ?? WINDOWS_INDEX;
  const windowRows = rows.filter(
    (r) => (r.state === "veiled" || r.state === "due") && r.address !== null,
  );
  let delta: WindowsDelta | null = null;
  const range =
    input.source === "live" && !tape.absent ? deltaRange(windowsIndex.toBlock, tape.block) : null;
  if (range && windowRows.length > 0) {
    try {
      delta = await input.windows(
        windowRows.map((r) => r.address as `0x${string}`),
        range,
      );
    } catch {
      delta = null;
    }
  }
  for (const row of windowRows)
    row.windows = windowsFor(row.address as `0x${string}`, windowsIndex, delta);

  // The Pass: four reads, printed only when all four decode; never with the tape absent,
  // and never before the Pass address is pasted.
  let pass: PassRead | null = null;
  if (house.pass.address && !tape.absent) {
    try {
      pass = await input.pass();
    } catch {
      pass = null;
    }
  }

  const hero = heroPlate(rows, now)?.ticker ?? "AAPL";
  const pending = pendingPlates(rows, 8, now);
  const quoteTickers = [
    hero,
    ...CHIP_TICKERS,
    ...FEATURED_TICKERS,
    ...pending.map((r) => r.ticker),
    ...rhj.actions.filter((a) => a.status === "in_progress").map((a) => a.ticker),
  ];
  const quotes = await input.quotes(quoteTickers);
  for (const row of rows) {
    const q = quotes.get(row.ticker);
    if (!q) continue;
    row.priceBid = q.bid;
    row.priceAsk = q.ask;
    row.priceHalt = q.halt;
    row.priceAt = q.at;
  }

  return {
    fetchedAt: input.fetchedAt,
    source: input.source,
    readAt: input.readAt,
    clockMs: now,
    absent: input.absent,
    tape,
    assetsAbsent: rhj.absent,
    actionsAbsent: rhj.actionsAbsent,
    contractReadsUnavailable,
    wire,
    pass,
    feedReadAt: rhj.readAt,
    feedStale: rhj.stale,
    assetCount: rhj.assets.length,
    pendingCount: rhj.actions.filter((a) => a.status === "in_progress").length,
    stagedCount: rows.filter((r) => stagedDiffers(r.staged, r.live)).length,
    veiledCount: rows.filter((r) => r.state === "veiled").length,
    dueCount: rows.filter((r) => r.state === "due").length,
    heroTicker: hero,
    chips: chipRow(hero),
    rows,
    actions: rhj.actions,
  };
}

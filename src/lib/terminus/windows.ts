import { formatBlock, hexToBigInt } from "./format.ts";

/** pons v2 Factory on Robinhood Chain (verified `PonsV2LaunchFactory`). */
export const PONS_FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as const;
/** pons's Uniswap v4 hook; a pool with this hook is a graduated pons launch. */
export const PONS_MEME_HOOK = "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044" as const;
/** Uniswap v4 PoolManager on Robinhood Chain (verified `PoolManager`). */
export const UNISWAP_V4_POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951" as const;
/** The Factory's first block, per the pons docs version key. */
export const PONS_V2_START_BLOCK = 8_991_118;
export const TOKEN_LAUNCHED_TOPIC =
  "0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607";
export const INITIALIZE_TOPIC =
  "0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438";
/** The live delta never reads further than this past the index; the caption dates the index instead. */
export const DELTA_MAX_BLOCKS = 50_000;
/** Launches listed on the page; the rest are a count and a link. */
export const LAUNCH_LIST_CAP = 24;
/** Launches kept per address in the index, newest first; `ponsTotal` counts them all. */
export const INDEX_LAUNCH_CAP = 60;
export const PONS_LAUNCHPAD_URL = "https://www.ponsfamily.com/launchpad/";

export type LaunchPhase = 0 | 1 | 2 | 3;
export type PonsLaunch = {
  token: `0x${string}`;
  symbol: string | null;
  phase: LaunchPhase | null;
  block: number;
};
export type V4Counts = { pons: number; plain: number; other: number };
export type WindowsEntry = { pons: PonsLaunch[]; ponsTotal: number; v4: V4Counts; capped: boolean };
export type WindowsIndex = {
  readAt: string;
  toBlock: number;
  byAddress: Record<string, WindowsEntry>;
};
export type WindowsDelta = {
  fromBlock: number;
  toBlock: number;
  byAddress: Record<string, WindowsEntry>;
};
export type Windows = WindowsEntry & {
  toBlock: number;
  readAt: string;
  source: "index" | "index+delta";
};

export function emptyEntry(): WindowsEntry {
  return { pons: [], ponsTotal: 0, v4: { pons: 0, plain: 0, other: 0 }, capped: false };
}

export function classifyHook(hooks: string): keyof V4Counts {
  const h = hooks.toLowerCase();
  if (h === PONS_MEME_HOOK.toLowerCase()) return "pons";
  if (/^0x0{40}$/.test(h)) return "plain";
  return "other";
}

export type RawLog = { topics?: string[]; data?: string; blockNumber?: string };

function word(data: string, i: number): string | null {
  const s = data.startsWith("0x") ? data.slice(2) : data;
  const w = s.slice(i * 64, i * 64 + 64);
  return w.length === 64 ? w : null;
}
function addr(w: string | null | undefined): `0x${string}` | null {
  if (!w) return null;
  const s = w.startsWith("0x") ? w.slice(2) : w;
  return s.length === 64 ? (`0x${s.slice(24).toLowerCase()}` as `0x${string}`) : null;
}
function block(log: RawLog): number | null {
  const n = hexToBigInt(log.blockNumber);
  return n === null ? null : Number(n);
}

/** `TokenLaunched(token indexed, curve indexed, deployer indexed, pairToken, launchConfigId, graduationThreshold)`. */
export function decodeTokenLaunched(
  log: RawLog,
): { token: `0x${string}`; pairToken: `0x${string}`; block: number } | null {
  if (log.topics?.[0]?.toLowerCase() !== TOKEN_LAUNCHED_TOPIC || !log.data) return null;
  const token = addr(log.topics[1]);
  const pairToken = addr(word(log.data, 0));
  const b = block(log);
  if (!token || !pairToken || b === null) return null;
  return { token, pairToken, block: b };
}

/** `Initialize(id indexed, currency0 indexed, currency1 indexed, fee, tickSpacing, hooks, sqrtPriceX96, tick)`. */
export function decodeInitialize(log: RawLog): {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  hooks: `0x${string}`;
  block: number;
} | null {
  if (log.topics?.[0]?.toLowerCase() !== INITIALIZE_TOPIC || !log.data) return null;
  const currency0 = addr(log.topics[2]);
  const currency1 = addr(log.topics[3]);
  const hooks = addr(word(log.data, 2));
  const b = block(log);
  if (!currency0 || !currency1 || !hooks || b === null) return null;
  return { currency0, currency1, hooks, block: b };
}

/** The blocks a live refresh reads past the index; null when there is nothing to read. */
export function deltaRange(
  indexToBlock: number,
  tapeBlock: number | null,
): { fromBlock: number; toBlock: number } | null {
  if (tapeBlock === null || indexToBlock <= 0 || tapeBlock <= indexToBlock) return null;
  return {
    fromBlock: indexToBlock + 1,
    toBlock: Math.min(tapeBlock, indexToBlock + DELTA_MAX_BLOCKS),
  };
}

const PHASE_WORD: Record<LaunchPhase, string> = { 0: "curve", 1: "swept", 2: "pool", 3: "rescued" };
export function phaseWord(phase: LaunchPhase | null): string {
  return phase === null ? "unread" : PHASE_WORD[phase];
}
const PHASE_RANK: Record<LaunchPhase, number> = { 2: 0, 1: 1, 0: 2, 3: 3 };
const rank = (l: PonsLaunch) => (l.phase === null ? 4 : PHASE_RANK[l.phase]);

/** Pool first, then swept, curve, rescued, unread; newest block first inside a phase. */
export function sortLaunches(list: readonly PonsLaunch[]): PonsLaunch[] {
  return [...list].sort(
    (a, b) => rank(a) - rank(b) || b.block - a.block || a.token.localeCompare(b.token),
  );
}

export function mergeEntries(base: WindowsEntry, delta: WindowsEntry | undefined): WindowsEntry {
  if (!delta) return base;
  const seen = new Set(base.pons.map((p) => p.token.toLowerCase()));
  const pons = [...base.pons, ...delta.pons.filter((p) => !seen.has(p.token.toLowerCase()))];
  return {
    pons: sortLaunches(pons).slice(0, INDEX_LAUNCH_CAP),
    ponsTotal: base.ponsTotal + delta.ponsTotal,
    v4: {
      pons: base.v4.pons + delta.v4.pons,
      plain: base.v4.plain + delta.v4.plain,
      other: base.v4.other + delta.v4.other,
    },
    capped: base.capped || delta.capped,
  };
}

/**
 * Rows ship to the client on every page and through `/api/pending`, so the
 * `pons` list here is capped at LAUNCH_LIST_CAP — the same cap the page
 * itself shows (`launchesToShow`) — never the index's wider INDEX_LAUNCH_CAP.
 * `ponsTotal` still counts every launch the index and delta hold.
 */
export function windowsFor(
  address: `0x${string}`,
  index: WindowsIndex,
  delta: WindowsDelta | null,
): Windows {
  const key = address.toLowerCase();
  const base = index.byAddress[key] ?? emptyEntry();
  const merged = delta ? mergeEntries(base, delta.byAddress[key]) : base;
  return {
    ...merged,
    pons: sortLaunches(merged.pons).slice(0, LAUNCH_LIST_CAP),
    toBlock: delta ? delta.toBlock : index.toBlock,
    readAt: index.readAt,
    source: delta ? "index+delta" : "index",
  };
}

export const indexEmpty = (index: Pick<WindowsIndex, "toBlock">): boolean => index.toBlock <= 0;
export const v4Total = (v4: V4Counts): number => v4.pons + v4.plain + v4.other;
export function formatCount(n: number, capped: boolean): string {
  return `${formatBlock(n)}${capped ? "+" : ""}`;
}

type HeadInput = Pick<WindowsEntry, "ponsTotal" | "v4" | "capped">;

/** The two halves of the head line; a zero half is null. */
export function windowsHead(
  ticker: string,
  w: HeadInput,
): { pons: { count: string; noun: string; tail: string } | null; v4: string | null } {
  const pools = v4Total(w.v4);
  return {
    pons:
      w.ponsTotal > 0
        ? {
            // Both halves come off the same crawl, so both carry its cap: a
            // capped count reads `9+`, never a bare `9` the index cannot stand behind.
            count: formatCount(w.ponsTotal, w.capped),
            noun: w.ponsTotal === 1 && !w.capped ? "launch" : "launches",
            tail: `with ${ticker} as the pair asset`,
          }
        : null,
    v4:
      pools > 0
        ? `${formatCount(pools, w.capped)} Uniswap v4 ${pools === 1 && !w.capped ? "pool holds" : "pools hold"} ${ticker}`
        : null,
  };
}

/**
 * The v4 half with its trailing ticker read as `it`. The pons half already
 * names the ticker, so the second half would say it twice; the page and the
 * plain line make the same substitution, in one place.
 */
export function withPronoun(v4Line: string, ticker: string): string {
  return v4Line.replace(` ${ticker}`, " it");
}

/** Plain text of the head line, for the API and tests. The page links `pons`. */
export function windowsHeadLine(ticker: string, w: HeadInput): string {
  const h = windowsHead(ticker, w);
  const parts: string[] = [];
  if (h.pons) parts.push(`${h.pons.count} pons ${h.pons.noun} ${h.pons.tail}`);
  if (h.v4) parts.push(h.pons ? withPronoun(h.v4, ticker) : h.v4);
  return parts.length ? parts.join(" · ") : `No pool holds ${ticker} in the index.`;
}

export function launchesToShow(w: Pick<WindowsEntry, "pons" | "ponsTotal">): {
  list: PonsLaunch[];
  more: number;
} {
  const list = sortLaunches(w.pons).slice(0, LAUNCH_LIST_CAP);
  return { list, more: Math.max(0, w.ponsTotal - list.length) };
}

export const ponsLaunchUrl = (token: string): string => `${PONS_LAUNCHPAD_URL}${token}`;
export const factoryLogsUrl = (explorer: string): string =>
  `${explorer}/address/${PONS_FACTORY}?tab=logs`;

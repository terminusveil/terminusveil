import { CHAIN_ID, RHJ_API } from "./chain.ts";
import { terminusFromProcessDate } from "./format.ts";
import { warnGate, warnOnce } from "./log.ts";
import type { CorporateAction } from "./types.ts";

type RhjAsset = {
  tokenSymbol?: string;
  tokenName?: string;
  currentMultiplier?: string;
  pendingMultiplier?: string;
  pendingMultiplierEffectiveTime?: string | null;
  status?: string;
  deployments?: { contractAddress?: string; chainId?: number }[];
};

type RhjAction = {
  id?: string;
  tokenSymbol?: string;
  type?: string;
  status?: string;
  processDate?: { year?: number; month?: number; day?: number };
  details?: Record<string, Record<string, string | undefined> | undefined>;
};

export type RhjSnapshot = {
  assets: {
    ticker: string;
    name: string | null;
    address: `0x${string}` | null;
    currentMultiplier: string | null;
    pendingMultiplier: string | null;
    pendingEffectiveIso: string | null;
  }[];
  actions: CorporateAction[];
  /** No usable assets: never read, or the last reading is past `ASSETS_MAX_STALE_MS`. */
  absent: boolean;
  actionsAbsent: boolean;
  /** When the served assets were read; null when absent. */
  readAt: string | null;
  /** The served assets are older than `ASSETS_MS` because the feed stopped answering. */
  stale: boolean;
};

function chainAddress(deps: RhjAsset["deployments"]): `0x${string}` | null {
  if (!deps?.length) return null;
  const hit = deps.find((d) => d.chainId === CHAIN_ID);
  const a = hit?.contractAddress;
  if (!a || !a.startsWith("0x") || a.length < 42) return null;
  return a as `0x${string}`;
}

function pendingOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  if (s === "0" || s === "0.0" || s === "0.00") return null;
  const n = Number(s);
  if (Number.isFinite(n) && n === 0) return null;
  return s;
}

const DETAIL_KEY: Record<string, string> = {
  CORPORATE_ACTION_TYPE_CASH_DIVIDEND: "cashDividend",
  CORPORATE_ACTION_TYPE_STOCK_DIVIDEND: "stockDividend",
  CORPORATE_ACTION_TYPE_FORWARD_SPLIT: "forwardSplit",
  CORPORATE_ACTION_TYPE_REVERSE_SPLIT: "reverseSplit",
  CORPORATE_ACTION_TYPE_SPIN_OFF: "spinOff",
  CORPORATE_ACTION_TYPE_REDEMPTION: "redemption",
};

function actionDetails(a: RhjAction): Record<string, string | undefined> {
  const bag = a.details ?? {};
  const type = a.type ?? "";
  const keyed = bag[DETAIL_KEY[type] ?? ""];
  if (keyed) return keyed;
  return Object.values(bag).find(Boolean) ?? {};
}

function parseAction(a: RhjAction): CorporateAction | null {
  const ticker = a.tokenSymbol?.toUpperCase();
  if (!ticker) return null;
  const statusRaw = a.status ?? "";
  const status: CorporateAction["status"] = statusRaw.includes("IN_PROGRESS")
    ? "in_progress"
    : statusRaw.includes("COMPLETED")
      ? "completed"
      : "other";
  const pd = a.processDate;
  const processDate =
    pd?.year && pd?.month && pd?.day
      ? { year: pd.year, month: pd.month, day: pd.day }
      : null;
  const first = actionDetails(a);
  const terminusIso = processDate ? terminusFromProcessDate(processDate).toISOString() : null;
  return {
    id: a.id ?? `${ticker}-${status}-${processDate?.year ?? 0}`,
    ticker,
    type: a.type ?? "CORPORATE_ACTION_TYPE_UNSPECIFIED",
    status,
    processDate,
    terminusIso,
    rate: first.rate ?? null,
    oldRate: first.oldRate ?? null,
    newRate: first.newRate ?? null,
  };
}

/** Pure mapping of the raw `/rhj/assets` body. Inactive assets are dropped. */
export function parseAssets(json: unknown): RhjSnapshot["assets"] {
  const list = (json as { assets?: RhjAsset[] } | null)?.assets;
  if (!Array.isArray(list)) return [];
  return list
    .filter((a) => a.status !== "ASSET_STATUS_INACTIVE")
    .map((a) => {
      const ticker = a.tokenSymbol?.toUpperCase();
      if (!ticker) return null;
      return {
        ticker,
        name: a.tokenName ?? null,
        address: chainAddress(a.deployments),
        currentMultiplier: a.currentMultiplier ?? null,
        pendingMultiplier: pendingOf(a.pendingMultiplier),
        pendingEffectiveIso: a.pendingMultiplierEffectiveTime ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

/** Pure mapping of the raw `/rhj/corporate-actions` body. */
export function parseActions(json: unknown): CorporateAction[] {
  const list = (json as { corpActions?: RhjAction[] } | null)?.corpActions;
  if (!Array.isArray(list)) return [];
  return list.map(parseAction).filter((x): x is CorporateAction => x !== null);
}

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Refresh cadence of the issuer assets; a reading younger than this is served as is. */
export const ASSETS_MS = 60_000;
/** Past this age a reading that could not be refreshed is absent, not stale: the dated snapshot takes over. */
export const ASSETS_MAX_STALE_MS = 10 * 60_000;
export const ACTIONS_MS = 60 * 60_000;
export const ACTIONS_MAX_STALE_MS = 6 * 60 * 60_000;
/** After a failed read no fetch is issued for this long; the caches (stale or absent) are served instead. */
export const RETRY_MS = 45_000;

type Loader = (url: string) => Promise<unknown | null>;

export type RhjFeed = { fetchRhj: () => Promise<RhjSnapshot> };

/**
 * The issuer feed with its two caches. `now` and `getJson` are injectable so
 * the stale and back-off rules can be tested against a fake clock, no network.
 *
 * A reading is fresh under its cadence, stale between the cadence and its
 * max-stale limit when the feed stopped answering, and absent past that limit
 * (or when it never answered). `readAt` is the reading's own time, never the
 * wall clock, so a dead feed is not stamped as a fresh one.
 */
export function createRhjFeed(deps: { now?: () => number; getJson?: Loader } = {}): RhjFeed {
  const clock = deps.now ?? Date.now;
  const load = deps.getJson ?? getJson;
  let assetsCache: { at: number; data: RhjSnapshot["assets"] } | null = null;
  let actionsCache: { at: number; data: CorporateAction[] } | null = null;
  let inflight: Promise<RhjSnapshot> | null = null;
  let retryAfter = 0;
  const retryWarnGate = warnGate();

  /** What the caches can honestly serve at `t`. */
  function served(t: number): RhjSnapshot {
    const assets = assetsCache !== null && t - assetsCache.at < ASSETS_MAX_STALE_MS ? assetsCache : null;
    const actions = actionsCache !== null && t - actionsCache.at < ACTIONS_MAX_STALE_MS ? actionsCache : null;
    return {
      assets: assets?.data ?? [],
      actions: actions?.data ?? [],
      absent: assets === null,
      actionsAbsent: actions === null,
      readAt: assets ? new Date(assets.at).toISOString() : null,
      stale: assets !== null && t - assets.at >= ASSETS_MS,
    };
  }

  async function loadRhj(t: number): Promise<RhjSnapshot> {
    const needAssets = !assetsCache || t - assetsCache.at >= ASSETS_MS;
    const needActions = !actionsCache || t - actionsCache.at >= ACTIONS_MS;
    let failed = false;
    try {
      const [assetsJson, actionsJson] = await Promise.all([
        needAssets
          ? (load(`${RHJ_API}/assets`) as Promise<{ assets?: RhjAsset[] } | null>)
          : Promise.resolve(null),
        needActions
          ? (load(`${RHJ_API}/corporate-actions`) as Promise<{ corpActions?: RhjAction[] } | null>)
          : Promise.resolve(null),
      ]);
      if (needAssets) {
        if (assetsJson?.assets) assetsCache = { at: t, data: parseAssets(assetsJson) };
        else failed = true;
      }
      if (needActions) {
        if (actionsJson?.corpActions) actionsCache = { at: t, data: parseActions(actionsJson) };
        else failed = true;
      }
    } catch {
      failed = true;
    }
    if (failed) {
      retryAfter = t + RETRY_MS;
      warnOnce(retryWarnGate, RETRY_MS, t, "[rhj] retry window entered", { needAssets, needActions });
    }
    return served(t);
  }

  async function fetchRhj(): Promise<RhjSnapshot> {
    const t = clock();
    const assetsFresh = assetsCache !== null && t - assetsCache.at < ASSETS_MS;
    const actionsFresh = actionsCache !== null && t - actionsCache.at < ACTIONS_MS;
    if (assetsFresh && actionsFresh) return served(t);
    if (t < retryAfter) return served(t);
    if (inflight) return inflight;
    inflight = loadRhj(t).finally(() => {
      inflight = null;
    });
    return inflight;
  }

  return { fetchRhj };
}

const feed = createRhjFeed();

/** The process-wide issuer feed the desk reads. */
export const fetchRhj: RhjFeed["fetchRhj"] = feed.fetchRhj;
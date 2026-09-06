import { CHAIN_ID, explorerAddress } from "./chain.ts";
import { multipliersDiffer } from "./format.ts";
import type { DeskPayload, PassRead, TickerRow } from "./types.ts";

/** One pending ticker as `/api/desk` and `/api/pending` print it. */
export type PendingRow = {
  ticker: string;
  state: TickerRow["state"];
  live: string | null;
  liveApi: string | null;
  liveOnchain: string | null;
  staged: string | null;
  stagedApi: string | null;
  stagedOnchain: string | null;
  disagree: boolean;
  stagedDisagree: boolean;
  terminusIso: string | null;
  terminusSource: TickerRow["terminusSource"];
  oracle: TickerRow["oracle"];
  transferPaused: TickerRow["transferPaused"];
  lastMove: TickerRow["lastMove"];
  address: `0x${string}` | null;
  wire: TickerRow["wire"];
  /** True only when the Wire read ran and the chain answered for this ticker; see `wire`. */
  wireRead: TickerRow["wireRead"];
  windows: TickerRow["windows"];
};

/** One row as the API prints it, whatever its state. */
export function apiRow(r: TickerRow): PendingRow {
  return {
    ticker: r.ticker,
    state: r.state,
    live: r.live,
    liveApi: r.liveApi,
    liveOnchain: r.liveOnchain,
    staged: r.staged,
    stagedApi: r.stagedApi,
    stagedOnchain: r.stagedOnchain,
    disagree: multipliersDiffer(r.liveApi, r.liveOnchain),
    stagedDisagree: r.stagedDisagree,
    terminusIso: r.effectiveAtIso,
    terminusSource: r.terminusSource,
    oracle: r.oracle,
    transferPaused: r.transferPaused,
    lastMove: r.lastMove,
    address: r.address,
    wire: r.wire,
    wireRead: r.wireRead,
    windows: r.windows,
  };
}

/** Every veiled or due row, in desk order, with the fields the API prints. */
export function pendingRows(desk: Pick<DeskPayload, "rows">): PendingRow[] {
  return desk.rows.filter((r) => r.state === "veiled" || r.state === "due").map(apiRow);
}

export type TickerPayload = PendingRow & {
  /** The token contract on Blockscout; null when the desk has no address for it. */
  explorer: string | null;
  readAt: string;
  block: number | null;
  source: DeskPayload["source"];
};

/** `/api/ticker/{ticker}`: one row and the reading it came from. */
export function tickerPayload(
  desk: Pick<DeskPayload, "readAt" | "tape" | "source">,
  row: TickerRow,
): TickerPayload {
  return {
    ...apiRow(row),
    explorer: row.address ? explorerAddress(row.address) : null,
    readAt: desk.readAt,
    block: desk.tape.block,
    source: desk.source,
  };
}

export type PendingPayload = {
  readAt: string;
  block: number | null;
  source: DeskPayload["source"];
  count: number;
  rows: PendingRow[];
};

/** `/api/pending`: the pending tape and the reading it came from. */
export function pendingPayload(
  desk: Pick<DeskPayload, "rows" | "readAt" | "tape" | "source">,
): PendingPayload {
  const rows = pendingRows(desk);
  return {
    readAt: desk.readAt,
    block: desk.tape.block,
    source: desk.source,
    count: rows.length,
    rows,
  };
}

export type HealthPayload = {
  ok: true;
  build: { commit: string; at: string };
  chain: { id: number; block: number | null; readAt: string };
  source: DeskPayload["source"];
  feedStale: boolean;
  tickers: number;
  pending: number;
  due: number;
  /** The Wire's address, poster and post count; null when the Wire is not live. Never the balance — that is the owner's, on /status only. */
  wire: { address: `0x${string}`; poster: `0x${string}`; count: number | null } | null;
  /** VeilPass's price, burn share, period and house wallet; null when the Pass is not pasted or a read failed. */
  pass: PassRead | null;
};

/** `/api/health`: the build that answered and the reading it holds. Never cached. */
export function healthPayload(
  desk: Pick<
    DeskPayload,
    | "tape"
    | "readAt"
    | "source"
    | "feedStale"
    | "assetCount"
    | "pendingCount"
    | "dueCount"
    | "wire"
    | "pass"
  >,
  build: { commit: string; at: string },
): HealthPayload {
  return {
    ok: true,
    build: { commit: build.commit, at: build.at },
    chain: { id: CHAIN_ID, block: desk.tape.block, readAt: desk.readAt },
    source: desk.source,
    feedStale: desk.feedStale,
    tickers: desk.assetCount,
    pending: desk.pendingCount,
    due: desk.dueCount,
    wire: desk.wire
      ? { address: desk.wire.address, poster: desk.wire.poster, count: desk.wire.count }
      : null,
    pass: desk.pass,
  };
}

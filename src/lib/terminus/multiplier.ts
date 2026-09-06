import type { CorporateAction, DeskState, TickerRow } from "./types.ts";
import {
  formatMultiplier,
  formatCashRate,
  formatTerminus,
  isCashDividend,
  moveAfterTerminus,
  stagedDiffers,
} from "./format.ts";

export function resolveState(input: {
  now: number;
  live: string | null;
  staged: string | null;
  effectiveAtMs: number | null;
  actionTerminusMs: number | null;
  actionInProgress: boolean;
  /** oraclePaused(): true / false when read, null when that call did not decode. Only a true read pauses. */
  oraclePaused: boolean | null;
  contractAbsent: boolean;
}): DeskState {
  if (input.contractAbsent && !input.live && !input.actionInProgress) return "absent";
  if (input.oraclePaused === true) return "paused";

  const hasStaged = stagedDiffers(input.staged, input.live);

  if (hasStaged) {
    if (input.effectiveAtMs !== null) return input.effectiveAtMs > input.now ? "veiled" : "due";
    if (input.actionInProgress && input.actionTerminusMs !== null) {
      return input.actionTerminusMs > input.now ? "veiled" : "due";
    }
    // A figure is staged and no source names its terminus: veiled until one does, never open.
    return "veiled";
  }

  if (input.actionInProgress && input.actionTerminusMs !== null) {
    if (input.actionTerminusMs > input.now) return "veiled";
    return "due";
  }

  if (input.actionInProgress) return "veiled";
  return "open";
}

export function emptyCopy(
  row: Pick<
    TickerRow,
    "ticker" | "state" | "live" | "staged" | "action" | "effectiveAtIso" | "lastMove"
  >,
  now = Date.now(),
): string {
  const live = formatMultiplier(row.live);
  if (row.state === "paused") return "Oracle paused. Will not guess a price.";
  if (row.state === "absent") return "Tape absent. Cannot read the contract.";
  if (row.state === "due") {
    // A move read after the process date is printed; the issuer still lists the action, so the state stays due.
    const moved = moveAfterTerminus(row, now);
    if (moved) {
      return `Multiplier moved ${formatTerminus(moved.when)}, ${formatMultiplier(moved.old)} → ${formatMultiplier(moved.new)}. Issuer still lists the action.`;
    }
    return "Process date passed. No multiplier move read yet.";
  }
  if (row.state === "veiled") {
    const when = row.effectiveAtIso ? formatTerminus(row.effectiveAtIso) : "terminus";
    const staged = formatMultiplier(row.staged);
    if (staged !== "—" && stagedDiffers(row.staged, row.live)) {
      return `${row.ticker} veiled until ${when}. Live ${live}. Staged ${staged}. Staged is not live.`;
    }
    if (row.action) {
      return `${row.ticker} veiled until ${when}. ${actionLine(row.action)} Live ${live}.`;
    }
    return `${row.ticker} veiled until ${when}. Live ${live}.`;
  }
  return `Nothing veiled. Multiplier live at ${live === "—" ? "—" : live}.`;
}

export function actionLine(action: CorporateAction): string {
  const kind = action.type
    .replace(/^CORPORATE_ACTION_TYPE_/, "")
    .replaceAll("_", " ")
    .toLowerCase();
  // A cash dividend is pending on the issuer's tape; the desk has no evidence of payment either way.
  if (isCashDividend(action.type)) {
    return action.rate
      ? `Cash dividend ${formatCashRate(action.rate)} pending.`
      : "Cash dividend pending.";
  }
  if (action.rate) return `Cash dividend ${formatCashRate(action.rate)} staged.`;
  if (action.oldRate && action.newRate)
    return `Split ${action.oldRate} → ${action.newRate} staged.`;
  return `${kind} staged.`;
}

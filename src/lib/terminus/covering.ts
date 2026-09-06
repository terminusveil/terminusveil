import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { TickerRow } from "./types";

export type Covering = {
  ticker: string;
  live: string | null;
  staged: string | null;
  terminusIso: string | null;
  actionType: string | null;
  actionRate: string | null;
  address: string | null;
  sealedAt: string;
};

export type CoveringLife = "sealed" | "due" | "opened";

type CoveringState = {
  items: Covering[];
  ready: boolean;
  seal: (c: Covering) => void;
  lift: (ticker: string) => void;
  has: (ticker: string) => boolean;
};

export const useCovering = create<CoveringState>()(
  persist(
    (set, get) => ({
      items: [],
      ready: false,
      seal: (c) =>
        set((s) => ({
          items: [c, ...s.items.filter((x) => x.ticker !== c.ticker)].slice(0, 80),
        })),
      lift: (ticker) => set((s) => ({ items: s.items.filter((x) => x.ticker !== ticker) })),
      has: (ticker) => get().items.some((x) => x.ticker.toUpperCase() === ticker.toUpperCase()),
    }),
    {
      name: "terminus-veil:covering",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items }),
      skipHydration: true,
    },
  ),
);

export async function hydrateCovering() {
  if (typeof window === "undefined") return;
  await useCovering.persist.rehydrate();
  useCovering.setState({ ready: true });
}

export function coveringFromRow(row: TickerRow): Covering {
  return {
    ticker: row.ticker,
    live: row.live,
    staged: row.staged,
    terminusIso: row.effectiveAtIso,
    actionType: row.action?.type ?? null,
    actionRate: row.action?.rate ?? null,
    address: row.address,
    sealedAt: new Date().toISOString(),
  };
}

export function coveringLife(item: Covering, row: TickerRow | null, now = Date.now()): CoveringLife {
  const terminusMs = item.terminusIso ? Date.parse(item.terminusIso) : Number.NaN;
  if (Number.isFinite(terminusMs) && terminusMs > now) return "sealed";
  if (row?.state === "open" && !row.action && !row.staged) return "opened";
  if (row?.state === "open") return "opened";
  return "due";
}

export function coveringCounts(
  items: Covering[],
  rows: TickerRow[],
  now = Date.now(),
): { sealed: number; due: number; opened: number } {
  let sealed = 0;
  let due = 0;
  let opened = 0;
  for (const item of items) {
    const row = rows.find((r) => r.ticker === item.ticker) ?? null;
    const life = coveringLife(item, row, now);
    if (life === "sealed") sealed += 1;
    else if (life === "due") due += 1;
    else opened += 1;
  }
  return { sealed, due, opened };
}

export function canSeal(row: TickerRow): boolean {
  return Boolean(row.effectiveAtIso) && (row.state === "veiled" || row.state === "due");
}

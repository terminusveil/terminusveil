import { createContext, useContext } from "react";

/** Frozen clock (ms) while the desk serves a snapshot; null when live. */
export const DeskClock = createContext<number | null>(null);

export function useDeskClock(): number | null {
  return useContext(DeskClock);
}

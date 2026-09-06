import { explorerBlock } from "./chain.ts";
import { formatBlock } from "./format.ts";
import type { DeskPayload } from "./types.ts";

export type StripTile = {
  value: string;
  label: "tickers" | "on the clock" | "due" | "block";
  href: string | null;
  /** True for a printed zero, so the tile can dim it. */
  zero: boolean;
};

/** The four proof tiles under the hero (spec §5.3). Null when no ticker was read. */
export function stripTiles(
  desk: Pick<DeskPayload, "assetCount" | "pendingCount" | "dueCount" | "tape">,
): StripTile[] | null {
  if (desk.assetCount === 0) return null;
  const block = desk.tape.block;
  return [
    { value: String(desk.assetCount), label: "tickers", href: null, zero: false },
    {
      value: String(desk.pendingCount),
      label: "on the clock",
      href: null,
      zero: desk.pendingCount === 0,
    },
    { value: String(desk.dueCount), label: "due", href: null, zero: desk.dueCount === 0 },
    {
      value: block === null ? "—" : formatBlock(block),
      label: "block",
      href: block === null ? null : explorerBlock(block),
      zero: false,
    },
  ];
}

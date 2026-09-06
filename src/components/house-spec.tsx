import type { ReactNode } from "react";
import { Ext } from "@/components/prose";
import { CHAIN_ID, CHAIN_NAME } from "@/lib/terminus/chain";
import { HOUSE, houseLaunched, houseSupply } from "@/lib/terminus/house";
import { cn } from "@/lib/utils";

/** Pre-creation values (spec §6.1). They print in ink-muted so an unfilled fact reads as a status. */
const PRE_SUPPLY = "fixed at creation · minted to the curve";
const PRE_PAIR = "set at creation";

type Row = { k: string; v: ReactNode; muted?: boolean };

/** One fact per row, every value from HOUSE or chain.ts. Sits under the /token header. */
export function HouseSpec({ className }: { className?: string }) {
  const launched = houseLaunched();
  const supply = launched ? houseSupply() : null;
  const pair = launched ? HOUSE.pairAsset : null;
  const rows: Row[] = [
    { k: "Ticker", v: HOUSE.symbol },
    { k: "Name", v: HOUSE.name },
    { k: "Chain", v: `${CHAIN_NAME} · ${CHAIN_ID}` },
    {
      k: "Launchpad",
      v: (
        <Ext href={HOUSE.launchpad.url}>
          {HOUSE.launchpad.name} {HOUSE.launchpad.version}
        </Ext>
      ),
    },
    {
      k: "Supply",
      v: supply ? `${supply} · fixed · minted to the curve` : PRE_SUPPLY,
      muted: !supply,
    },
    { k: "Pair", v: pair ?? PRE_PAIR, muted: !pair },
  ];

  return (
    <dl className={cn("panel divide-y divide-line", className)}>
      {rows.map((r) => (
        <div
          key={r.k}
          className="grid gap-1 px-5 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4 sm:items-baseline"
        >
          <dt className="kicker-muted">{r.k}</dt>
          <dd
            className={cn(
              "min-w-0 text-pretty font-mono text-sm tabular",
              r.muted ? "text-ink-muted" : "text-ink",
            )}
          >
            {r.v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

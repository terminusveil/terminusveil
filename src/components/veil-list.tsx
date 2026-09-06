import { explorerAddress } from "@/lib/terminus/chain";
import { formatMultiplier } from "@/lib/terminus/format";
import type { TickerRow } from "@/lib/terminus/types";

type Item = { ok: boolean | null; label: string; note: string };

export function VeilList({ row }: { row: TickerRow }) {
  const items: Item[] = [
    {
      ok: Boolean(row.address),
      label: "Token",
      note: row.address ? "on Robinhood Chain" : "not deployed",
    },
    {
      ok: Boolean(row.live),
      label: "Multiplier live",
      note: formatMultiplier(row.live),
    },
    {
      ok: false,
      label: "Voting right",
      note: "not a share",
    },
    {
      ok: false,
      label: "Cash dividend from issuer",
      note: "not paid here",
    },
    {
      ok: row.oracle === "live" ? true : row.oracle === "paused" ? false : null,
      label: "Oracle",
      note: row.oracle,
    },
    {
      ok: row.state === "open" ? true : row.state === "veiled" ? false : null,
      label: "Next action live",
      note: row.state,
    },
  ];

  return (
    <section>
      <h2 className="font-display text-sm font-semibold">What this name is</h2>
      <p className="mt-1 text-sm text-pretty text-ink-muted">
        The ticker is public. The share is not yours. That is the veil.
      </p>
      <ul className="panel mt-4 divide-y divide-line px-4">
        {items.map((item) => (
          <li key={item.label} className="flex min-h-12 items-baseline justify-between gap-3 py-3">
            <span className="flex items-baseline gap-3">
              <Mark ok={item.ok} />
              <span className="text-sm text-ink">{item.label}</span>
            </span>
            <span className="font-mono text-xs tabular text-ink-subtle">{item.note}</span>
          </li>
        ))}
      </ul>
      {row.address ? (
        <a
          className="btn-ghost-sm mt-3"
          href={explorerAddress(row.address)}
          target="_blank"
          rel="noreferrer"
        >
          Verify on explorer
        </a>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">No contract address on this name.</p>
      )}
    </section>
  );
}

function Mark({ ok }: { ok: boolean | null }) {
  const glyph = ok === true ? "yes" : ok === false ? "no" : "—";
  const color =
    ok === true ? "text-accent" : ok === false ? "text-ink-subtle" : "text-ink-muted";
  return <span className={`w-8 shrink-0 font-mono text-xs uppercase tracking-widest ${color}`}>{glyph}</span>;
}

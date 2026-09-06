import { CopyAddress } from "@/components/copy-address";
import { verifyRows } from "@/lib/terminus/launch-steps";

/** Contract · Curve · Pool · Fee wallet · Wire · Pass, each a status until it exists, then a link (spec §6.4). */
export function VerifyTable({ passFact = null }: { passFact?: string | null }) {
  const rows = verifyRows();
  return (
    <dl className="panel mt-4 divide-y divide-line">
      {rows.map((r) => (
        <div
          key={r.k}
          className="grid gap-1 px-5 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4 sm:items-center"
        >
          <dt className="kicker-muted">{r.k}</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm tabular">
            {r.status ? (
              <span className="text-ink-muted">{r.status}</span>
            ) : (
              <>
                {r.address ? <CopyAddress address={r.address} /> : null}
                {r.href ? (
                  <a
                    href={r.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink-subtle hover:text-accent"
                  >
                    {r.label}
                  </a>
                ) : null}
              </>
            )}
            {r.k === "Pass" && passFact ? (
              <span className="basis-full font-mono text-xs text-ink-subtle">{passFact}</span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

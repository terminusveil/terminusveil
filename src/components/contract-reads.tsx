import { explorerAddress } from "@/lib/terminus/chain";
import {
  formatMultiplier,
  formatShareQuote,
  formatTerminus,
  formatTokenUsd,
  multipliersDiffer,
} from "@/lib/terminus/format";
import { wireExplorerUrl, wireLive } from "@/lib/terminus/house";
import type { TickerRow } from "@/lib/terminus/types";
import { wireFact } from "@/lib/terminus/wire";

export function ContractReads({ row }: { row: TickerRow }) {
  const disagree = multipliersDiffer(row.liveOnchain, row.liveApi);
  const stagedDisagree = row.stagedDisagree;
  // Under this heading only the contract's own staged figure prints; the issuer's
  // stands in only when the contract was not read, and the footnote below says so.
  const stagedRead = row.stagedOnchain ?? (row.onchain ? null : row.staged);
  const wireUrl = wireExplorerUrl();

  return (
    <section>
      <h2 className="font-display text-sm font-semibold">What the contract says</h2>
      <dl className="panel mt-3 divide-y divide-line px-4 font-mono text-sm">
        <Read k="live" v={formatMultiplier(row.liveOnchain ?? row.live)} />
        <Read k="staged" v={formatMultiplier(stagedRead)} />
        <Read
          k="terminus"
          v={
            row.terminusSource === "assumed"
              ? "process date 09:30 ET · assumed"
              : formatTerminus(row.effectiveAtIso)
          }
        />
        <Read k="oracle" v={row.oracle} />
        <Read
          k="transfers"
          v={row.transferPaused === null ? "unread" : row.transferPaused ? "paused" : "open"}
        />
        {wireLive() ? <Read k="wire" v={wireFact(row) ?? "—"} /> : null}
      </dl>
      <dl className="panel mt-3 divide-y divide-line px-4 font-mono text-sm">
        <Read k="share" v={formatShareQuote(row.priceBid, row.priceAsk, row.priceHalt)} />
        <Read k="token" v={formatTokenUsd(row.priceBid, row.live)} />
      </dl>
      {disagree || stagedDisagree ? (
        <dl className="panel mt-3 divide-y divide-line px-4 font-mono text-sm">
          {disagree ? (
            <>
              <Read k="issuer live" v={formatMultiplier(row.liveApi)} />
              <Read k="chain live" v={formatMultiplier(row.liveOnchain)} />
            </>
          ) : null}
          {stagedDisagree ? (
            <>
              <Read k="issuer staged" v={formatMultiplier(row.stagedApi)} />
              <Read k="chain staged" v={formatMultiplier(row.stagedOnchain)} />
            </>
          ) : null}
        </dl>
      ) : null}
      {disagree || stagedDisagree ? (
        <p className="mt-3 text-sm text-ink-muted">Disagree. Both figures are written.</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {row.address ? (
          <a
            className="btn-ghost-sm"
            href={explorerAddress(row.address)}
            target="_blank"
            rel="noreferrer"
          >
            Verify {row.ticker}
          </a>
        ) : (
          <span className="text-sm text-ink-muted">No contract address on this name.</span>
        )}
        {wireUrl ? (
          <a className="btn-ghost-sm" href={wireUrl} target="_blank" rel="noreferrer">
            Wire on explorer
          </a>
        ) : null}
      </div>
      {!row.onchain ? (
        <p className="mt-2 text-sm text-ink-muted">
          Live × is the issuer's figure. The contract was not read for this ticker. Verify on
          explorer.
        </p>
      ) : null}
    </section>
  );
}

function Read({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-ink-subtle">{k}</dt>
      <dd className="tabular text-ink">{v}</dd>
    </div>
  );
}

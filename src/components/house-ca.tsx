import { useRef } from "react";
import { CopyAddress } from "@/components/copy-address";
import { HOUSE, houseLaunched, tokenExplorerUrl } from "@/lib/terminus/house";
import { cn } from "@/lib/utils";

/** Short form: `CA 0x1234…abcd` (copies the full address) once launched; the pre-launch line until then. */
export function HouseCa() {
  if (houseLaunched() && HOUSE.address) {
    return (
      <span className="inline-flex items-center gap-2 font-mono text-xs tabular text-ink-subtle">
        <span>CA</span>
        <CopyAddress address={HOUSE.address} />
      </span>
    );
  }

  return (
    <span className="font-mono text-xs text-ink-subtle">CA · at launch · posted here first</span>
  );
}

/**
 * Full form for /token (readiness item 11): the whole 42-character address,
 * selectable, beside a 44 px copy button and the explorer link. Renders
 * nothing until launched.
 */
export function HouseCaBlock({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const address = houseLaunched() ? HOUSE.address : null;
  const explorer = tokenExplorerUrl();
  if (!address || !explorer) return null;

  return (
    <div
      className={cn(
        "panel flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="min-w-0 font-mono text-xs text-ink">
        <span className="text-ink-subtle">CA </span>
        <span ref={ref} className="break-all select-all">
          {address}
        </span>
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <CopyAddress address={address} variant="full" selectRef={ref} />
        <a href={explorer} target="_blank" rel="noreferrer" className="btn-ghost-sm min-h-11">
          Explorer ↗
        </a>
      </div>
    </div>
  );
}

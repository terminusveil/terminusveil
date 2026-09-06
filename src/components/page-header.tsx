import type { ReactNode } from "react";
import { Mark } from "@/components/mark";

export function PageHeader({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: string;
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex max-w-2xl items-start gap-4">
      <Mark className="mt-1 size-10 shrink-0 sm:size-12" tile />
      <div>
        <p className="kicker">{kicker}</p>
        <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight text-ink">{title}</h1>
        {lede ? (
          <p className="mt-4 text-base leading-relaxed text-pretty text-ink-muted">{lede}</p>
        ) : null}
        {children}
      </div>
    </header>
  );
}

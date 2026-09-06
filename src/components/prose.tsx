import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DocSection({
  id,
  title,
  children,
  className,
  rule = false,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
  /** /token: a hairline above the section and a display-size head, so a long page has rhythm. */
  rule?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn("mt-12 scroll-mt-24", rule && "border-t border-line pt-8", className)}
    >
      <h2
        className={cn(
          "tracking-tight text-ink",
          rule
            ? "font-display text-xl font-normal sm:text-2xl"
            : "font-display text-lg font-semibold",
        )}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DocP({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "mt-3 text-sm leading-relaxed text-pretty text-ink-muted sm:text-base",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** External link: new tab, no referrer. */
export function Ext({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "text-ink underline decoration-line underline-offset-4 hover:text-accent",
        className,
      )}
    >
      {children}
    </a>
  );
}

import { cn } from "@/lib/utils";

export function SectionHead({
  kicker,
  title,
  lede,
  size = "lg",
}: {
  /** Only where the label carries state (spec §9.2 D); the H2 names the section otherwise. */
  kicker?: string;
  title: string;
  lede?: string;
  /** `lg` is the section default; `md` holds the title at `text-2xl` on every width. */
  size?: "lg" | "md";
}) {
  return (
    <header className="max-w-xl">
      {kicker ? <p className="kicker">{kicker}</p> : null}
      <h2
        className={cn(
          "font-display leading-snug tracking-tight text-ink",
          kicker && "mt-3",
          size === "md" ? "text-2xl" : "text-2xl sm:text-3xl",
        )}
      >
        {title}
      </h2>
      {lede ? (
        <p className="mt-4 text-sm leading-relaxed text-pretty text-ink-muted sm:text-base">
          {lede}
        </p>
      ) : null}
    </header>
  );
}

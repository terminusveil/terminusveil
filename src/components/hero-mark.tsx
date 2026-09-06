import { MarkGlyph } from "@/components/mark";
import { cn } from "@/lib/utils";

export function HeroMark({ className }: { className?: string }) {
  return (
    <div className={cn("hero-colophon", className)} aria-hidden="true">
      <svg viewBox="0 0 64 64" className="mark mark-hero w-full" fill="none">
        <MarkGlyph />
      </svg>
    </div>
  );
}

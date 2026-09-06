import { useEffect, useState } from "react";

/**
 * The id of the section whose top has passed the reading line (a quarter down
 * the viewport); the first section before any has. Null until hydration, so
 * the server and the first client paint agree.
 */
export function useActiveSection(items: readonly { id: string }[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    let raf = 0;
    const pick = () => {
      raf = 0;
      const line = window.innerHeight * 0.25;
      let best: string | null = null;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= line) best = el.id;
      }
      setActive(best ?? els[0]?.id ?? null);
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(pick);
    };

    pick();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Layout settles after the first paint (web fonts, images, an opened <details>); re-measure then.
    void document.fonts?.ready.then(schedule);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    ro?.observe(document.body);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);

  return active;
}

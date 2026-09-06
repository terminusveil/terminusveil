import { useEffect } from "react";

export function useScrollProgress() {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;

    const measure = () => {
      raf = 0;
      const max = root.scrollHeight - window.innerHeight;
      const p = max <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / max));
      root.style.setProperty("--scroll", p.toFixed(4));
      root.dataset.scrolled = window.scrollY > 10 ? "1" : "0";
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}

import { useEffect, type RefObject } from "react";

export function usePointerField(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let raf = 0;
    let cx = 0;
    let cy = 0;

    const paint = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const x = cx - r.left;
      const y = cy - r.top;
      el.classList.add("is-armed");
      el.style.setProperty("--px", `${x}px`);
      el.style.setProperty("--py", `${y}px`);
      el.style.setProperty("--tx", `${(x / r.width - 0.5) * -14}px`);
      el.style.setProperty("--ty", `${(y / r.height - 0.5) * -10}px`);
    };

    const onMove = (e: PointerEvent) => {
      cx = e.clientX;
      cy = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      el.classList.remove("is-armed");
      el.style.setProperty("--px", "78%");
      el.style.setProperty("--py", "18%");
      el.style.setProperty("--tx", "0px");
      el.style.setProperty("--ty", "0px");
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
}

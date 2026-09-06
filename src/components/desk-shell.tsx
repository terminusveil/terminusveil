import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { NamePalette } from "@/components/name-palette";
import { NameRiver } from "@/components/name-river";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { useScrollProgress } from "@/components/scroll-progress";
import { hydrateCovering } from "@/lib/terminus/covering";
import { DeskClock } from "@/lib/terminus/desk-clock";
import type { DeskPayload } from "@/lib/terminus/types";

export function DeskShell({
  desk,
  claim = true,
  children,
}: {
  desk: DeskPayload;
  claim?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  useScrollProgress();

  useEffect(() => {
    void hydrateCovering();
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      const path = router.state.location.pathname;
      if (path === "/docs" || path === "/terms" || path === "/privacy") return;
      void router.invalidate();
    };
    const id = window.setInterval(tick, 45_000);
    return () => window.clearInterval(id);
  }, [router]);

  return (
    <DeskClock.Provider value={desk.source === "snapshot" ? desk.clockMs : null}>
      <div className="relative min-h-dvh bg-paper text-ink">
        <div className="site-rail" aria-hidden="true" />
        <div className="site-grain" aria-hidden="true" />
        <div className="scroll-veil" aria-hidden="true" />
        <div className="relative z-[1]">
          <SiteNav />
          <NameRiver rows={desk.rows} />
          {children}
          <SiteFooter claim={claim} />
        </div>
        <NamePalette desk={desk} />
      </div>
    </DeskClock.Provider>
  );
}

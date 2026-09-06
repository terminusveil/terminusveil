import { createRouter } from "@tanstack/react-router";
import { DeskMissing, DeskPending } from "@/components/desk-pending";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultPendingComponent: DeskPending,
    defaultNotFoundComponent: DeskMissing,
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}

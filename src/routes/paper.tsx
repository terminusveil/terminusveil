import { createFileRoute, redirect } from "@tanstack/react-router";

/** The spec page folded into /docs. Old links land on the "What the desk reads" section. */
export const Route = createFileRoute("/paper")({
  beforeLoad: () => {
    throw redirect({ to: "/docs", hash: "spec" });
  },
});

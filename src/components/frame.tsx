import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Frame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("relative", className)}>{children}</div>;
}

import { timingSafeEqual } from "node:crypto";

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * The pinger's `x-wire-key` against WIRE_CRON_KEY, or Vercel Cron's
 * `Authorization: Bearer` against CRON_SECRET. An unset or empty secret never
 * matches. Constant-time compares.
 */
export function wireAuthorised(
  headers: { get(name: string): string | null },
  env: { WIRE_CRON_KEY?: string; CRON_SECRET?: string },
): boolean {
  const key = headers.get("x-wire-key");
  if (env.WIRE_CRON_KEY && key && same(key, env.WIRE_CRON_KEY)) return true;
  const auth = headers.get("authorization");
  if (env.CRON_SECRET && auth && same(auth, `Bearer ${env.CRON_SECRET}`)) return true;
  return false;
}

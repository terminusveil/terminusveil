/**
 * `console.warn` rate-limited to once per `windowMs`. Each call site owns a
 * `WarnGate` (a module- or instance-level timestamp) so one noisy path cannot
 * suppress another's warning, and a healthy refresh does not spam the log.
 */
export type WarnGate = { at: number };

export function warnGate(): WarnGate {
  return { at: -Infinity };
}

export function warnOnce(
  gate: WarnGate,
  windowMs: number,
  now: number,
  message: string,
  extra?: Record<string, unknown>,
): void {
  if (now - gate.at < windowMs) return;
  gate.at = now;
  if (extra !== undefined) console.warn(message, extra);
  else console.warn(message);
}

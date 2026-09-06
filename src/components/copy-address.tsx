import { useEffect, useRef, useState, type RefObject } from "react";

type CopyState = "idle" | "done" | "failed";
export type CopyLabels = { idle: string; done: string; failed: string };

/** `full` variant defaults: the CA block on /token (readiness item 11). */
const FULL_LABELS: CopyLabels = { idle: "Copy CA", done: "Copied", failed: "Select and copy" };

/** Clipboard API first; the legacy `execCommand` path for browsers that refuse it. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    try {
      ta.select();
      return document.execCommand("copy");
    } finally {
      document.body.removeChild(ta);
    }
  } catch {
    return false;
  }
}

/** Select a node's text so the reader can copy it by hand when the clipboard is refused. */
function selectContents(node: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function CopyAddress({
  address,
  className,
  variant = "short",
  labels,
  selectRef,
}: {
  address: `0x${string}`;
  className?: string;
  /** `short`: the label is the shortened address. `full`: a labelled button that copies the whole address. */
  variant?: "short" | "full";
  /** `full` only: idle, success and failure labels; failure shows for 2 s. */
  labels?: Partial<CopyLabels>;
  /** `full` only: on failure, select this node's text (the full address next to the button). */
  selectRef?: RefObject<HTMLElement | null>;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<number | null>(null);
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const full = variant === "full";
  const text: CopyLabels = full
    ? { ...FULL_LABELS, ...labels }
    : { idle: short, done: "copied", failed: short };
  const classes =
    className ?? (full ? "btn-ghost-sm min-h-11" : "font-mono text-xs text-ink hover:text-accent");

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <button
      type="button"
      className={classes}
      onClick={async () => {
        const ok = await copyText(address);
        if (!ok && selectRef?.current) selectContents(selectRef.current);
        setState(ok ? "done" : "failed");
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setState("idle"), full ? 2000 : 1600);
      }}
    >
      {text[state]}
    </button>
  );
}

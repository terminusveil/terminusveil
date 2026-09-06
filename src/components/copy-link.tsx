import { useState } from "react";

export function CopyLink({
  path,
  label = "Copy link",
  className = "font-mono text-xs text-ink-subtle hover:text-accent",
}: {
  path: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const href = `${window.location.origin}${path}`;
        try {
          await navigator.clipboard.writeText(href);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "copied" : label}
    </button>
  );
}

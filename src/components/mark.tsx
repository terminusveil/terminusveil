import { cn } from "@/lib/utils";

/** Didone V whose cross-stroke is the covering. */
export function MarkGlyph({
  tile = false,
  mono = false,
}: {
  tile?: boolean;
  mono?: boolean;
}) {
  const v = tile ? "#EEF2E4" : "currentColor";
  const veil = tile || !mono ? "#C8F033" : "currentColor";
  return (
    <>
      {tile ? (
        <rect
          x="1"
          y="1"
          width="62"
          height="62"
          fill="#101214"
          stroke="#3A3E36"
          strokeWidth="1.5"
        />
      ) : null}
      <g transform={tile ? "translate(5.6 4.8) scale(0.83)" : undefined}>
        <path
          className="mark-v"
          fill={v}
          d="M8.4 6.9h20.1L27.1 11.5H22.2V52.9l1.35 1v3.95H12.55v-3.95l.25-1V11.5H9.55Z"
        />
        <path
          className="mark-v"
          fill={v}
          d="M38.2 6.9h17.3l-1.4 4.35-6.55 3.35L23.4 52.1l-2.7-1.05L43.7 14.6 39.8 11.25Z"
        />
        <rect
          className="mark-veil"
          x="22.1"
          y="27.9"
          width="26.2"
          height="4.1"
          fill={veil}
        />
      </g>
    </>
  );
}

export function Mark({
  className,
  drawn = false,
  tile = false,
  mono = false,
}: {
  className?: string;
  drawn?: boolean;
  tile?: boolean;
  mono?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("mark", drawn && "mark-drawn", className)}
      aria-hidden="true"
      fill="none"
    >
      <MarkGlyph tile={tile} mono={mono} />
    </svg>
  );
}

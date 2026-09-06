export type GlossaryEntry = { term: string; plain: string };

/** Desk vocabulary in plain English. Order is reading order. */
export const GLOSSARY: readonly GlossaryEntry[] = [
  { term: "ticker", plain: "A stock token's symbol on Robinhood Chain. Public." },
  {
    term: "live ×",
    plain: "The multiplier in force now, uiMultiplier(). 1× means one token equals one share.",
  },
  {
    term: "staged ×",
    plain: "The next multiplier, newUIMultiplier(). Written to the contract, not in force.",
  },
  {
    term: "terminus",
    plain:
      "The moment staged becomes live. effectiveAt() on-chain, or the issuer's process date at 09:30 ET when no time is published; that time is assumed.",
  },
  { term: "veiled", plain: "A ticker with a pending action and terminus still ahead." },
  {
    term: "due",
    plain: "Process date passed. No multiplier move read yet. The desk will not guess.",
  },
  {
    term: "oracle",
    plain: "The token's price-feed pause flag, oraclePaused(). Paused means no on-chain price.",
  },
  {
    term: "covering",
    plain: "Your shortlist of veiled tickers, sealed until terminus. Kept in this browser today.",
  },
  { term: "plate", plain: "The card that shows one ticker's four facts." },
  { term: "house", plain: "This project and its token, $VEIL." },
];

export function glossaryPick(terms: readonly string[]): GlossaryEntry[] {
  const out: GlossaryEntry[] = [];
  for (const t of terms) {
    const hit = GLOSSARY.find((g) => g.term === t);
    if (hit) out.push(hit);
  }
  return out;
}

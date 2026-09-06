/** Deck `house.card2Body` (theKeyBurns): the proof card, pre-Wire and Wire-live. Future tense is not used. */
export const PROOF_NEXT =
  "Every figure links to the contract it came from. Next: the Wire, the desk's reads posted on-chain.";
export const PROOF_LIVE =
  "Every read the desk makes is posted on Robinhood Chain beside the contract it came from. Compare them yourself.";

export type HouseCard = { k: string; lead: string; body: string };

/**
 * The landing's three house cards. Owner pass 2026-09-05: each card opens on
 * the noun it is about. theKeyBurns: the cards follow the phases, 0 · 1 · 2.
 * Lives here rather than in the component so a test can read it — the phase-1
 * card must stop saying `next` the moment the Wire facts are pasted.
 */
export function houseCards(wire: boolean): HouseCard[] {
  return [
    {
      k: "Phase 0 · live",
      lead: "The desk.",
      body: "Four reads per ticker, events by process date, the pools that hold a veiled ticker, a covering in your browser.",
    },
    {
      k: `Phase 1 · ${wire ? "live" : "next"}`,
      lead: "The proof.",
      body: wire ? PROOF_LIVE : PROOF_NEXT,
    },
    {
      k: "Phase 2 · next",
      lead: "The key.",
      body: "An alert before terminus, a webhook and API feed of the pending tape, the covering synced. Opened by a pass paid in $VEIL; a share of every pass burns.",
    },
  ];
}

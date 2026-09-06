import { EXPLORER_URL } from "./chain.ts";

export type PhaseStatus = "live" | "next" | "planned" | "vision";
export const PHASE_STATUSES: readonly PhaseStatus[] = ["live", "next", "planned", "vision"];

export type Phase = {
  n: "0" | "1" | "2" | "3";
  name: string;
  status: PhaseStatus;
  /** Plain-English facts. Never a date. */
  what: string[];
  who: string;
};

export type HouseLinksShape = {
  x: string | null;
  /** Token page on ponsfamily.com. */
  pons: string | null;
  /** Uniswap v4 pool link; pasted on graduation day, not at creation. */
  pair: string | null;
};

export type HouseWire = {
  /** The TerminusWire contract; pasted together with `poster` after deploy. */
  address: `0x${string}` | null;
  /** The house's poster wallet; the desk reads only this address's posts. */
  poster: `0x${string}` | null;
};

export type HousePass = {
  /** The VeilPass contract; pasted when the Key ships, never before. */
  address: `0x${string}` | null;
};

export type House = {
  symbol: string;
  display: string;
  name: string;
  chainId: number;
  /** Token contract address, given by pons at creation. */
  address: `0x${string}` | null;
  /** Creator wallet set on the pons create form; receives creator fees and the creator tax. */
  feeWallet: `0x${string}` | null;
  /** Whole-token supply as pons shows it at creation, digits only (e.g. "1000000000"); null until pasted. */
  supply: string | null;
  /** The quote asset's symbol as pons shows it (e.g. "ETH"); null until pasted. */
  pairAsset: string | null;
  links: HouseLinksShape;
  /** Phase 1, the Wire. Two facts, pasted together (ARCHITECTURE.md, section 5). */
  wire: HouseWire;
  /** Phase 2, the Pass. One fact, pasted with the Key. */
  pass: HousePass;
  launchpad: {
    /** Written lowercase, per pons's attribution rule; the first mention on a page links to `url`. */
    name: string;
    /** The factory the token is created on. Every mechanism sentence on the site describes it. */
    version: "v2";
    url: string;
    docs: string;
    /** Date the launchpad facts were last checked against the pons docs. */
    checkedOn: string;
  };
};

/**
 * The single source of house facts. Paste the token facts here when pons
 * gives them: at creation `address`, `links.pons`, `feeWallet`, `supply`
 * and `pairAsset`, together; `links.pair` at graduation; `wire.address`
 * and `wire.poster` together after the Wire deploy; `pass.address` with
 * the Key. Everything on the site derives from this object. Never invent
 * a value.
 *
 * The owner's create-form settings (creator tax, holder fee sharing, buyback)
 * live outside the repo, in docs/launch/; the site never prints them.
 */
export const HOUSE: House = {
  symbol: "VEIL",
  display: "$VEIL",
  name: "Terminus Veil",
  chainId: 4663,
  address: null,
  feeWallet: null,
  supply: null,
  pairAsset: null,
  links: {
    x: "https://x.com/terminus_veil",
    pons: null,
    pair: null,
  },
  wire: {
    address: "0x08Cb2D14e80DD6f8E258A140d9d55519B5E0D916",
    poster: "0x7A4AB233aD8F5Ba4766ecA7758Ac0f9c08Ae6177",
  },
  pass: { address: null },
  launchpad: {
    name: "pons",
    version: "v2",
    url: "https://www.ponsfamily.com",
    docs: "https://docs.ponsfamily.com",
    checkedOn: "2026-09-04",
  },
};

/** Test factory. Shallow-merges `links`, `wire` and `pass` so a partial override keeps the rest. */
export function houseFrom(
  partial: Partial<Omit<House, "links" | "wire" | "pass">> & {
    links?: Partial<HouseLinksShape>;
    wire?: Partial<HouseWire>;
    pass?: Partial<HousePass>;
  },
): House {
  return {
    ...HOUSE,
    ...partial,
    links: { ...HOUSE.links, ...(partial.links ?? {}) },
    wire: { ...HOUSE.wire, ...(partial.wire ?? {}) },
    pass: { ...HOUSE.pass, ...(partial.pass ?? {}) },
  };
}

export function houseLaunched(house: House = HOUSE): boolean {
  return Boolean(house.address);
}

/** Both Wire facts, or null: the desk never reads a Wire with half its facts. */
export function wireFacts(
  house: House = HOUSE,
): { address: `0x${string}`; poster: `0x${string}` } | null {
  const { address, poster } = house.wire;
  return address && poster ? { address, poster } : null;
}

/** True only when the Wire contract and the house's poster are both pasted. */
export function wireLive(house: House = HOUSE): boolean {
  return wireFacts(house) !== null;
}

export const PHASES: readonly Phase[] = [
  {
    n: "0",
    name: "Desk",
    status: "live",
    what: [
      "Four reads per ticker.",
      "Events by process date.",
      "Calendar and ICS.",
      "Windows: the pools that hold a veiled ticker.",
      "Covering in this browser.",
      "Verify on explorer.",
    ],
    who: "Everyone. Free.",
  },
  {
    n: "1",
    name: "Wire",
    status: wireLive() ? "live" : "next",
    what: [
      "The desk's reads, posted on Robinhood Chain: staged ×, terminus, time of post, per ticker.",
      "Anyone reads it. Any contract reads it.",
    ],
    who: "Everyone. Free.",
  },
  {
    n: "2",
    name: "Key",
    status: "next",
    what: [
      "Alert before terminus.",
      "Webhook and API feed of the pending tape.",
      "Covering synced across devices.",
      "Opened by a pass paid in $VEIL. A share of every pass burns.",
    ],
    who: "Pass holders.",
  },
  {
    n: "3",
    name: "Matcher",
    status: "vision",
    what: [
      "Pairing readers who take opposite views on a veiled ticker before terminus.",
      "The Wire settles it. Not designed yet.",
    ],
    who: "—",
  },
];

export function wireExplorerUrl(house: House = HOUSE): string | null {
  return house.wire.address ? `${EXPLORER_URL}/address/${house.wire.address}` : null;
}

export function passExplorerUrl(house: House = HOUSE): string | null {
  return house.pass.address ? `${EXPLORER_URL}/address/${house.pass.address}` : null;
}

export function houseStamp(house: House = HOUSE): "Live" | "Not launched" {
  return houseLaunched(house) ? "Live" : "Not launched";
}

export function houseCaLine(house: House = HOUSE): string {
  return house.address ?? "—";
}

export function tokenExplorerUrl(house: House = HOUSE): string | null {
  return house.address ? `${EXPLORER_URL}/token/${house.address}` : null;
}

export function feeWalletExplorerUrl(house: House = HOUSE): string | null {
  return house.feeWallet ? `${EXPLORER_URL}/address/${house.feeWallet}` : null;
}

/** pons's Terms of Use, which set who may trade there. Linked from the eligibility lines. */
export function launchpadTermsUrl(house: House = HOUSE): string {
  return `${house.launchpad.url}/terms`;
}

/** The pasted supply with thousands separators, for the spec sheet; null until pasted. */
export function houseSupply(house: House = HOUSE): string | null {
  if (!house.supply) return null;
  return house.supply.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export type HouseLink = { label: string; href: string };

/** Only the links that exist, in a fixed order. */
export function houseLinks(house: House = HOUSE): HouseLink[] {
  const out: HouseLink[] = [];
  if (house.links.pons) out.push({ label: "pons", href: house.links.pons });
  if (house.links.pair) out.push({ label: "Pool", href: house.links.pair });
  const token = tokenExplorerUrl(house);
  if (token) out.push({ label: "Token on explorer", href: token });
  const fee = feeWalletExplorerUrl(house);
  if (fee) out.push({ label: "Fee wallet", href: fee });
  if (house.links.x) out.push({ label: "X", href: house.links.x });
  return out;
}

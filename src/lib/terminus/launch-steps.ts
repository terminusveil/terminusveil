import {
  HOUSE,
  feeWalletExplorerUrl,
  houseLaunched,
  passExplorerUrl,
  tokenExplorerUrl,
  wireExplorerUrl,
  wireLive,
  type House,
} from "./house.ts";

export type StepWord =
  "next" | "at launch" | "after launch" | "at graduation" | "done" | "live" | "ahead";

export type LaunchStep = {
  n: 1 | 2 | 3 | 4;
  name: "Create" | "Curve" | "Graduation" | "Pool";
  line: string;
  status: StepWord;
};

/**
 * The pons v2 lifecycle as the site states it (spec §6.3; facts in
 * 2026-09-04-pons-v2-facts.md). Status words move with the pasted facts:
 * nothing → address → pool link.
 */
export function launchSteps(house: House = HOUSE): LaunchStep[] {
  const launched = houseLaunched(house);
  const graduated = launched && Boolean(house.links.pair);
  const pick = (pre: StepWord, mid: StepWord, post: StepWord): StepWord =>
    graduated ? post : launched ? mid : pre;
  return [
    {
      n: 1,
      name: "Create",
      line: "Name, symbol, image, links and supply, fixed at creation.",
      status: pick("next", "done", "done"),
    },
    {
      n: 2,
      name: "Curve",
      line: "The whole supply on a bonding curve. Buy and sell against the curve.",
      status: pick("at launch", "live", "done"),
    },
    {
      n: 3,
      name: "Graduation",
      line: "Automatic, inside the purchase that finishes the curve.",
      status: pick("after launch", "ahead", "done"),
    },
    {
      n: 4,
      name: "Pool",
      line: "A Uniswap v4 pool, liquidity locked. No unlock exists.",
      status: pick("at graduation", "at graduation", "live"),
    },
  ];
}

export type VerifyRow = {
  k: "Contract" | "Curve" | "Pool" | "Fee wallet" | "Wire" | "Pass";
  /** Printed while the thing does not exist yet; null once `href` is set. */
  status: "at launch" | "at graduation" | "next" | "with the Key" | null;
  href: string | null;
  label: "Explorer ↗" | "pons ↗" | "Uniswap v4 ↗";
  /** The address to print and copy, for the rows that have one. */
  address: `0x${string}` | null;
};

/**
 * The verify table on /token (spec §6.4). The Wire row keys off the Wire
 * facts (`wireLive`), not the launch: it can go live before or after the
 * token itself. The Pass row prints `with the Key` until `pass.address` is
 * pasted, and never once it is.
 */
export function verifyRows(house: House = HOUSE): VerifyRow[] {
  const launched = houseLaunched(house);
  const token = launched ? tokenExplorerUrl(house) : null;
  const curve = launched ? house.links.pons : null;
  const pool = launched ? house.links.pair : null;
  const fee = launched ? feeWalletExplorerUrl(house) : null;
  return [
    {
      k: "Contract",
      status: token ? null : "at launch",
      href: token,
      label: "Explorer ↗",
      address: launched ? house.address : null,
    },
    { k: "Curve", status: curve ? null : "at launch", href: curve, label: "pons ↗", address: null },
    {
      k: "Pool",
      status: pool ? null : "at graduation",
      href: pool,
      label: "Uniswap v4 ↗",
      address: null,
    },
    {
      k: "Fee wallet",
      status: fee ? null : "at launch",
      href: fee,
      label: "Explorer ↗",
      address: launched ? house.feeWallet : null,
    },
    {
      k: "Wire",
      status: wireLive(house) ? null : "next",
      href: wireLive(house) ? wireExplorerUrl(house) : null,
      label: "Explorer ↗",
      address: wireLive(house) ? house.wire.address : null,
    },
    {
      k: "Pass",
      status: house.pass.address ? null : "with the Key",
      href: passExplorerUrl(house),
      label: "Explorer ↗",
      address: house.pass.address,
    },
  ];
}

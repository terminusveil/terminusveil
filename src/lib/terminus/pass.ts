import { decodeFunctionResult, encodeFunctionData } from "viem";
import type { PassRead } from "./types.ts";

/** VeilPass, as deployed from `contracts/contracts/VeilPass.sol`; the reads only. */
export const PASS_ABI = [
  {
    type: "function",
    name: "price",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "burnBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint16" }],
  },
  {
    type: "function",
    name: "PERIOD",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "house",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "activeUntil",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "isActive",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export type PassCall = "price" | "burnBps" | "PERIOD" | "house";

export function encodePassCall(name: PassCall): `0x${string}` {
  return encodeFunctionData({ abi: PASS_ABI, functionName: name });
}

// Non-generic (`name: PassCall`, not `<T extends PassCall>(name: T, ...)`): viem 2.56's
// `decodeFunctionResult` overloads don't resolve through a generic `functionName` type
// parameter (tsc TS2345), so the call-site type stays untyped rather than narrowed per call.
function decode(name: PassCall, data: string | null | undefined) {
  if (!data || data === "0x") return null;
  try {
    return decodeFunctionResult({ abi: PASS_ABI, functionName: name, data: data as `0x${string}` });
  } catch {
    return null;
  }
}

/** All four reads or nothing: a half-read pass never prints. */
export function decodePass(
  address: `0x${string}`,
  raw: {
    price: string | null;
    burnBps: string | null;
    period: string | null;
    house: string | null;
  },
): PassRead | null {
  const price = decode("price", raw.price);
  const burnBps = decode("burnBps", raw.burnBps);
  const period = decode("PERIOD", raw.period);
  const house = decode("house", raw.house);
  if (price === null || burnBps === null || period === null || house === null) return null;
  return {
    address,
    price: price.toString(),
    burnBps: Number(burnBps),
    periodSec: Number(period),
    house: house as `0x${string}`,
  };
}

const WAD = 10n ** 18n;

/**
 * Whole $VEIL with thousands separators and up to two decimals, truncated:
 * `1,000`, `12.5`, `0.01`. An amount too small for two decimals reads
 * `<0.01`, never a truncated `0` — a price is a figure someone pays.
 */
export function formatVeil(wei: string): string {
  const n = BigInt(wei);
  const whole = (n / WAD).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (n % WAD).toString().padStart(18, "0").slice(0, 2).replace(/0+$/, "");
  if (!frac && whole === "0" && n > 0n) return "<0.01";
  return frac ? `${whole}.${frac}` : whole;
}

/** Basis points as a percentage with up to two decimals: 2500 → `25`, 1250 → `12.5`, 1 → `0.01`. */
export function burnPercent(bps: number): string {
  const whole = Math.floor(bps / 100);
  const frac = String(bps % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

/** `1,000 $VEIL · 30 days · 25% burns`, every figure from the chain. */
export function passFact(p: PassRead): string {
  const days = Math.round(p.periodSec / 86_400);
  return `${formatVeil(p.price)} $VEIL · ${days} days · ${burnPercent(p.burnBps)}% burns`;
}

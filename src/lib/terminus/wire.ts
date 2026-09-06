import { decodeFunctionResult, encodeFunctionData, stringToHex } from "viem";
import { formatMultiplier, formatTerminus } from "./format.ts";
import { HOUSE, wireLive, type House } from "./house.ts";
import type { TickerRow, WireRead } from "./types.ts";

/** TerminusWire, as deployed from `contracts/contracts/TerminusWire.sol`. */
export const WIRE_ABI = [
  {
    type: "function",
    name: "latest",
    stateMutability: "view",
    inputs: [
      { name: "by", type: "address" },
      { name: "ticker", type: "bytes32" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "staged", type: "uint256" },
          { name: "terminus", type: "uint64" },
          { name: "postedAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "count",
    stateMutability: "view",
    inputs: [{ name: "by", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "post",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ticker", type: "bytes32" },
      { name: "staged", type: "uint256" },
      { name: "terminus", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "postMany",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tickers", type: "bytes32[]" },
      { name: "staged", type: "uint256[]" },
      { name: "terminus", type: "uint64[]" },
    ],
    outputs: [],
  },
] as const;

/** A ticker as the Wire keys it: UTF-8, right-padded to 32 bytes (ethers' encodeBytes32String). */
export function tickerBytes32(ticker: string): `0x${string}` {
  return stringToHex(ticker, { size: 32 });
}

export function encodeLatest(poster: `0x${string}`, ticker: string): `0x${string}` {
  return encodeFunctionData({
    abi: WIRE_ABI,
    functionName: "latest",
    args: [poster, tickerBytes32(ticker)],
  });
}

export function encodeCount(poster: `0x${string}`): `0x${string}` {
  return encodeFunctionData({ abi: WIRE_ABI, functionName: "count", args: [poster] });
}

/** Null when the call did not decode or nothing was posted (staged 0). */
export function decodeLatest(hex: string | null | undefined): WireRead | null {
  if (!hex || hex === "0x") return null;
  try {
    const p = decodeFunctionResult({
      abi: WIRE_ABI,
      functionName: "latest",
      data: hex as `0x${string}`,
    });
    if (p.staged === 0n) return null;
    return {
      staged: p.staged.toString(),
      terminus: Number(p.terminus),
      postedAt: Number(p.postedAt),
    };
  } catch {
    return null;
  }
}

export function decodeCount(hex: string | null | undefined): number | null {
  if (!hex || hex === "0x") return null;
  try {
    return Number(
      decodeFunctionResult({ abi: WIRE_ABI, functionName: "count", data: hex as `0x${string}` }),
    );
  } catch {
    return null;
  }
}

type WireRow = Pick<
  TickerRow,
  "state" | "wire" | "wireRead" | "stagedOnchain" | "liveOnchain" | "effectiveAtOnchainSec"
>;

export type ContractFigure = { staged: string; terminus: number };

/**
 * What the contract holds now, in the Wire's terms: `newUIMultiplier()` (the
 * live figure when nothing is staged, since the contract then holds the same
 * number in both) and `effectiveAt()` (0 when unset). Null when the contract
 * was not read.
 */
export function contractFigure(
  row: Pick<WireRow, "stagedOnchain" | "liveOnchain" | "effectiveAtOnchainSec">,
): ContractFigure | null {
  const staged = row.stagedOnchain ?? row.liveOnchain;
  if (!staged) return null;
  return { staged, terminus: row.effectiveAtOnchainSec ?? 0 };
}

/** True when the post still carries what the contract holds now: same figure, same terminus (0 = unset). */
export function wireMatches(
  wire: WireRead,
  row: Pick<WireRow, "stagedOnchain" | "liveOnchain" | "effectiveAtOnchainSec">,
): boolean {
  const c = contractFigure(row);
  return c !== null && BigInt(c.staged) === BigInt(wire.staged) && c.terminus === wire.terminus;
}

/**
 * The plate line after `Wire ·`; null only while the Wire is not live. Every
 * row the desk reads gets a line, since every read is posted.
 *
 * `not posted yet` is a claim about the chain, so it prints only when the read
 * ran and the chain answered for this ticker (`wireRead`). Without that the
 * line says `not read`: the desk states what it did, never what it did not see.
 */
export function wireFact(row: WireRow, house: House = HOUSE): string | null {
  if (!wireLive(house)) return null;
  if (!row.wire) return row.wireRead ? "not posted yet" : "not read";
  const posted = `posted ${formatTerminus(new Date(row.wire.postedAt * 1000).toISOString())}`;
  const figure = formatMultiplier(row.wire.staged);
  if (wireMatches(row.wire, row)) return `${figure} · ${posted} · matches the contract`;
  const c = contractFigure(row);
  const now = c ? formatMultiplier(c.staged) : "nothing read";
  return `${figure} · ${posted} · contract now reads ${now}`;
}

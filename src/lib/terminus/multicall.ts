import { decodeFunctionResult, encodeFunctionData } from "viem";

/**
 * Multicall3 at its canonical address. Robinhood Chain carries the deployment
 * (3808 bytes of code at this address on the public RPC and on Alchemy), so
 * hundreds of view reads ride in one `eth_call` instead of one request each.
 * A hosted free tier meters calls per second; the desk's 970 reads sent as
 * 970 calls were throttled mid-refresh (HTTP 429), which cost names their
 * figures and, when the tape read landed in a throttled second, the whole
 * desk its live source.
 */
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

/** Sub-calls per `eth_call`: keeps each answer near 80 KB and well inside a provider's gas cap. */
export const MULTICALL_CHUNK = 250;

export const MULTICALL3_ABI = [
  {
    type: "function",
    name: "aggregate3",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
] as const;

export type SubCall = { target: `0x${string}`; callData: `0x${string}` };

/** `aggregate3` calldata for these sub-calls, every one allowed to fail on its own. */
export function encodeAggregate3(calls: SubCall[]): `0x${string}` {
  return encodeFunctionData({
    abi: MULTICALL3_ABI,
    functionName: "aggregate3",
    args: [calls.map((c) => ({ target: c.target, allowFailure: true, callData: c.callData }))],
  });
}

/**
 * Each sub-call's return data in order; null where it reverted or answered
 * bare `0x`, the same two cases a single eth_call leaves undecodable. Throws
 * when `hex` is not an `aggregate3` answer.
 */
export function decodeAggregate3(hex: `0x${string}`): (`0x${string}` | null)[] {
  const out = decodeFunctionResult({ abi: MULTICALL3_ABI, functionName: "aggregate3", data: hex });
  return out.map((r) => (r.success && r.returnData !== "0x" ? r.returnData : null));
}

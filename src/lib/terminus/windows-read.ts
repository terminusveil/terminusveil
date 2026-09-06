import { decodeFunctionResult, encodeFunctionData } from "viem";
import { hexResult, logsRpcUrl, rpcBatch } from "./relay-live.ts";
import {
  INITIALIZE_TOPIC,
  PONS_FACTORY,
  TOKEN_LAUNCHED_TOPIC,
  UNISWAP_V4_POOL_MANAGER,
  classifyHook,
  decodeInitialize,
  decodeTokenLaunched,
  emptyEntry,
  sortLaunches,
  INDEX_LAUNCH_CAP,
  type LaunchPhase,
  type PonsLaunch,
  type RawLog,
  type WindowsDelta,
  type WindowsEntry,
} from "./windows.ts";

export const PONS_FACTORY_ABI = [
  {
    type: "function",
    name: "getLaunchedToken",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "curve", type: "address" },
          { name: "deployer", type: "address" },
          { name: "creatorFeeRecipient", type: "address" },
          { name: "pairToken", type: "address" },
          { name: "graduationThreshold", type: "uint256" },
          { name: "poolFee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "creatorTaxBps", type: "uint16" },
          { name: "buybackEnabled", type: "bool" },
          { name: "phase", type: "uint8" },
          { name: "sweptQuote", type: "uint256" },
          { name: "sweptTokens", type: "uint256" },
          { name: "sweptAt", type: "uint256" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
] as const;

export const ERC20_SYMBOL_ABI = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

const LOG_OPTS = () => ({ chunk: 5, attempts: 1, timeoutMs: 4_000, url: logsRpcUrl() });
const hex = (n: number) => "0x" + n.toString(16);
const padTopic = (address: string) => "0x" + address.slice(2).toLowerCase().padStart(64, "0");

export function decodeSymbol(data: string | null): string | null {
  if (!data || data === "0x") return null;
  try {
    return decodeFunctionResult({
      abi: ERC20_SYMBOL_ABI,
      functionName: "symbol",
      data: data as `0x${string}`,
    });
  } catch {
    return null;
  }
}

export function decodePhase(data: string | null): LaunchPhase | null {
  if (!data || data === "0x") return null;
  try {
    const r = decodeFunctionResult({
      abi: PONS_FACTORY_ABI,
      functionName: "getLaunchedToken",
      data: data as `0x${string}`,
    });
    if (!r.exists) return null;
    const p = Number(r.phase);
    return p === 0 || p === 1 || p === 2 || p === 3 ? p : null;
  } catch {
    return null;
  }
}

/** `symbol()` on each launch token and `getLaunchedToken()` on the Factory, one batch. Failed calls leave nulls. */
export async function readLaunchDetails(
  tokens: `0x${string}`[],
): Promise<Map<string, { symbol: string | null; phase: LaunchPhase | null }>> {
  const out = new Map<string, { symbol: string | null; phase: LaunchPhase | null }>();
  if (tokens.length === 0) return out;
  const batch: unknown[] = [];
  tokens.forEach((t, i) => {
    batch.push({
      jsonrpc: "2.0",
      id: 2 * i + 1,
      method: "eth_call",
      params: [
        { to: t, data: encodeFunctionData({ abi: ERC20_SYMBOL_ABI, functionName: "symbol" }) },
        "latest",
      ],
    });
    batch.push({
      jsonrpc: "2.0",
      id: 2 * i + 2,
      method: "eth_call",
      params: [
        {
          to: PONS_FACTORY,
          data: encodeFunctionData({
            abi: PONS_FACTORY_ABI,
            functionName: "getLaunchedToken",
            args: [t],
          }),
        },
        "latest",
      ],
    });
  });
  const byId = new Map((await rpcBatch(batch)).map((r) => [r.id, r]));
  tokens.forEach((t, i) => {
    out.set(t.toLowerCase(), {
      symbol: decodeSymbol(hexResult(byId.get(2 * i + 1))),
      phase: decodePhase(hexResult(byId.get(2 * i + 2))),
    });
  });
  return out;
}

/**
 * The windows delta for a set of ticker addresses over one block range: the
 * Factory's TokenLaunched logs (decoded, kept when paired to one of the
 * addresses) and the PoolManager's Initialize logs per address (two topic
 * filters each). Null when any log read failed, so the caller serves the index
 * alone rather than a half delta. Never throws: a failed call surfaces as a
 * missing (or errored) id, so `logsOf` returns null for it and the whole delta
 * comes back null, never a partial one.
 */
export async function readWindowsDelta(
  addresses: `0x${string}`[],
  range: { fromBlock: number; toBlock: number },
): Promise<WindowsDelta | null> {
  if (addresses.length === 0) return { ...range, byAddress: {} };
  const keys = [...new Set(addresses.map((a) => a.toLowerCase()))];
  const wanted = new Set(keys);
  const byAddress: Record<string, WindowsEntry> = {};
  for (const k of keys) byAddress[k] = emptyEntry();
  const from = hex(range.fromBlock);
  const to = hex(range.toBlock);

  const calls: unknown[] = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getLogs",
      params: [
        { address: PONS_FACTORY, topics: [TOKEN_LAUNCHED_TOPIC], fromBlock: from, toBlock: to },
      ],
    },
  ];
  keys.forEach((k, i) => {
    calls.push({
      jsonrpc: "2.0",
      id: 2 + 2 * i,
      method: "eth_getLogs",
      params: [
        {
          address: UNISWAP_V4_POOL_MANAGER,
          // currency1 (topics[3]); currency0 is the other filter below.
          topics: [INITIALIZE_TOPIC, null, null, padTopic(k)],
          fromBlock: from,
          toBlock: to,
        },
      ],
    });
    calls.push({
      jsonrpc: "2.0",
      id: 3 + 2 * i,
      method: "eth_getLogs",
      params: [
        {
          address: UNISWAP_V4_POOL_MANAGER,
          // currency0 (topics[2]).
          topics: [INITIALIZE_TOPIC, null, padTopic(k)],
          fromBlock: from,
          toBlock: to,
        },
      ],
    });
  });
  let entries;
  try {
    entries = await rpcBatch(calls, LOG_OPTS());
  } catch {
    return null;
  }
  const byId = new Map(entries.map((r) => [r.id, r]));
  const logsOf = (id: number): RawLog[] | null => {
    const e = byId.get(id);
    return e && !e.error && Array.isArray(e.result) ? (e.result as RawLog[]) : null;
  };

  const launched = logsOf(1);
  if (!launched) return null;
  const fresh: { pair: string; launch: PonsLaunch }[] = [];
  for (const log of launched) {
    const d = decodeTokenLaunched(log);
    if (!d || !wanted.has(d.pairToken)) continue;
    fresh.push({
      pair: d.pairToken,
      launch: { token: d.token, symbol: null, phase: null, block: d.block },
    });
  }
  for (let i = 0; i < keys.length; i += 1) {
    const a = logsOf(2 + 2 * i);
    const b = logsOf(3 + 2 * i);
    if (!a || !b) return null;
    const entry = byAddress[keys[i] as string] as WindowsEntry;
    for (const log of [...a, ...b]) {
      const d = decodeInitialize(log);
      if (d) entry.v4[classifyHook(d.hooks)] += 1;
    }
  }
  if (fresh.length > 0) {
    const details = await readLaunchDetails(fresh.map((f) => f.launch.token));
    for (const f of fresh) {
      const d = details.get(f.launch.token.toLowerCase());
      const entry = byAddress[f.pair] as WindowsEntry;
      entry.pons.push({ ...f.launch, symbol: d?.symbol ?? null, phase: d?.phase ?? null });
      entry.ponsTotal += 1;
    }
    for (const k of keys) {
      const entry = byAddress[k] as WindowsEntry;
      entry.pons = sortLaunches(entry.pons).slice(0, INDEX_LAUNCH_CAP);
    }
  }
  return { ...range, byAddress };
}

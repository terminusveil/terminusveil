import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, encodeFunctionResult } from "viem";
import {
  MULTICALL3_ABI,
  MULTICALL3_ADDRESS,
  MULTICALL_CHUNK,
  decodeAggregate3,
  encodeAggregate3,
} from "./multicall.ts";

const A = "0xf23250dac154D05Bb671CB0d0eBEf3c635c79CE2" as const;
const B = "0x2F62fC9fAbb470C690f141c28340eD832bB27020" as const;
const word = (n: bigint | number) => BigInt(n).toString(16).padStart(64, "0");

describe("multicall · constants", () => {
  it("names the canonical Multicall3 address and a chunk that keeps answers small", () => {
    assert.equal(MULTICALL3_ADDRESS, "0xcA11bde05977b3631167028862bE2a173976CA11");
    assert.equal(MULTICALL_CHUNK, 250);
  });
});

describe("encodeAggregate3", () => {
  it("encodes every sub-call with allowFailure set, in order", () => {
    const data = encodeAggregate3([
      { target: A, callData: "0xa60bf13d" },
      { target: B, callData: "0xdc767007" },
    ]);
    const { functionName, args } = decodeFunctionData({ abi: MULTICALL3_ABI, data });
    assert.equal(functionName, "aggregate3");
    assert.deepEqual(args[0], [
      { target: A, allowFailure: true, callData: "0xa60bf13d" },
      { target: B, allowFailure: true, callData: "0xdc767007" },
    ]);
  });
});

describe("decodeAggregate3", () => {
  it("keeps a successful answer, nulls a revert and a bare 0x, in the sub-call order", () => {
    const hex = encodeFunctionResult({
      abi: MULTICALL3_ABI,
      functionName: "aggregate3",
      result: [
        { success: true, returnData: `0x${word(10n ** 18n)}` },
        { success: false, returnData: "0x08c379a0" },
        { success: true, returnData: "0x" },
      ],
    });
    assert.deepEqual(decodeAggregate3(hex), [`0x${word(10n ** 18n)}`, null, null]);
  });

  it("throws on data that is not an aggregate3 answer", () => {
    assert.throws(() => decodeAggregate3("0x1234"));
  });
});

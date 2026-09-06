import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters } from "viem";
import { burnPercent, decodePass, encodePassCall, formatVeil, passFact } from "./pass.ts";

const WAD = 10n ** 18n;
const PASS = "0x5555555555555555555555555555555555555555" as const;
const HOUSE_WALLET = "0x2222222222222222222222222222222222222222" as const;
const u256 = (n: bigint) => encodeAbiParameters([{ type: "uint256" }], [n]);
const u16 = (n: number) => encodeAbiParameters([{ type: "uint16" }], [n]);
const u64 = (n: bigint) => encodeAbiParameters([{ type: "uint64" }], [n]);
const address = (a: `0x${string}`) => encodeAbiParameters([{ type: "address" }], [a]);

describe("pass reader", () => {
  it("encodes the four reads with their selectors", () => {
    assert.equal(encodePassCall("price"), "0xa035b1fe");
    assert.equal(encodePassCall("burnBps"), "0x53deb3d6");
    assert.equal(encodePassCall("PERIOD"), "0xb4d1d795");
    assert.equal(encodePassCall("house"), "0xff9b3acf");
  });

  it("decodes the four results into a PassRead, and null when any is missing", () => {
    const read = decodePass(PASS, {
      price: u256(1000n * WAD),
      burnBps: u16(2500),
      period: u64(2_592_000n),
      house: address(HOUSE_WALLET),
    });
    assert.deepEqual(read, {
      address: PASS,
      price: (1000n * WAD).toString(),
      burnBps: 2500,
      periodSec: 2_592_000,
      house: HOUSE_WALLET,
    });
    assert.equal(
      decodePass(PASS, {
        price: null,
        burnBps: u16(2500),
        period: u64(1n),
        house: address(HOUSE_WALLET),
      }),
      null,
    );
    assert.equal(
      decodePass(PASS, {
        price: "0x",
        burnBps: u16(2500),
        period: u64(1n),
        house: address(HOUSE_WALLET),
      }),
      null,
    );
  });

  it("formats $VEIL amounts with grouping and up to two decimals, and a burn share from basis points", () => {
    assert.equal(formatVeil((1000n * WAD).toString()), "1,000");
    assert.equal(formatVeil((12n * WAD + WAD / 2n).toString()), "12.5");
    assert.equal(formatVeil((WAD / 100n).toString()), "0.01");
    // A positive price never prints as 0: too small for two decimals reads `<0.01`.
    assert.equal(formatVeil("1"), "<0.01");
    assert.equal(formatVeil("0"), "0");
    assert.equal(burnPercent(2500), "25");
    assert.equal(burnPercent(1250), "12.5");
    assert.equal(burnPercent(10_000), "100");
    assert.equal(burnPercent(1), "0.01");
  });

  it("prints the pass fact from the chain's values only", () => {
    const read = decodePass(PASS, {
      price: u256(1000n * WAD),
      burnBps: u16(2500),
      period: u64(2_592_000n),
      house: address(HOUSE_WALLET),
    })!;
    assert.equal(passFact(read), "1,000 $VEIL · 30 days · 25% burns");
  });
});

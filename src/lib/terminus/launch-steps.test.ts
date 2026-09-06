import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { houseFrom } from "./house.ts";
import { launchSteps, verifyRows } from "./launch-steps.ts";

const ADDR = "0x1111111111111111111111111111111111111111" as const;
const FEE = "0x2222222222222222222222222222222222222222" as const;
const PONS = "https://www.ponsfamily.com/launchpad/veil";
const PAIR = "https://app.uniswap.org/explore/pools/robinhood/0xpool";

/** The fixtures pin the Wire and the Pass to unpasted, whatever the constant holds today. */
const NO_CONTRACTS = { wire: { address: null, poster: null }, pass: { address: null } } as const;
const pre = houseFrom({
  address: null,
  feeWallet: null,
  supply: null,
  pairAsset: null,
  links: { pons: null, pair: null },
  ...NO_CONTRACTS,
});
const launched = houseFrom({
  address: ADDR,
  feeWallet: FEE,
  supply: "1000000000",
  pairAsset: "ETH",
  links: { pons: PONS, pair: null },
  ...NO_CONTRACTS,
});
const graduated = houseFrom({ ...launched, links: { pons: PONS, pair: PAIR } });

describe("launchSteps", () => {
  it("names the four steps in order with the spec's lines", () => {
    assert.deepEqual(
      launchSteps(pre).map((s) => [s.n, s.name]),
      [
        [1, "Create"],
        [2, "Curve"],
        [3, "Graduation"],
        [4, "Pool"],
      ],
    );
    assert.equal(
      launchSteps(pre)[3]?.line,
      "A Uniswap v4 pool, liquidity locked. No unlock exists.",
    );
  });

  it("reads next / at launch / after launch / at graduation before launch", () => {
    assert.deepEqual(
      launchSteps(pre).map((s) => s.status),
      ["next", "at launch", "after launch", "at graduation"],
    );
  });

  it("reads done / live / ahead / at graduation once the address is pasted", () => {
    assert.deepEqual(
      launchSteps(launched).map((s) => s.status),
      ["done", "live", "ahead", "at graduation"],
    );
  });

  it("reads done / done / done / live once the pool link is pasted", () => {
    assert.deepEqual(
      launchSteps(graduated).map((s) => s.status),
      ["done", "done", "done", "live"],
    );
  });
});

describe("verifyRows", () => {
  it("before launch every row carries a status and no link", () => {
    assert.deepEqual(
      verifyRows(pre).map((r) => [r.k, r.status, r.href]),
      [
        ["Contract", "at launch", null],
        ["Curve", "at launch", null],
        ["Pool", "at graduation", null],
        ["Fee wallet", "at launch", null],
        ["Wire", "next", null],
        ["Pass", "with the Key", null],
      ],
    );
  });

  it("after the creation paste the contract, curve and fee wallet link and the pool waits", () => {
    const rows = verifyRows(launched);
    assert.deepEqual(
      rows.map((r) => [r.k, r.status, r.label]),
      [
        ["Contract", null, "Explorer ↗"],
        ["Curve", null, "pons ↗"],
        ["Pool", "at graduation", "Uniswap v4 ↗"],
        ["Fee wallet", null, "Explorer ↗"],
        ["Wire", "next", "Explorer ↗"],
        ["Pass", "with the Key", "Explorer ↗"],
      ],
    );
    assert.equal(rows[0]?.href, `https://robinhoodchain.blockscout.com/token/${ADDR}`);
    assert.equal(rows[0]?.address, ADDR);
    assert.equal(rows[1]?.href, PONS);
    assert.equal(rows[3]?.href, `https://robinhoodchain.blockscout.com/address/${FEE}`);
    assert.equal(rows[3]?.address, FEE);
  });

  it("after graduation the pool links too", () => {
    const pool = verifyRows(graduated)[2];
    assert.equal(pool?.status, null);
    assert.equal(pool?.href, PAIR);
  });
});

describe("verifyRows · Wire and Pass", () => {
  const WIRE = "0x3333333333333333333333333333333333333333" as const;
  const POSTER = "0x4444444444444444444444444444444444444444" as const;
  const PASS = "0x5555555555555555555555555555555555555555" as const;

  it("lists Contract · Curve · Pool · Fee wallet · Wire · Pass", () => {
    assert.deepEqual(
      verifyRows(pre).map((r) => r.k),
      ["Contract", "Curve", "Pool", "Fee wallet", "Wire", "Pass"],
    );
  });

  it("reads next and with the Key before either contract is pasted", () => {
    const rows = verifyRows(pre);
    assert.equal(rows[4]?.status, "next");
    assert.equal(rows[4]?.href, null);
    assert.equal(rows[5]?.status, "with the Key");
    assert.equal(rows[5]?.href, null);
  });

  it("links the Wire once both Wire facts are pasted, independent of the launch", () => {
    const rows = verifyRows(houseFrom({ ...pre, wire: { address: WIRE, poster: POSTER } }));
    assert.equal(rows[4]?.status, null);
    assert.equal(rows[4]?.href, `https://robinhoodchain.blockscout.com/address/${WIRE}`);
    assert.equal(rows[4]?.address, WIRE);
    assert.equal(rows[0]?.status, "at launch");
  });

  it("links the Pass once pasted and never prints with the Key then", () => {
    const rows = verifyRows(houseFrom({ ...launched, pass: { address: PASS } }));
    assert.equal(rows[5]?.status, null);
    assert.equal(rows[5]?.href, `https://robinhoodchain.blockscout.com/address/${PASS}`);
    assert.equal(rows[5]?.address, PASS);
    assert.ok(!rows.some((r) => r.status === "with the Key"));
  });
});

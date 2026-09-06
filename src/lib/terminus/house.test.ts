import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HOUSE,
  PHASES,
  PHASE_STATUSES,
  feeWalletExplorerUrl,
  houseCaLine,
  houseFrom,
  houseLaunched,
  houseLinks,
  houseStamp,
  houseSupply,
  launchpadTermsUrl,
  passExplorerUrl,
  tokenExplorerUrl,
  wireExplorerUrl,
  wireFacts,
  wireLive,
} from "./house.ts";

const ADDR = "0x1111111111111111111111111111111111111111" as const;
const FEE = "0x2222222222222222222222222222222222222222" as const;
const PONS = "https://www.ponsfamily.com/launchpad/veil";
const PAIR = "https://app.uniswap.org/explore/pools/robinhood/0xpool";
const HEX40 = /^0x[0-9a-fA-F]{40}$/;
const WIRE = "0x3333333333333333333333333333333333333333" as const;
const POSTER = "0x4444444444444444444444444444444444444444" as const;
const PASS = "0x5555555555555555555555555555555555555555" as const;

describe("house facts", () => {
  it("reads as not launched while the address is null", () => {
    const unlaunched = houseFrom({
      address: null,
      feeWallet: null,
      links: { pons: null, pair: null },
    });
    assert.equal(houseLaunched(unlaunched), false);
    assert.equal(houseStamp(unlaunched), "Not launched");
    assert.equal(houseCaLine(unlaunched), "—");
    assert.equal(tokenExplorerUrl(unlaunched), null);
    assert.equal(feeWalletExplorerUrl(unlaunched), null);
    assert.deepEqual(
      houseLinks(unlaunched).map((l) => l.label),
      ["X"],
    );
  });

  it("the constant reports whatever address is pasted", () => {
    assert.equal(houseLaunched(), Boolean(HOUSE.address));
    assert.equal(houseStamp(), HOUSE.address ? "Live" : "Not launched");
  });

  it("flips to live when an address is pasted", () => {
    const h = houseFrom({ address: ADDR });
    assert.equal(houseLaunched(h), true);
    assert.equal(houseStamp(h), "Live");
    assert.equal(houseCaLine(h), ADDR);
    assert.equal(tokenExplorerUrl(h), `https://robinhoodchain.blockscout.com/token/${ADDR}`);
  });

  it("lists only the links that exist, in a fixed order", () => {
    const h = houseFrom({
      address: ADDR,
      feeWallet: FEE,
      links: { pons: PONS, pair: PAIR },
    });
    assert.deepEqual(
      houseLinks(h).map((l) => l.label),
      ["pons", "Pool", "Token on explorer", "Fee wallet", "X"],
    );
    assert.equal(feeWalletExplorerUrl(h), `https://robinhoodchain.blockscout.com/address/${FEE}`);
  });

  it("keeps the X link when only some links are overridden", () => {
    const h = houseFrom({ links: { pons: PONS } });
    assert.equal(h.links.x, HOUSE.links.x);
    assert.equal(h.links.pons, PONS);
  });

  it("has no chat-app link beyond X, in the shape or in the list (decision 3: X only)", () => {
    assert.deepEqual(Object.keys(HOUSE.links).sort(), ["pair", "pons", "x"]);
    const all = houseLinks(
      houseFrom({ address: ADDR, feeWallet: FEE, links: { pons: PONS, pair: PAIR } }),
    );
    for (const l of all) assert.doesNotMatch(`${l.label} ${l.href}`, /t[e]legram|t\.me/i);
  });
});

describe("wire and pass facts", () => {
  it("the Wire is not live while either fact is null", () => {
    assert.equal(wireLive(houseFrom({ wire: { address: null, poster: null } })), false);
    assert.equal(wireLive(houseFrom({ wire: { address: WIRE, poster: null } })), false);
    assert.equal(wireLive(houseFrom({ wire: { address: null, poster: POSTER } })), false);
    assert.equal(wireFacts(houseFrom({ wire: { address: WIRE, poster: null } })), null);
    assert.equal(wireExplorerUrl(houseFrom({ wire: { address: null, poster: null } })), null);
  });

  it("is live with both, and names the contract and the poster", () => {
    const h = houseFrom({ wire: { address: WIRE, poster: POSTER } });
    assert.equal(wireLive(h), true);
    assert.deepEqual(wireFacts(h), { address: WIRE, poster: POSTER });
    assert.equal(wireExplorerUrl(h), `https://robinhoodchain.blockscout.com/address/${WIRE}`);
  });

  it("houseFrom keeps the other wire and pass facts when one is overridden", () => {
    const h = houseFrom({ wire: { poster: POSTER }, pass: { address: PASS } });
    assert.equal(h.wire.address, HOUSE.wire.address);
    assert.equal(h.wire.poster, POSTER);
    assert.equal(h.pass.address, PASS);
    assert.equal(passExplorerUrl(h), `https://robinhoodchain.blockscout.com/address/${PASS}`);
    assert.equal(passExplorerUrl(houseFrom({ pass: { address: null } })), null);
  });

  it("the Wire is independent of the launch", () => {
    const h = houseFrom({ address: null, wire: { address: WIRE, poster: POSTER } });
    assert.equal(houseLaunched(h), false);
    assert.equal(wireLive(h), true);
  });
});

/**
 * Readiness item 9. These run against the real constant, so they pass while
 * every field is null and fire the moment the owner pastes a bad value.
 */
describe("pasted facts", () => {
  it("address and feeWallet, when set, are 40-hex addresses and differ", () => {
    if (HOUSE.address !== null) assert.match(HOUSE.address, HEX40, "address");
    if (HOUSE.feeWallet !== null) assert.match(HOUSE.feeWallet, HEX40, "feeWallet");
    if (HOUSE.address !== null && HOUSE.feeWallet !== null) {
      assert.notEqual(
        HOUSE.address.toLowerCase(),
        HOUSE.feeWallet.toLowerCase(),
        "address and feeWallet must be different contracts",
      );
    }
  });

  it("links.pons, when set, is a page on ponsfamily.com", () => {
    if (HOUSE.links.pons !== null) {
      assert.match(HOUSE.links.pons, /^https:\/\/(www\.)?ponsfamily\.com\//, "links.pons");
    }
  });

  it("links.pair, when set, is an https URL", () => {
    const pair = HOUSE.links.pair;
    if (pair !== null) {
      assert.match(pair, /^https:\/\//, "links.pair");
      assert.doesNotThrow(() => new URL(pair));
    }
  });

  it("links.pair is pasted only after the creation facts (graduation follows creation)", () => {
    if (HOUSE.links.pair !== null)
      assert.equal(houseLaunched(), true, "pair set without an address");
  });

  it("supply, when set, is whole tokens as digits only", () => {
    if (HOUSE.supply !== null) assert.match(HOUSE.supply, /^[1-9]\d*$/, "supply");
  });

  it("pairAsset, when set, is a symbol as pons shows it", () => {
    if (HOUSE.pairAsset !== null) assert.match(HOUSE.pairAsset, /^[A-Z0-9.-]{1,12}$/, "pairAsset");
  });

  it("the five creation facts are pasted together or not at all (runbook step 1)", () => {
    const set = [
      HOUSE.address,
      HOUSE.links.pons,
      HOUSE.feeWallet,
      HOUSE.supply,
      HOUSE.pairAsset,
    ].filter((v) => v !== null).length;
    assert.ok(
      set === 0 || set === 5,
      `creation facts pasted: ${set} of 5; never deploy with one missing`,
    );
  });

  it("the two Wire facts are pasted together or not at all (README, The Wire, step 4)", () => {
    const set = [HOUSE.wire.address, HOUSE.wire.poster].filter((v) => v !== null).length;
    assert.ok(
      set === 0 || set === 2,
      `wire facts pasted: ${set} of 2; never deploy with one missing`,
    );
    if (HOUSE.wire.address !== null) assert.match(HOUSE.wire.address, HEX40, "wire.address");
    if (HOUSE.wire.poster !== null) assert.match(HOUSE.wire.poster, HEX40, "wire.poster");
    if (HOUSE.wire.address !== null && HOUSE.wire.poster !== null) {
      assert.notEqual(HOUSE.wire.address.toLowerCase(), HOUSE.wire.poster.toLowerCase());
    }
  });

  it("pass.address, when set, is a 40-hex address and neither the token nor the Wire", () => {
    if (HOUSE.pass.address !== null) {
      assert.match(HOUSE.pass.address, HEX40, "pass.address");
      assert.notEqual(HOUSE.pass.address.toLowerCase(), HOUSE.address?.toLowerCase());
      assert.notEqual(HOUSE.pass.address.toLowerCase(), HOUSE.wire.address?.toLowerCase());
    }
  });

  it("the pons Terms of Use link is on the launchpad origin", () => {
    assert.equal(launchpadTermsUrl(), "https://www.ponsfamily.com/terms");
    assert.equal(launchpadTermsUrl(houseFrom({})), `${HOUSE.launchpad.url}/terms`);
  });
});

describe("launched shape", () => {
  it("with the creation facts and the pool link: Live, full CA, pons · Pool · Token on explorer · Fee wallet · X", () => {
    const h = houseFrom({ address: ADDR, feeWallet: FEE, links: { pons: PONS, pair: PAIR } });
    assert.equal(houseLaunched(h), true);
    assert.equal(houseStamp(h), "Live");
    assert.equal(houseCaLine(h), ADDR);
    assert.match(h.address ?? "", HEX40);
    assert.match(h.feeWallet ?? "", HEX40);
    assert.deepEqual(houseLinks(h), [
      { label: "pons", href: PONS },
      { label: "Pool", href: PAIR },
      { label: "Token on explorer", href: `https://robinhoodchain.blockscout.com/token/${ADDR}` },
      { label: "Fee wallet", href: `https://robinhoodchain.blockscout.com/address/${FEE}` },
      { label: "X", href: "https://x.com/terminus_veil" },
    ]);
  });

  it("before graduation the Pool link is absent and the rest keep their order", () => {
    const h = houseFrom({ address: ADDR, feeWallet: FEE, links: { pons: PONS, pair: null } });
    assert.deepEqual(
      houseLinks(h).map((l) => l.label),
      ["pons", "Token on explorer", "Fee wallet", "X"],
    );
  });
});

describe("launchpad", () => {
  it("is pons v2, lowercase, with the app and docs links and a check date", () => {
    assert.deepEqual(Object.keys(HOUSE.launchpad).sort(), [
      "checkedOn",
      "docs",
      "name",
      "url",
      "version",
    ]);
    assert.equal(HOUSE.launchpad.name, "pons");
    assert.equal(HOUSE.launchpad.name, HOUSE.launchpad.name.toLowerCase());
    assert.equal(HOUSE.launchpad.version, "v2");
    assert.equal(HOUSE.launchpad.url, "https://www.ponsfamily.com");
    assert.equal(HOUSE.launchpad.docs, "https://docs.ponsfamily.com");
    assert.match(HOUSE.launchpad.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("carries no figures: supply, fee split, quote asset and creator tax are pons's, read on the token page", () => {
    for (const key of ["supply", "creatorFeeShare", "quote", "creatorTaxPercent"]) {
      assert.equal(key in HOUSE.launchpad, false, `launchpad.${key} must not exist`);
    }
  });
});

describe("phases", () => {
  it("ascend from 0 and every status is a known word", () => {
    assert.deepEqual(
      PHASES.map((p) => p.n),
      ["0", "1", "2", "3"],
    );
    for (const p of PHASES) {
      assert.ok(PHASE_STATUSES.includes(p.status), `${p.name}: ${p.status}`);
      assert.ok(p.what.length > 0, `${p.name} has no facts`);
      assert.ok(p.who.length > 0, `${p.name} has no audience`);
    }
    assert.equal(PHASES[0]?.status, "live");
  });

  it("never carries a date", () => {
    for (const p of PHASES) {
      for (const line of [p.name, p.who, ...p.what]) {
        assert.doesNotMatch(
          line,
          /\b20\d\d\b|\bQ[1-4]\b|\b(January|February|March|April|June|July|August|September|October|November|December)\b|\bMay \d/,
        );
      }
    }
  });

  it("never names the chat app the house does not run (decision 3: X only)", () => {
    for (const p of PHASES) {
      for (const line of [p.name, p.who, ...p.what]) {
        assert.doesNotMatch(line, /t[e]legram/i, `${p.name}: ${line}`);
      }
    }
  });

  it("are Desk, Wire, Key, Matcher; the Wire is live only once its facts are pasted", () => {
    assert.deepEqual(
      PHASES.map((p) => p.name),
      ["Desk", "Wire", "Key", "Matcher"],
    );
    assert.equal(PHASES[0]?.status, "live");
    assert.equal(PHASES[1]?.status, wireLive() ? "live" : "next");
    assert.equal(PHASES[2]?.status, "next");
    assert.equal(PHASES[3]?.status, "vision");
    assert.ok(PHASES[2]?.what.some((w) => w.includes("pass paid in $VEIL")));
    assert.ok(!PHASES.some((p) => p.name === "Seal" || p.what.some((w) => /seal/i.test(w))));
  });
});

describe("houseSupply", () => {
  it("groups the pasted digits for the spec sheet and is null until pasted", () => {
    assert.equal(houseSupply(houseFrom({ supply: "1000000000" })), "1,000,000,000");
    assert.equal(houseSupply(houseFrom({ supply: "999" })), "999");
    assert.equal(houseSupply(houseFrom({ supply: null })), null);
    if (HOUSE.supply === null) assert.equal(houseSupply(), null);
  });
});

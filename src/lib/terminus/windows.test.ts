import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DELTA_MAX_BLOCKS,
  INITIALIZE_TOPIC,
  LAUNCH_LIST_CAP,
  PONS_MEME_HOOK,
  TOKEN_LAUNCHED_TOPIC,
  classifyHook,
  decodeInitialize,
  decodeTokenLaunched,
  deltaRange,
  emptyEntry,
  launchesToShow,
  mergeEntries,
  sortLaunches,
  windowsFor,
  windowsHeadLine,
  type PonsLaunch,
  type WindowsIndex,
} from "./windows.ts";

const NVDA = "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC" as const;
const TOKEN = "0xA3589dF474ce7a5DF99109DFeA51E23FeeC20085" as const;
const pad = (addr: string) => "0x" + addr.slice(2).toLowerCase().padStart(64, "0");
const word = (addr: string) => addr.slice(2).toLowerCase().padStart(64, "0");
const launch = (token: string, phase: PonsLaunch["phase"], block: number): PonsLaunch => ({
  token: token as `0x${string}`,
  symbol: null,
  phase,
  block,
});

describe("windows decoders", () => {
  it("classifies a pool by its hook", () => {
    assert.equal(classifyHook(PONS_MEME_HOOK), "pons");
    assert.equal(classifyHook(PONS_MEME_HOOK.toLowerCase()), "pons");
    assert.equal(classifyHook("0x0000000000000000000000000000000000000000"), "plain");
    assert.equal(classifyHook("0x4e3468951d49f2eea976ed0d6e75ffcb44a9a544"), "other");
  });

  it("decodes TokenLaunched: token from topic1, pairToken from the first data word", () => {
    const log = {
      topics: [
        TOKEN_LAUNCHED_TOPIC,
        pad(TOKEN),
        pad("0x" + "1".repeat(40)),
        pad("0x" + "2".repeat(40)),
      ],
      data: "0x" + word(NVDA) + "0".repeat(64) + 8090000000n.toString(16).padStart(64, "0"),
      blockNumber: "0x34c9a3d",
    };
    assert.deepEqual(decodeTokenLaunched(log), {
      token: TOKEN.toLowerCase(),
      pairToken: NVDA.toLowerCase(),
      block: 0x34c9a3d,
    });
    assert.equal(decodeTokenLaunched({ ...log, topics: [INITIALIZE_TOPIC] }), null);
    assert.equal(decodeTokenLaunched({ ...log, data: "0x12" }), null);
  });

  it("decodes Initialize: currencies from topics, hooks from the third data word", () => {
    const data =
      "0x" +
      "0".repeat(64) +
      60n.toString(16).padStart(64, "0") +
      word(PONS_MEME_HOOK) +
      "0".repeat(128);
    const log = {
      topics: [INITIALIZE_TOPIC, "0x" + "ab".repeat(32), pad("0x" + "3".repeat(40)), pad(NVDA)],
      data,
      blockNumber: "0x10",
    };
    assert.deepEqual(decodeInitialize(log), {
      currency0: "0x" + "3".repeat(40),
      currency1: NVDA.toLowerCase(),
      hooks: PONS_MEME_HOOK.toLowerCase(),
      block: 16,
    });
    assert.equal(decodeInitialize({ ...log, topics: [TOKEN_LAUNCHED_TOPIC] }), null);
  });
});

describe("deltaRange", () => {
  it("is null with an empty index, an absent tape, or nothing new", () => {
    assert.equal(deltaRange(0, 100), null);
    assert.equal(deltaRange(100, null), null);
    assert.equal(deltaRange(100, 100), null);
    assert.equal(deltaRange(100, 90), null);
  });

  it("starts after the index and is bounded", () => {
    assert.deepEqual(deltaRange(100, 150), { fromBlock: 101, toBlock: 150 });
    assert.deepEqual(deltaRange(100, 10_000_000), {
      fromBlock: 101,
      toBlock: 100 + DELTA_MAX_BLOCKS,
    });
  });
});

describe("launch order and merge", () => {
  it("sorts pool first, then swept, curve, rescued, unread; newest block first inside a phase", () => {
    const list = [
      launch("0x1", 0, 5),
      launch("0x2", 2, 1),
      launch("0x3", 2, 9),
      launch("0x4", 1, 3),
      launch("0x5", 3, 8),
      launch("0x6", null, 7),
    ];
    assert.deepEqual(
      sortLaunches(list).map((l) => l.token),
      ["0x3", "0x2", "0x4", "0x1", "0x5", "0x6"],
    );
  });

  it("merges a delta: launches deduplicated by token, counts summed, capped flag or-ed", () => {
    const base = {
      ...emptyEntry(),
      pons: [launch("0xa", 2, 1)],
      ponsTotal: 1,
      v4: { pons: 1, plain: 2, other: 3 },
    };
    const delta = {
      ...emptyEntry(),
      pons: [launch("0xa", 2, 1), launch("0xb", 0, 2)],
      ponsTotal: 2,
      v4: { pons: 1, plain: 0, other: 1 },
      capped: true,
    };
    const merged = mergeEntries(base, delta);
    assert.deepEqual(
      merged.pons.map((l) => l.token),
      ["0xa", "0xb"],
    );
    assert.equal(merged.ponsTotal, 3);
    assert.deepEqual(merged.v4, { pons: 2, plain: 2, other: 4 });
    assert.equal(merged.capped, true);
    assert.deepEqual(mergeEntries(base, undefined), base);
  });

  it("windowsFor reads the index alone or the index plus delta, and names the source", () => {
    const index: WindowsIndex = {
      readAt: "2026-09-06T10:00:00.000Z",
      toBlock: 100,
      byAddress: {
        [NVDA.toLowerCase()]: {
          ...emptyEntry(),
          ponsTotal: 9,
          v4: { pons: 9, plain: 42, other: 949 },
        },
      },
    };
    const alone = windowsFor(NVDA, index, null);
    assert.equal(alone.source, "index");
    assert.equal(alone.toBlock, 100);
    assert.equal(alone.ponsTotal, 9);
    const withDelta = windowsFor(NVDA, index, {
      fromBlock: 101,
      toBlock: 150,
      byAddress: { [NVDA.toLowerCase()]: { ...emptyEntry(), v4: { pons: 1, plain: 0, other: 0 } } },
    });
    assert.equal(withDelta.source, "index+delta");
    assert.equal(withDelta.toBlock, 150);
    assert.equal(withDelta.v4.pons, 10);
    const unknown = windowsFor(("0x" + "9".repeat(40)) as `0x${string}`, index, null);
    assert.equal(unknown.ponsTotal, 0);
    assert.equal(unknown.v4.plain, 0);

    // Readiness wave: rows ship to the client on every page, so an index entry
    // holding more than LAUNCH_LIST_CAP launches must still print only the cap,
    // while ponsTotal keeps counting every one of them.
    const heavy = "0x" + "7".repeat(40);
    const pons = Array.from({ length: 30 }, (_, i) => launch(`0x${i}`, 2, i));
    const capped = windowsFor(
      heavy as `0x${string}`,
      {
        readAt: index.readAt,
        toBlock: index.toBlock,
        byAddress: { [heavy]: { ...emptyEntry(), pons, ponsTotal: 30 } },
      },
      null,
    );
    assert.equal(capped.pons.length, LAUNCH_LIST_CAP);
    assert.equal(capped.ponsTotal, 30);
  });
});

describe("windows copy", () => {
  it("head line: both sides, singular, a zero side omitted, capped counts with a plus", () => {
    assert.equal(
      windowsHeadLine("NVDA", {
        ponsTotal: 9,
        v4: { pons: 9, plain: 42, other: 949 },
        capped: false,
      }),
      "9 pons launches with NVDA as the pair asset · 1,000 Uniswap v4 pools hold it",
    );
    assert.equal(
      windowsHeadLine("NVDA", {
        ponsTotal: 9,
        v4: { pons: 9, plain: 42, other: 949 },
        capped: true,
      }),
      "9+ pons launches with NVDA as the pair asset · 1,000+ Uniswap v4 pools hold it",
    );
    assert.equal(
      windowsHeadLine("JNJ", { ponsTotal: 1, v4: { pons: 0, plain: 0, other: 0 }, capped: true }),
      "1+ pons launches with JNJ as the pair asset",
    );
    assert.equal(
      windowsHeadLine("JNJ", { ponsTotal: 1, v4: { pons: 0, plain: 0, other: 0 }, capped: false }),
      "1 pons launch with JNJ as the pair asset",
    );
    assert.equal(
      windowsHeadLine("JNJ", { ponsTotal: 0, v4: { pons: 0, plain: 1, other: 0 }, capped: false }),
      "1 Uniswap v4 pool holds JNJ",
    );
    assert.equal(
      windowsHeadLine("JNJ", { ponsTotal: 0, v4: { pons: 0, plain: 0, other: 0 }, capped: false }),
      "No pool holds JNJ in the index.",
    );
  });

  it("shows at most LAUNCH_LIST_CAP launches and counts the rest against ponsTotal", () => {
    const pons = Array.from({ length: 30 }, (_, i) => launch(`0x${i}`, 2, i));
    const { list, more } = launchesToShow({ ...emptyEntry(), pons, ponsTotal: 40 });
    assert.equal(list.length, LAUNCH_LIST_CAP);
    assert.equal(more, 40 - LAUNCH_LIST_CAP);
    assert.deepEqual(launchesToShow({ ...emptyEntry(), pons: pons.slice(0, 3), ponsTotal: 3 }), {
      list: sortLaunches(pons.slice(0, 3)),
      more: 0,
    });
  });
});

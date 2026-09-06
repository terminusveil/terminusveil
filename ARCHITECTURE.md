# How the desk works

One page on what the site reads, how it decides what to show, and what it writes back to the chain. Everything here is checkable against the code in `src/lib/terminus/` and against the chain.

## 1. The problem it reads

Robinhood's stock tokens on Robinhood Chain carry a multiplier. A stock split or a reinvested dividend does not change your token balance; it rewrites the multiplier the balance is read through. The change is staged on the contract first (`newUIMultiplier`, with an `effectiveAt` time) and becomes live at that moment, which the desk calls **terminus**. On a large move the price feed pauses (`oraclePaused`) until the issuer confirms. A cash dividend does not touch the multiplier; it prints in dollars.

Reading the staged figure as the live one, or the other way round, is the mistake the desk exists to prevent.

## 2. Sources

Every refresh gathers, in this order:

| Source | What | Where in code |
|---|---|---|
| Tape | `eth_chainId` and `eth_blockNumber`, the proof the chain answered | `relay-live.ts` `readTapeRaw`, memoised by `createTapeReader` |
| Issuer feed | Robinhood's public corporate-actions and assets feeds: the names, their contract addresses, pending actions with process dates, the issuer's own multiplier figures | `rhj.ts` |
| Contract reads | For every asset, the four reads `uiMultiplier`, `newUIMultiplier`, `effectiveAt`, `oraclePaused`, plus `paused` for the transfer pause: five `eth_call`s. All of them ride Multicall3 `aggregate3`, 250 sub-calls per call, so a full desk is a handful of requests | `relay-live.ts` `readMultipliers`, `multicall.ts` |
| Last move | The latest `UIMultiplierUpdated` log per contract, for due names only, inside a bounded block window | `relay-live.ts` `readLastMoves`, `last-move.ts` |
| Wire | The house poster's latest post per name, the post count and the poster's balance | `relay-live.ts` `readWire`, `readWireStatus` |
| Windows | A committed index of pons launches and Uniswap v4 pools per name, plus a bounded live delta past the index | `windows.ts`, `windows-read.ts`, `data/windows/index.json` |
| Pass | Four reads from `VeilPass` once it is pasted; null until then | `pass.ts` |

Calls go to the RPC named by `TERMINUS_RPC_URL` (the public RPC when unset). `eth_getLogs` goes to `TERMINUS_LOGS_RPC_URL` (the public RPC when unset), because hosted free tiers cap a log query's block range and would silently return nothing.

## 3. Live or snapshot, never mixed

The desk is built from live sources only when the tape and the issuer feed both answer. Otherwise the whole desk is built from the committed snapshot under `data/snapshot/`, with the clock frozen at the snapshot's read time, and every page says so with the read time and block. A live desk whose contract reads all failed is treated the same way. Live and snapshot never mix inside one payload.

The built desk is cached for 45 seconds and served stale for up to 180 seconds while a refresh runs. The edge caches public responses for 30 seconds and serves stale for 120 seconds while revalidating, so two requests a moment apart can show blocks a few hundred apart. `/api/health` is never cached.

## 4. What a plate says

Each name resolves to one state (`multiplier.ts` `resolveState`):

| State | Rule |
|---|---|
| `absent` | no contract read and no live figure and no pending action |
| `paused` | `oraclePaused()` read true |
| `veiled` | a staged figure differs from the live one, or an action is pending, and terminus is ahead (or unknown) |
| `due` | terminus has passed and the issuer still lists the action, or a staged figure is still there past its `effectiveAt` |
| `open` | nothing staged, nothing pending |

Terminus is taken in this order: the issuer's `pendingMultiplierEffectiveTime`; else the contract's `effectiveAt` when it is in the future; else the issuer's `processDate` at 09:30 America/New_York, the cash-session open. The third is an assumption and the plate marks it `assumed`. The desk never guesses a figure.

## 5. The Wire

`TerminusWire` is a permissionless contract: anyone may `post` or `postMany` (up to 64 per transaction), and anyone may read `latest(poster, ticker)` and `count(poster)`. The desk posts, for every name it reads, the contract's own figure and terminus, `newUIMultiplier` (the live figure when nothing is staged) and `effectiveAt` (0 when unset), never the issuer's figure and never an assumed time. It posts only when the contract's figure changed since its last post.

Posting runs from inside the desk's own refresh, at most once per 30 minutes per instance, and a daily platform cron is the floor beneath it. The poster key lives only in the host's environment. The plate line reads `not read` when the Wire read did not run, `not posted yet` when it ran and the poster has nothing for that name, and otherwise the posted figure with its time and whether it still `matches the contract`.

## 6. Windows

A crawl (`scripts/windows.mjs`) reads the pons Factory's `TokenLaunched` events, keeping the launches whose pair asset is one of the stock tokens, and the Uniswap v4 PoolManager's `Initialize` events, bucketed by the currencies each pool holds and classed by hook. The index keeps the newest 60 launches per name and the counts; the page lists 24. A live refresh reads a bounded stretch of blocks past the index, never the whole gap, so the caption's block is the edge of what is listed. Counts, names and links only: no prices, no liquidity, no swap links.

## 7. Public reads

| Route | Answer |
|---|---|
| `/api/health` | the build, the chain block and read time, the source, counts, the Wire's address and count |
| `/api/pending` | every pending name as a row |
| `/api/ticker/{ticker}` | one row, with `wire`, `wireRead`, `windows`, `transferPaused` |
| `/api/desk` | the whole desk payload the pages render from |
| `/api/tape` | the chain id and block |
| `/api/calendar` | the pending actions as ICS |
| `/api/openapi.json` | the schema of all of the above |

`/api/wire/post` is the poster job and answers only with a key.

## 8. Words

Status words are `live`, `next`, `planned`, `vision`; live means you can open it now. The site prints no number the chain, the issuer or the launchpad does not print. The paid layer is described as a mechanism, never as a promise.

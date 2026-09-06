# Terminus Veil contracts

The on-chain pieces of the desk, kept apart from the site so the site's build and tests stay light. No owner, no pause, no upgrade path in either contract. Unaudited: read the source before you call it; both are short on purpose.

## TerminusWire (phase 1)

The desk's reads, posted on Robinhood Chain: for a ticker, the staged multiplier and the terminus as the token contract held them at the time of the post. Anyone may post. A reader trusts a poster address, not the contract; the site names the house's poster.

```
post(bytes32 ticker, uint256 staged, uint64 terminus)                  emits Posted(by, ticker, staged, terminus, postedAt)
postMany(bytes32[] tickers, uint256[] staged, uint64[] terminus)       up to MAX_BATCH (64), all or nothing
latest(address by, bytes32 ticker) → Post { staged, terminus, postedAt }
count(address by) → uint256
```

`staged` is the token contract's `newUIMultiplier()` (18 decimals, 1e18 = 1×); `terminus` its `effectiveAt()`, 0 when unset. Assumed times are never posted.

## VeilPass (phase 2)

A 30-day pass to the Key, paid in $VEIL. A fixed share of every pass burns to `0x…dEaD`; the rest goes to the house wallet. Nothing rests in the contract. `priceSetter` can change the price and hand the role on, nothing else; `burnBps`, `house` and `veil` are fixed at deploy. A pass is access, not a share.

```
buy()                                  pulls price from you: burn share → DEAD, rest → house; extends your pass by PERIOD from max(now, activeUntil)
buy(uint256 maxPrice)                  same, and reverts when price is above maxPrice
buyFor(address wallet)                 same, you pay, wallet is credited
buyFor(address wallet, uint256 max)    same, guarded
activeUntil(address) → uint64      isActive(address) → bool
price() burnBps() PERIOD() house() veil() priceSetter()
setPrice(uint256) handPriceSetter(address)          priceSetter only
```

A purchase interface must send the `maxPrice` form. `price` is mutable, so between the figure a buyer is shown and the transaction landing the setter can raise it; the guarded call fails instead of spending the difference.

Deployed only when the Key ships, from the owner's wallet, after `$VEIL` exists:

```bash
PRIVATE_KEY=0x… CONTRACT=VeilPass VEIL=0x… HOUSE_WALLET=0x… BURN_BPS=… PRICE_WEI=… PRICE_SETTER=0x… npm run deploy:robinhood
npm run verify:robinhood -- <address> <VEIL> <HOUSE_WALLET> <BURN_BPS> <PRICE_WEI> <PRICE_SETTER>
```

Then paste `pass.address` into `src/lib/terminus/house.ts`. The site prints price, period and burn share from the chain.

Before that deploy, confirm on the explorer that `$VEIL` takes no fee on transfer. The contract emits `Bought.burned` as the figure it sent, and a fee-on-transfer token would deliver less than that to `DEAD`: the event, and anything reading it, would overstate the burn. pons v2 tokens are plain ERC-20s, so this is a check, not an expectation.

The buys are `nonReentrant` (OpenZeppelin `ReentrancyGuard`): a buy hands control to the token twice and a token that called back could otherwise open two periods for one price.

## Work on it

```bash
cd contracts
npm install
npm test            # hardhat's local network
npm run compile
```

## Deploy to Robinhood Chain (owner only)

The deployer key comes from the environment and is never written to disk. Gas is paid in ETH on Robinhood Chain (id 4663).

```bash
PRIVATE_KEY=0x… npm run deploy:robinhood                 # TerminusWire
npm run verify:robinhood -- <address>
```

`wire.address` (the contract) and `wire.poster` (the wallet whose key is `WIRE_POSTER_KEY` in the host's environment; ARCHITECTURE.md, section 5) are pasted together into `src/lib/terminus/house.ts`. Both are pasted today. A new poster is a paste of the second fact.

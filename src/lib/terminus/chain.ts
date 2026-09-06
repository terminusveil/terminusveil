export const CHAIN_ID = 4663;
export const CHAIN_NAME = "Robinhood Chain";
export const RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
export const EXPLORER_URL = "https://robinhoodchain.blockscout.com";
export const RHJ_API = "https://api.robinhood.com/rhj";

export const SELECTORS = {
  uiMultiplier: "0xa60bf13d",
  newUIMultiplier: "0xdc767007",
  effectiveAt: "0x97a4064f",
  oraclePaused: "0x7706ba52",
  transferPaused: "0x5c975abb", // paused(): Robinhood's transfer pause, per token or registry-wide
} as const;

/** Featured names for the plate chips. Addresses filled from RHJ when live. */
export const CHIP_TICKERS = ["AAPL", "NVDA", "TSLA", "SPY"] as const;

export const FEATURED_TICKERS = [
  "AAPL",
  "NVDA",
  "TSLA",
  "SPY",
  "GOOGL",
  "AMZN",
  "MSFT",
  "META",
  "COST",
  "AVGO",
] as const;

/** Fallback addresses if the RHJ API is absent. */
export const FALLBACK_ADDRESSES: Record<string, `0x${string}`> = {
  AAPL: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
  NVDA: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
  TSLA: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
  SPY: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C",
  GOOGL: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3",
  AMZN: "0x12f190a9F9d7D37a250758b26824B97CE941bF54",
  MSFT: "0xe93237C50D904957Cf27E7B1133b510C669c2e74",
  META: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35",
  COST: "0x4EA005168D7F09a7A0Ba9D1DEf21a479950E44C2",
  AVGO: "0x156E175DD063a8cE274C50654eF40e0032b3fbcF",
};

export function explorerAddress(address: string) {
  return `${EXPLORER_URL}/address/${address}`;
}

export function explorerBlock(block: number) {
  return `${EXPLORER_URL}/block/${block}`;
}

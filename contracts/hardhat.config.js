require("@nomicfoundation/hardhat-toolbox");

/**
 * Robinhood Chain (id 4663). The deployer key comes from the environment and
 * is never written to disk: `PRIVATE_KEY=0x… npx hardhat run scripts/deploy.js --network robinhood`.
 * Blockscout verification uses its Etherscan-compatible API; no key is needed,
 * the `apiKey` value is a placeholder Blockscout ignores.
 */
const RPC = process.env.ROBINHOOD_RPC ?? "https://rpc.mainnet.chain.robinhood.com";
const KEY = process.env.PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    robinhood: {
      url: RPC,
      chainId: 4663,
      accounts: KEY ? [KEY] : [],
    },
  },
  etherscan: {
    apiKey: { robinhood: "blockscout" },
    customChains: [
      {
        network: "robinhood",
        chainId: 4663,
        urls: {
          apiURL: "https://robinhoodchain.blockscout.com/api",
          browserURL: "https://robinhoodchain.blockscout.com",
        },
      },
    ],
  },
  sourcify: { enabled: false },
};

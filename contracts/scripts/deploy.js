const { ethers, network } = require("hardhat");

/**
 * Deploys one contract with the account behind PRIVATE_KEY and prints what to
 * paste and what to run next. Nothing else is touched.
 *
 *   PRIVATE_KEY=0x… npm run deploy:robinhood                        # TerminusWire (default)
 *   PRIVATE_KEY=0x… CONTRACT=VeilPass VEIL=0x… HOUSE_WALLET=0x… BURN_BPS=… PRICE_WEI=… PRICE_SETTER=0x… npm run deploy:robinhood
 *   npm run verify:robinhood -- <address> [constructor args…]
 */
const NAMES = ["TerminusWire", "VeilPass"];

function passArgs() {
  const env = process.env;
  const need = ["VEIL", "HOUSE_WALLET", "BURN_BPS", "PRICE_WEI", "PRICE_SETTER"];
  const missing = need.filter((k) => !env[k]);
  if (missing.length) throw new Error(`VeilPass needs ${missing.join(", ")}`);
  const bps = Number(env.BURN_BPS);
  if (!Number.isInteger(bps) || bps < 1 || bps > 10_000)
    throw new Error("BURN_BPS must be 1..10000");
  return [env.VEIL, env.HOUSE_WALLET, bps, BigInt(env.PRICE_WEI), env.PRICE_SETTER];
}

async function main() {
  const name = process.env.CONTRACT ?? "TerminusWire";
  if (!NAMES.includes(name)) throw new Error(`CONTRACT must be one of ${NAMES.join(", ")}`);
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("PRIVATE_KEY is not set; nothing deployed");
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(
    `network ${network.name} · deployer ${deployer.address} · balance ${ethers.formatEther(balance)} ETH`,
  );

  const args = name === "VeilPass" ? passArgs() : [];
  const Factory = await ethers.getContractFactory(name);
  const contract = await Factory.deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const receipt = await contract.deploymentTransaction().wait();

  console.log(`${name} ${address} · block ${receipt.blockNumber} · tx ${receipt.hash}`);
  console.log(
    `verify: npx hardhat verify --network robinhood ${address}${args.map((a) => ` ${a}`).join("")}`,
  );
  console.log(`explorer: https://robinhoodchain.blockscout.com/address/${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

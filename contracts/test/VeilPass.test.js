const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const ONE = 10n ** 18n;
const PRICE = 1_000n * ONE;
// A test constant only. The real share is the owner's call at deploy and prints from the chain.
const BURN_BPS = 2_500;
const DEAD = "0x000000000000000000000000000000000000dEaD";
const PERIOD = 30n * 24n * 60n * 60n;

describe("VeilPass", function () {
  async function deploy(over = {}) {
    const [deployer, house, setter, buyer, other] = await ethers.getSigners();
    const veil = await (await ethers.getContractFactory("MockVeil")).deploy();
    const Pass = await ethers.getContractFactory("VeilPass");
    const pass = await Pass.deploy(
      over.veil ?? (await veil.getAddress()),
      over.house ?? house.address,
      over.burnBps ?? BURN_BPS,
      over.price ?? PRICE,
      over.setter ?? setter.address,
    );
    await veil.transfer(buyer.address, 10_000n * ONE);
    await veil.connect(buyer).approve(await pass.getAddress(), 10_000n * ONE);
    return { veil, pass, deployer, house, setter, buyer, other };
  }

  it("fixes veil, house, burnBps and the period at deploy and starts at the given price", async function () {
    const { veil, pass, house, setter } = await deploy();
    expect(await pass.veil()).to.equal(await veil.getAddress());
    expect(await pass.house()).to.equal(house.address);
    expect(await pass.burnBps()).to.equal(BigInt(BURN_BPS));
    expect(await pass.PERIOD()).to.equal(PERIOD);
    expect(await pass.DEAD()).to.equal(DEAD);
    expect(await pass.price()).to.equal(PRICE);
    expect(await pass.priceSetter()).to.equal(setter.address);
  });

  it("buy moves exactly the burn share to the dead address and the rest to the house, and opens 30 days", async function () {
    const { veil, pass, house, buyer } = await deploy();
    const burned = (PRICE * BigInt(BURN_BPS)) / 10_000n;
    const rest = PRICE - burned;
    const tx = await pass.connect(buyer).buy();
    const at = BigInt(await time.latest());
    await expect(tx).to.emit(pass, "Bought").withArgs(buyer.address, buyer.address, PRICE, burned, at + PERIOD);
    expect(await veil.balanceOf(DEAD)).to.equal(burned);
    expect(await veil.balanceOf(house.address)).to.equal(rest);
    expect(await veil.balanceOf(await pass.getAddress())).to.equal(0n);
    expect(await pass.activeUntil(buyer.address)).to.equal(at + PERIOD);
    expect(await pass.isActive(buyer.address)).to.equal(true);
  });

  it("a second buy extends from the current activeUntil, not from now", async function () {
    const { pass, buyer } = await deploy();
    await pass.connect(buyer).buy();
    const first = await pass.activeUntil(buyer.address);
    await time.increase(1000);
    await pass.connect(buyer).buy();
    expect(await pass.activeUntil(buyer.address)).to.equal(first + PERIOD);
  });

  it("an expired pass extends from now", async function () {
    const { pass, buyer } = await deploy();
    await pass.connect(buyer).buy();
    await time.increase(Number(PERIOD) + 10);
    expect(await pass.isActive(buyer.address)).to.equal(false);
    await pass.connect(buyer).buy();
    const at = BigInt(await time.latest());
    expect(await pass.activeUntil(buyer.address)).to.equal(at + PERIOD);
  });

  it("buyFor credits the wallet and charges the payer", async function () {
    const { veil, pass, buyer, other } = await deploy();
    const before = await veil.balanceOf(buyer.address);
    await expect(pass.connect(buyer).buyFor(other.address)).to.emit(pass, "Bought");
    expect(await veil.balanceOf(buyer.address)).to.equal(before - PRICE);
    expect(await pass.isActive(other.address)).to.equal(true);
    expect(await pass.isActive(buyer.address)).to.equal(false);
    await expect(pass.connect(buyer).buyFor(ethers.ZeroAddress)).to.be.revertedWith("VeilPass: wallet");
  });

  it("isActive flips at the boundary", async function () {
    const { pass, buyer } = await deploy();
    await pass.connect(buyer).buy();
    const until = await pass.activeUntil(buyer.address);
    await time.increaseTo(until - 1n);
    expect(await pass.isActive(buyer.address)).to.equal(true);
    await time.increaseTo(until);
    expect(await pass.isActive(buyer.address)).to.equal(false);
  });

  it("only the price setter changes the price or hands the role on; zero is refused", async function () {
    const { pass, setter, other } = await deploy();
    await expect(pass.connect(other).setPrice(1n)).to.be.revertedWith("VeilPass: setter");
    await expect(pass.connect(setter).setPrice(0n)).to.be.revertedWith("VeilPass: price");
    await expect(pass.connect(setter).setPrice(2n * ONE)).to.emit(pass, "PriceSet").withArgs(2n * ONE);
    expect(await pass.price()).to.equal(2n * ONE);
    await expect(pass.connect(setter).handPriceSetter(ethers.ZeroAddress)).to.be.revertedWith("VeilPass: setter");
    await expect(pass.connect(setter).handPriceSetter(other.address))
      .to.emit(pass, "PriceSetterHanded")
      .withArgs(other.address);
    await expect(pass.connect(setter).setPrice(3n * ONE)).to.be.revertedWith("VeilPass: setter");
    await pass.connect(other).setPrice(3n * ONE);
    expect(await pass.price()).to.equal(3n * ONE);
  });

  it("the maxPrice form refuses a price raised above the figure the buyer was shown", async function () {
    const { pass, setter, buyer, other } = await deploy();
    await pass.connect(setter).setPrice(PRICE * 2n);
    await expect(pass.connect(buyer)["buy(uint256)"](PRICE)).to.be.revertedWith("VeilPass: price");
    await expect(
      pass.connect(buyer)["buyFor(address,uint256)"](other.address, PRICE),
    ).to.be.revertedWith("VeilPass: price");
    expect(await pass.isActive(buyer.address)).to.equal(false);
    expect(await pass.isActive(other.address)).to.equal(false);
  });

  it("the maxPrice form buys at the price and above it", async function () {
    const { pass, buyer, other } = await deploy();
    await pass.connect(buyer)["buy(uint256)"](PRICE);
    expect(await pass.isActive(buyer.address)).to.equal(true);
    await pass.connect(buyer)["buyFor(address,uint256)"](other.address, PRICE * 2n);
    expect(await pass.isActive(other.address)).to.equal(true);
    await expect(
      pass.connect(buyer)["buyFor(address,uint256)"](ethers.ZeroAddress, PRICE),
    ).to.be.revertedWith("VeilPass: wallet");
  });

  it("a wallet without allowance or balance cannot buy", async function () {
    const { pass, other } = await deploy();
    await expect(pass.connect(other).buy()).to.be.reverted;
  });

  it("the whole price can burn, and nothing rests in the contract", async function () {
    const { veil, pass, buyer, house } = await deploy({ burnBps: 10_000 });
    await pass.connect(buyer).buy();
    expect(await veil.balanceOf(DEAD)).to.equal(PRICE);
    expect(await veil.balanceOf(house.address)).to.equal(0n);
    expect(await veil.balanceOf(await pass.getAddress())).to.equal(0n);
  });

  it("a token that calls back into buy cannot open two periods for one price", async function () {
    const [, house, setter, buyer] = await ethers.getSigners();
    const veil = await (await ethers.getContractFactory("MockReentrantVeil")).deploy();
    const pass = await (await ethers.getContractFactory("VeilPass")).deploy(
      await veil.getAddress(),
      house.address,
      BURN_BPS,
      PRICE,
      setter.address,
    );
    await veil.setPass(await pass.getAddress());
    await veil.transfer(buyer.address, 10_000n * ONE);
    await veil.connect(buyer).approve(await pass.getAddress(), 10_000n * ONE);
    await expect(pass.connect(buyer).buy()).to.be.revertedWithCustomError(
      pass,
      "ReentrancyGuardReentrantCall",
    );
    expect(await pass.activeUntil(buyer.address)).to.equal(0n);
    expect(await veil.balanceOf(DEAD)).to.equal(0n);
  });

  it("takes no ETH", async function () {
    const { pass, buyer } = await deploy();
    await expect(buyer.sendTransaction({ to: await pass.getAddress(), value: 1n })).to.be.reverted;
  });

  it("refuses a bad deploy: zero veil, zero house, burnBps outside 1..10000, zero price, zero setter", async function () {
    const [, house, setter] = await ethers.getSigners();
    const veil = await (await ethers.getContractFactory("MockVeil")).deploy();
    const Pass = await ethers.getContractFactory("VeilPass");
    const v = await veil.getAddress();
    await expect(Pass.deploy(ethers.ZeroAddress, house.address, BURN_BPS, PRICE, setter.address)).to.be.revertedWith("VeilPass: veil");
    await expect(Pass.deploy(v, ethers.ZeroAddress, BURN_BPS, PRICE, setter.address)).to.be.revertedWith("VeilPass: house");
    await expect(Pass.deploy(v, house.address, 0, PRICE, setter.address)).to.be.revertedWith("VeilPass: burnBps");
    await expect(Pass.deploy(v, house.address, 10_001, PRICE, setter.address)).to.be.revertedWith("VeilPass: burnBps");
    await expect(Pass.deploy(v, house.address, BURN_BPS, 0n, setter.address)).to.be.revertedWith("VeilPass: price");
    await expect(Pass.deploy(v, house.address, BURN_BPS, PRICE, ethers.ZeroAddress)).to.be.revertedWith("VeilPass: setter");
  });
});

const { expect } = require("chai");
const { ethers } = require("hardhat");

const T = (s) => ethers.encodeBytes32String(s);
const ONE = 10n ** 18n;

describe("TerminusWire", function () {
  async function deploy() {
    const [a, b] = await ethers.getSigners();
    const Wire = await ethers.getContractFactory("TerminusWire");
    const wire = await Wire.deploy();
    return { wire, a, b };
  }

  it("starts empty for any poster and ticker", async function () {
    const { wire, a } = await deploy();
    expect(await wire.count(a.address)).to.equal(0n);
    const p = await wire.latest(a.address, T("NVDA"));
    expect(p.staged).to.equal(0n);
    expect(p.terminus).to.equal(0n);
    expect(p.postedAt).to.equal(0n);
    expect(await wire.MAX_BATCH()).to.equal(64n);
  });

  it("post writes latest, bumps the poster's count and emits", async function () {
    const { wire, a } = await deploy();
    const staged = ONE + 2208724969205741n;
    const terminus = 1_800_000_000n;
    await expect(wire.post(T("JNJ"), staged, terminus))
      .to.emit(wire, "Posted")
      .withArgs(a.address, T("JNJ"), staged, terminus, (at) => at > 0n);
    expect(await wire.count(a.address)).to.equal(1n);
    const p = await wire.latest(a.address, T("JNJ"));
    expect(p.staged).to.equal(staged);
    expect(p.terminus).to.equal(terminus);
    expect(p.postedAt).to.be.greaterThan(0n);
  });

  it("a second post overwrites latest for that ticker only", async function () {
    const { wire, a } = await deploy();
    await wire.post(T("JNJ"), ONE, 1n);
    await wire.post(T("UPS"), 2n * ONE, 2n);
    await wire.post(T("JNJ"), 3n * ONE, 3n);
    expect((await wire.latest(a.address, T("JNJ"))).staged).to.equal(3n * ONE);
    expect((await wire.latest(a.address, T("JNJ"))).terminus).to.equal(3n);
    expect((await wire.latest(a.address, T("UPS"))).staged).to.equal(2n * ONE);
    expect(await wire.count(a.address)).to.equal(3n);
  });

  it("two posters do not see each other", async function () {
    const { wire, a, b } = await deploy();
    await wire.connect(a).post(T("JNJ"), ONE, 0n);
    await wire.connect(b).post(T("JNJ"), 2n * ONE, 0n);
    expect((await wire.latest(a.address, T("JNJ"))).staged).to.equal(ONE);
    expect((await wire.latest(b.address, T("JNJ"))).staged).to.equal(2n * ONE);
    expect(await wire.count(a.address)).to.equal(1n);
    expect(await wire.count(b.address)).to.equal(1n);
  });

  it("accepts terminus 0 and rejects an empty ticker or a zero figure", async function () {
    const { wire } = await deploy();
    await expect(wire.post(T("JNJ"), ONE, 0n)).to.emit(wire, "Posted");
    await expect(wire.post(ethers.ZeroHash, ONE, 0n)).to.be.revertedWith("TerminusWire: ticker");
    await expect(wire.post(T("JNJ"), 0n, 0n)).to.be.revertedWith("TerminusWire: staged");
  });

  it("postMany writes every entry in one transaction", async function () {
    const { wire, a } = await deploy();
    const tickers = [T("AAPL"), T("NVDA"), T("TSLA")];
    const staged = [ONE, 4n * ONE, ONE + 5n];
    const terminus = [10n, 20n, 0n];
    await expect(wire.postMany(tickers, staged, terminus)).to.emit(wire, "Posted");
    expect(await wire.count(a.address)).to.equal(3n);
    const nvda = await wire.latest(a.address, T("NVDA"));
    expect(nvda.staged).to.equal(4n * ONE);
    expect(nvda.terminus).to.equal(20n);
    expect((await wire.latest(a.address, T("TSLA"))).terminus).to.equal(0n);
  });

  it("postMany rejects empty input, a length mismatch and more than MAX_BATCH", async function () {
    const { wire } = await deploy();
    await expect(wire.postMany([], [], [])).to.be.revertedWith("TerminusWire: empty");
    await expect(wire.postMany([T("A")], [ONE, ONE], [0n])).to.be.revertedWith(
      "TerminusWire: length",
    );
    await expect(wire.postMany([T("A")], [ONE], [0n, 0n])).to.be.revertedWith(
      "TerminusWire: length",
    );
    const n = Number(await wire.MAX_BATCH()) + 1;
    const tickers = Array.from({ length: n }, (_, i) => T(`T${i}`));
    await expect(
      wire.postMany(
        tickers,
        tickers.map(() => ONE),
        tickers.map(() => 0n),
      ),
    ).to.be.revertedWith("TerminusWire: batch");
  });

  it("a failing entry reverts the whole batch", async function () {
    const { wire, a } = await deploy();
    await expect(wire.postMany([T("A"), T("B")], [ONE, 0n], [0n, 0n])).to.be.revertedWith(
      "TerminusWire: staged",
    );
    expect(await wire.count(a.address)).to.equal(0n);
  });

  it("takes no ETH", async function () {
    const { wire, a } = await deploy();
    await expect(a.sendTransaction({ to: await wire.getAddress(), value: 1n })).to.be.reverted;
  });
});

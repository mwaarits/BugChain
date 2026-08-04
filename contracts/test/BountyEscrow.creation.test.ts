import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "./helpers/hre";
import { DAY, deployFixture } from "./helpers/fixture";

const future = async () => (await time.latest()) + 30 * DAY;

describe("BountyEscrow — creation", () => {
  it("issues increasing bounty ids — one contract, many bounties", async () => {
    const { escrow, business } = await deployFixture();
    await escrow.connect(business).createBounty(ethers.ZeroHash, await future(), { value: 1n });
    await escrow.connect(business).createBounty(ethers.ZeroHash, await future(), { value: 2n });
    expect(await escrow.bountyCount()).to.equal(2n);
  });

  it("holds the funded reward in escrow and records scope + deadline + business", async () => {
    const { escrow, business } = await deployFixture();
    const addr = await escrow.getAddress();
    const balanceBefore = await ethers.provider.getBalance(addr);
    const scope = ethers.keccak256(ethers.toUtf8Bytes("PCT scope"));
    const deadline = await future();
    await escrow.connect(business).createBounty(scope, deadline, { value: ethers.parseEther("5") });
    expect(await ethers.provider.getBalance(addr)).to.equal(balanceBefore + ethers.parseEther("5"));
    const b = await escrow.bountyOf(0);
    expect(b.business).to.equal(business.address);
    expect(b.scopeHash).to.equal(scope);
    expect(b.reward).to.equal(ethers.parseEther("5"));
    expect(ethers.toNumber(b.deadline)).to.equal(deadline);
    expect(b.state).to.equal(0n); // Active
  });

  it("reverts on zero value", async () => {
    const { escrow, business } = await deployFixture();
    await expect(escrow.connect(business).createBounty(ethers.ZeroHash, await future(), { value: 0n })).to.be.revertedWithCustomError(escrow, "ZeroValue");
  });

  it("reverts with a past deadline", async () => {
    const { escrow, business } = await deployFixture();
    await expect(escrow.connect(business).createBounty(ethers.ZeroHash, 1, { value: 1n })).to.be.revertedWithCustomError(escrow, "DeadlineInPast");
  });

  it("emits BountyCreated with business, scope, reward, deadline", async () => {
    const { escrow, business } = await deployFixture();
    const deadline = await future();
    const scope = ethers.keccak256(ethers.toUtf8Bytes("s"));
    await expect(escrow.connect(business).createBounty(scope, deadline, { value: ethers.parseEther("2") }))
      .to.emit(escrow, "BountyCreated")
      .withArgs(0n, business.address, scope, ethers.parseEther("2"), BigInt(deadline));
  });
});
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "./helpers/hre";
import { DAY, deployFixture } from "./helpers/fixture";

const future = async () => (await time.latest()) + 30 * DAY;
const hashOf = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

describe("BountyEscrow — cancel, deadline & two-phase refund", () => {
  it("business can cancel a zero-submission bounty; escrow returns; closes cancelled", async () => {
    const { escrow, business } = await deployFixture();
    await escrow.connect(business).createBounty(hashOf("scope"), await future(), { value: ethers.parseEther("2") });
    const amount = ethers.parseEther("2");
    await expect(() => escrow.connect(business).cancelBounty(0)).to.changeEtherBalance(business, amount);
    expect((await escrow.bountyOf(0)).state).to.equal(2n); // Closed
    await expect(escrow.connect(business).cancelBounty(0)).to.be.revertedWithCustomError(escrow, "WrongBountyState");
  });

  it("cancel reverts as soon as any submission exists", async () => {
    const { escrow, business, researcher } = await deployFixture();
    await escrow.connect(business).createBounty(hashOf("scope"), await future(), { value: 1n });
    await escrow.connect(researcher).submitSubmission(0, hashOf("r"));
    await expect(escrow.connect(business).cancelBounty(0)).to.be.revertedWithCustomError(escrow, "HasSubmissions");
  });

  it("cancel is for the business only", async () => {
    const { escrow, business, stranger } = await deployFixture();
    await escrow.connect(business).createBounty(hashOf("scope"), await future(), { value: 1n });
    await expect(escrow.connect(stranger).cancelBounty(0)).to.be.revertedWithCustomError(escrow, "NotBusiness");
  });

  it("requestRefund reverts with pending submissions", async () => {
    const { escrow, business, researcher } = await deployFixture();
    await escrow.connect(business).createBounty(hashOf("scope"), await future(), { value: 1n });
    await escrow.connect(researcher).submitSubmission(0, hashOf("r"));
    await expect(escrow.connect(business).requestRefund(0)).to.be.revertedWithCustomError(escrow, "PendingSubmissions");
  });

  it("all-rejected → request refund → RefundPending + event", async () => {
    const { escrow, business, researcher } = await deployFixture();
    await escrow.connect(business).createBounty(hashOf("scope"), await future(), { value: 1n });
    await escrow.connect(researcher).submitSubmission(0, hashOf("r"));
    await escrow.connect(business).rejectSubmission(0, 0);
    await expect(escrow.connect(business).requestRefund(0))
      .to.emit(escrow, "RefundRequested")
      .withArgs(0n);
    expect((await escrow.bountyOf(0)).state).to.equal(1n); // RefundPending
  });

  it("confirm refunds the business exactly and closes as refunded", async () => {
    const { escrow, business, researcher } = await deployFixture();
    const amount = ethers.parseEther("2.5");
    await escrow.connect(business).createBounty(hashOf("scope"), await future(), { value: amount });
    await escrow.connect(researcher).submitSubmission(0, hashOf("r"));
    await escrow.connect(business).markAllInvalid(0);
    await escrow.connect(business).requestRefund(0);
    await expect(() => escrow.connect(business).confirmRefund(0)).to.changeEtherBalance(business, amount);
    expect((await escrow.bountyOf(0)).state).to.equal(2n); // Closed
    await expect(escrow.connect(business).confirmRefund(0)).to.be.revertedWithCustomError(escrow, "WrongBountyState");
  });

  it("confirm from a wrong state reverts", async () => {
    const { escrow, business, researcher } = await deployFixture();
    await escrow.connect(business).createBounty(hashOf("scope"), await future(), { value: 1n });
    await expect(escrow.connect(business).confirmRefund(0)).to.be.revertedWithCustomError(escrow, "WrongBountyState");
    await escrow.connect(researcher).submitSubmission(0, hashOf("r"));
    await escrow.connect(business).rejectSubmission(0, 0);
    await expect(escrow.connect(business).confirmRefund(0)).to.be.revertedWithCustomError(escrow, "WrongBountyState");
  });

  it("a Researcher can raise a dispute inside the two-phase refund window", async () => {
    const { escrow, business, researcher } = await deployFixture();
    await escrow.connect(business).createBounty(hashOf("scope"), await future(), { value: 1n });
    await escrow.connect(researcher).submitSubmission(0, hashOf("r"));
    await escrow.connect(business).rejectSubmission(0, 0);
    await escrow.connect(business).requestRefund(0);
    await expect(escrow.connect(researcher).raiseDispute(0, 0))
      .to.emit(escrow, "DisputeRaised")
      .withArgs(0n, researcher.address, 0n); // ResearcherFlag
    const flag = await escrow.disputeFlag(0);
    expect(flag[0]).to.equal(true); // disputeRequested
    expect(flag[1]).to.equal(false); // still not opened
  });

  it("deadline only blocks submissions; nothing else auto-fires at the deadline", async () => {
    const { escrow, business, researcher } = await deployFixture();
    const deadline = (await time.latest()) + 60;
    await escrow.connect(business).createBounty(hashOf("scope"), deadline, { value: 1n });
    await time.increaseTo(deadline + 1);
    await expect(escrow.connect(researcher).submitSubmission(0, hashOf("late"))).to.be.revertedWithCustomError(escrow, "DeadlinePassed");
    // zero submissions past deadline: cancel is still offered (one-phase, no claimant)
    await expect(() => escrow.connect(business).cancelBounty(0)).to.changeEtherBalance(business, 1n);
  });
});
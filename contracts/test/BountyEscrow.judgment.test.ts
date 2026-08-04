import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "./helpers/hre";
import { DAY, deployFixture } from "./helpers/fixture";

const future = async () => (await time.latest()) + 30 * DAY;
const hashOf = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

describe("BountyEscrow — business judgment & payout", () => {
  async function withSubmission() {
    const f = await deployFixture();
    await f.escrow.connect(f.business).createBounty(hashOf("scope"), await future(), { value: ethers.parseEther("4") });
    await f.escrow.connect(f.researcher).submitSubmission(0, hashOf("report"));
    return f;
  }

  it("accept pays the exact reward to the researcher and closes paid", async () => {
    const { escrow, business, researcher } = await withSubmission();
    const escrowBefore = await ethers.provider.getBalance(await escrow.getAddress());
    const researcherBefore = await ethers.provider.getBalance(researcher.address);
    await expect(escrow.connect(business).acceptSubmission(0, 0))
      .to.emit(escrow, "SubmissionJudged")
      .withArgs(0n, 0n, true)
      .and.to.emit(escrow, "BountyClosed")
      .withArgs(0n, 1n); // reason Paid
    expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(escrowBefore - ethers.parseEther("4"));
    expect(await ethers.provider.getBalance(researcher.address)).to.equal(researcherBefore + ethers.parseEther("4"));
    const b = await escrow.bountyOf(0);
    expect(b.state).to.equal(2n); // Closed
    const sub = await escrow.submissionAt(0, 0);
    expect(sub.state).to.equal(1n); // accepted
  });

  it("the same submission can never be paid twice", async () => {
    const { escrow, business } = await withSubmission();
    await escrow.connect(business).acceptSubmission(0, 0);
    await expect(escrow.connect(business).acceptSubmission(0, 0)).to.be.revertedWithCustomError(escrow, "WrongBountyState");
  });

  it("only the bounty's business may judge", async () => {
    const { escrow, stranger } = await withSubmission();
    await expect(escrow.connect(stranger).acceptSubmission(0, 0)).to.be.revertedWithCustomError(escrow, "NotBusiness");
    await expect(escrow.connect(stranger).rejectSubmission(0, 0)).to.be.revertedWithCustomError(escrow, "NotBusiness");
    await expect(escrow.connect(stranger).markAllInvalid(0)).to.be.revertedWithCustomError(escrow, "NotBusiness");
  });

  it("business can reject a single submission", async () => {
    const { escrow, business } = await withSubmission();
    await expect(escrow.connect(business).rejectSubmission(0, 0))
      .to.emit(escrow, "SubmissionJudged")
      .withArgs(0n, 0n, false);
    expect((await escrow.submissionAt(0, 0)).state).to.equal(2n); // rejected
  });

  it("business can mark all pending submissions invalid in one transaction", async () => {
    const { escrow, business, researcher, researcher2 } = await withSubmission();
    await escrow.connect(researcher2).submitSubmission(0, hashOf("report2"));
    await escrow.connect(researcher).submitSubmission(0, hashOf("report3"));
    await escrow.connect(business).markAllInvalid(0);
    for (let i = 0; i < 3; i++) {
      expect((await escrow.submissionAt(0, i)).state).to.equal(2n); // rejected
    }
    // already-rejected stay rejected, no double-judgment issues
    await escrow.connect(business).markAllInvalid(0);
    expect((await escrow.submissionAt(0, 0)).state).to.equal(2n);
  });

  it("rejecting an already-judged submission reverts", async () => {
    const { escrow, business } = await withSubmission();
    await escrow.connect(business).rejectSubmission(0, 0);
    await expect(escrow.connect(business).rejectSubmission(0, 0)).to.be.revertedWithCustomError(
      escrow,
      "WrongSubmissionState"
    );
  });

  it("second-place researcher gets nothing — single winner", async () => {
    const { escrow, business, researcher, researcher2 } = await withSubmission();
await escrow.connect(researcher2).submitSubmission(0, hashOf("second report"));
    const escrowBefore = await ethers.provider.getBalance(await escrow.getAddress());
    const secondBefore = await ethers.provider.getBalance(researcher2.address);
    await escrow.connect(business).acceptSubmission(0, 0);
    expect(await ethers.provider.getBalance(researcher2.address)).to.equal(secondBefore);
    expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(escrowBefore - ethers.parseEther("4"));
  });
});
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "./helpers/hre";
import { DAY, deployFixture } from "./helpers/fixture";

const future = async () => (await time.latest()) + 30 * DAY;
const hashOf = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

describe("BountyEscrow — dispute & owner-silence", () => {
  async function withSubmission() {
    const f = await deployFixture({ silenceWindow: DAY });
    await f.escrow.connect(f.business).createBounty(hashOf("scope"), await future(), { value: ethers.parseEther("4") });
    await f.escrow.connect(f.researcher).submitSubmission(0, hashOf("report"));
    return f;
  }

  async function openedResearcherFlag() {
    const f = await withSubmission();
    await f.escrow.connect(f.researcher).raiseDispute(0);
    await f.escrow.connect(f.admin).openDispute(0, 0); // ResearcherFlag
    return f;
  }

  it("raiseDispute is callable by anyone and records proof on-chain", async () => {
    const { escrow, stranger } = await withSubmission();
    await expect(escrow.connect(stranger).raiseDispute(0))
      .to.emit(escrow, "DisputeRaised")
      .withArgs(0n, stranger.address);
    const flag = await escrow.disputeFlag(0);
    expect(flag[0]).to.equal(true); // disputeRequested
    expect(flag[1]).to.equal(false); // not opened
  });

  it("openDispute and closeDispute are admin-only", async () => {
    const { escrow, stranger } = await withSubmission();
    await expect(escrow.connect(stranger).openDispute(0, 0)).to.be.revertedWithCustomError(escrow, "NotAdmin");
    await expect(escrow.connect(stranger).openDispute(0, 1)).to.be.revertedWithCustomError(escrow, "NotAdmin");
    await expect(escrow.connect(stranger).closeDispute(0)).to.be.revertedWithCustomError(escrow, "NotAdmin");
  });

  it("owner-silence open reverts until the window from the first submission elapses", async () => {
    const { escrow, admin, silenceWindow, researcher } = await withSubmission();
    await escrow.connect(researcher).raiseDispute(0);
    await expect(escrow.connect(admin).openDispute(0, 1)).to.be.revertedWithCustomError(escrow, "SilenceNotElapsed"); // OwnerSilence
    await time.increase(silenceWindow + 1);
    await expect(escrow.connect(admin).openDispute(0, 1))
      .to.emit(escrow, "DisputeOpened")
      .withArgs(0n, admin.address, 1n);
    expect((await escrow.disputeFlag(0))[1]).to.equal(true); // inDispute
  });

  it("owner-silence cannot be opened without any submission", async () => {
    const { escrow, business, admin } = await deployFixture({ silenceWindow: 60 });
    await escrow.connect(business).createBounty(hashOf("scope"), await future(), { value: 1n });
    await expect(escrow.connect(admin).openDispute(0, 1)).to.be.revertedWithCustomError(escrow, "SilenceUnavailable");
  });

  it("while inDispute the admin holds the judgment set and the business is locked out", async () => {
    const { escrow, admin, business, researcher, researcher2 } = await withSubmission();
    await escrow.connect(researcher2).submitSubmission(0, hashOf("second"));
    await escrow.connect(researcher).raiseDispute(0);
    await escrow.connect(admin).openDispute(0, 0);
    await expect(escrow.connect(researcher2).submitSubmission(0, hashOf("blocked"))).to.be.revertedWithCustomError(
      escrow,
      "InDispute"
    );
    await expect(escrow.connect(business).acceptSubmission(0, 0)).to.be.revertedWithCustomError(escrow, "NotAdmin");
    await expect(escrow.connect(business).rejectSubmission(0, 1)).to.be.revertedWithCustomError(escrow, "NotAdmin");
    await expect(escrow.connect(business).markAllInvalid(0)).to.be.revertedWithCustomError(escrow, "NotAdmin");
    await expect(escrow.connect(business).requestRefund(0)).to.be.revertedWithCustomError(escrow, "InDispute");
    await expect(escrow.connect(admin).rejectSubmission(0, 1)).to.emit(escrow, "SubmissionJudged");
    expect((await escrow.submissionAt(0, 1)).state).to.equal(2n); // rejected by the admin
  });

  it("admin accept during a dispute pays the researcher and closes the bounty; admin is never a payee", async () => {
    const { escrow, admin, researcher } = await openedResearcherFlag();
    const escrowBefore = await ethers.provider.getBalance(await escrow.getAddress());
    const adminBefore = await ethers.provider.getBalance(admin.address);
    const researcherBefore = await ethers.provider.getBalance(researcher.address);
    await expect(escrow.connect(admin).acceptSubmission(0, 0))
      .to.emit(escrow, "DisputeResolved")
      .withArgs(0n, admin.address, 0n); // Resolution Payout
    // the admin never profits: they only paid gas for this tx, the escrow went to the researcher
    expect(await ethers.provider.getBalance(admin.address)).to.be.lessThan(adminBefore);
    expect(await ethers.provider.getBalance(researcher.address)).to.equal(researcherBefore + ethers.parseEther("4"));
    expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(escrowBefore - ethers.parseEther("4"));
    expect((await escrow.bountyOf(0)).state).to.equal(2n); // Closed
    expect((await escrow.disputeFlag(0))[1]).to.equal(false); // resolved clears the gate
  });

  it("admin refund inside a dispute returns escrow to the business", async () => {
    const { escrow, admin, business, researcher } = await deployFixture({ silenceWindow: 60 });
    await escrow.connect(business).createBounty(hashOf("scope"), await future(), { value: ethers.parseEther("4") });
    await escrow.connect(researcher).submitSubmission(0, hashOf("r"));
    await escrow.connect(business).rejectSubmission(0, 0);
    await escrow.connect(business).requestRefund(0);
    await escrow.connect(researcher).raiseDispute(0);
    await escrow.connect(admin).openDispute(0, 0);
    await expect(() => escrow.connect(admin).confirmRefund(0)).to.changeEtherBalance(business, ethers.parseEther("4"));
    expect((await escrow.bountyOf(0)).state).to.equal(2n); // Closed
    // gate cleared after resolution: a second confirm from the admin reverts
    await expect(escrow.connect(admin).confirmRefund(0)).to.be.revertedWithCustomError(escrow, "NotBusiness");
  });

  it("closeDispute restores the prior state with the standing judgment intact", async () => {
    const { escrow, admin, business } = await openedResearcherFlag();
    await expect(escrow.connect(admin).closeDispute(0)).to.changeEtherBalance(business, 0n);
    const b = await escrow.bountyOf(0);
    expect(b.state).to.equal(0n); // back to Active
    expect(b.inDispute).to.equal(false);
    expect((await escrow.submissionAt(0, 0)).state).to.equal(0n); // standing Submitted judgment intact
    await expect(escrow.connect(admin).closeDispute(0)).to.be.revertedWithCustomError(escrow, "NotInDispute");
  });

  it("an unfounded dispute does not block the bounty: business resumes judging after dismissal", async () => {
    const { escrow, admin, business, researcher } = await openedResearcherFlag();
    await escrow.connect(admin).closeDispute(0);
    await expect(escrow.connect(business).acceptSubmission(0, 0))
      .to.emit(escrow, "BountyClosed")
      .withArgs(0n, 1n); // Paid
  });
});
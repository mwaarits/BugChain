import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "./helpers/hre";
import { DAY, deployFixture } from "./helpers/fixture";

const future = async () => (await time.latest()) + 30 * DAY;
const hashOf = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

describe("BountyEscrow — submission", () => {
  async function funded() {
    const f = await deployFixture();
    await f.escrow.connect(f.business).createBounty(hashOf("scope"), await future(), { value: ethers.parseEther("3") });
    return f;
  }

  it("anyone can submit a hash; submission stores hash, submitter, timestamp, state", async () => {
    const { escrow, researcher, researcher2 } = await funded();
    const before = await time.latest();
    const hash = hashOf("vuln report #1");
    await expect(escrow.connect(researcher).submitSubmission(0, hash))
      .to.emit(escrow, "SubmissionSubmitted")
      .withArgs(0n, 0n, researcher.address, hash);
    const sub = await escrow.submissionAt(0, 0);
    expect(sub.hash).to.equal(hash);
    expect(sub.submitter).to.equal(researcher.address);
    expect(ethers.toNumber(sub.timestamp)).to.be.greaterThanOrEqual(before);
    expect(sub.state).to.equal(0n); // submitted

    await escrow.connect(researcher2).submitSubmission(0, hashOf("second"));
    expect(await escrow.submissionCountOf(0)).to.equal(2n);
  });

  it("reverts past the deadline; a pre-deadline submission succeeds", async () => {
    const f = await deployFixture();
    const deadline = (await time.latest()) + 100;
    await f.escrow.connect(f.business).createBounty(hashOf("scope"), deadline, { value: 1n });
    await time.increaseTo(deadline - 5);
    await expect(f.escrow.connect(f.researcher).submitSubmission(0, hashOf("on time")))
      .to.emit(f.escrow, "SubmissionSubmitted");
    await time.increaseTo(deadline);
    await expect(f.escrow.connect(f.researcher2).submitSubmission(0, hashOf("late"))).to.be.revertedWithCustomError(f.escrow, "DeadlinePassed");
  });

  it("reverts for a zero hash", async () => {
    const { escrow, researcher } = await funded();
    await expect(escrow.connect(researcher).submitSubmission(0, ethers.ZeroHash)).to.be.revertedWithCustomError(escrow, "ZeroHash");
  });

  it("reverts for a nonexistent bounty", async () => {
    const { escrow, researcher } = await funded();
    await expect(escrow.connect(researcher).submitSubmission(99, hashOf("x"))).to.be.revertedWithCustomError(escrow, "BountyNotFound");
  });

  it("reverts once the bounty has been accepted (closed)", async () => {
    const { escrow, business, researcher, researcher2 } = await funded();
    await escrow.connect(researcher).submitSubmission(0, hashOf("first"));
    await escrow.connect(business).acceptSubmission(0, 0);
    await expect(escrow.connect(researcher2).submitSubmission(0, hashOf("too late"))).to.be.revertedWithCustomError(escrow, "WrongBountyState");
  });

  it("records the first submission timestamp used by the owner-silence timer", async () => {
    const { escrow, researcher } = await funded();
    const before = await time.latest();
    await escrow.connect(researcher).submitSubmission(0, hashOf("first"));
    const b = await escrow.bountyOf(0);
    expect(ethers.toNumber(b.firstSubmissionTs)).to.be.greaterThanOrEqual(before);
  });
});
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "./helpers/hre";
import { DAY, deployFixture } from "./helpers/fixture";

const future = async () => (await time.latest()) + 30 * DAY;
const hashOf = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

describe("BountyEscrow — escrow invariant (balance-in = balance-out)", () => {
  it("funds only leave to an accepted submitter, a cancel, or a refund — never to the admin", async () => {
    const { escrow, admin, business, researcher, researcher2 } = await deployFixture({ silenceWindow: DAY });
    const addr = await escrow.getAddress();

    // bounty #0 -> paid (escrow 4)
    await escrow.connect(business).createBounty(hashOf("a"), await future(), { value: ethers.parseEther("4") });
    await escrow.connect(researcher).submitSubmission(0, hashOf("r1"));
    await escrow.connect(business).acceptSubmission(0, 0);

    // bounty #1 -> refunded (escrow 2)
    await escrow.connect(business).createBounty(hashOf("b"), await future(), { value: ethers.parseEther("2") });
    await escrow.connect(researcher2).submitSubmission(1, hashOf("r2"));
    await escrow.connect(business).markAllInvalid(1);
    await escrow.connect(business).requestRefund(1);
    await escrow.connect(business).confirmRefund(1);

    // bounty #2 -> cancelled (escrow 5)
    await escrow.connect(business).createBounty(hashOf("c"), await future(), { value: ethers.parseEther("5") });
    await escrow.connect(business).cancelBounty(2);

    // bounty #3 -> still active, 3 held
    await escrow.connect(business).createBounty(hashOf("d"), await future(), { value: ethers.parseEther("3") });

    const remaining = await ethers.provider.getBalance(addr);
    expect(remaining).to.equal(ethers.parseEther("3"));
  });

  it("the admin has no free-withdrawal path: out-of-dispute admin calls all revert and never move funds", async () => {
    const { escrow, admin, business, researcher, stranger } = await deployFixture();
    await escrow.connect(business).createBounty(hashOf("a"), await future(), { value: ethers.parseEther("1") });
    await escrow.connect(researcher).submitSubmission(0, hashOf("r"));

    // no free withdrawal: every admin call is refused; escrow never moves toward the admin
    await expect(escrow.connect(admin).acceptSubmission(0, 0)).to.be.revertedWithCustomError(escrow, "NotBusiness");
    await expect(escrow.connect(admin).rejectSubmission(0, 0)).to.be.revertedWithCustomError(escrow, "NotBusiness");
    await expect(escrow.connect(admin).markAllInvalid(0)).to.be.revertedWithCustomError(escrow, "NotBusiness");
    await expect(escrow.connect(admin).cancelBounty(0)).to.be.revertedWithCustomError(escrow, "NotBusiness");
    await expect(escrow.connect(admin).confirmRefund(0)).to.be.reverted;
    await expect(escrow.connect(stranger).openDispute(0, 0)).to.be.revertedWithCustomError(escrow, "NotAdmin");
    expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(ethers.parseEther("1"));
    expect((await escrow.disputeFlag(0))[1]).to.equal(false);
  });
});
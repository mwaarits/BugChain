import { expect } from "chai";
import { ethers } from "./helpers/hre";
import { deployFixture } from "./helpers/fixture";

describe("BountyEscrow — admin config (finalize: no redeploy to rotate or tune)", () => {
  it("transferAdmin rotates the admin address and revokes the old one", async () => {
    const { escrow, admin, stranger } = await deployFixture();
    await expect(escrow.connect(stranger).transferAdmin(stranger.address)).to.be.revertedWithCustomError(escrow, "NotAdmin");
    await expect(escrow.connect(admin).transferAdmin(ethers.ZeroAddress)).to.be.revertedWithCustomError(escrow, "ZeroAddress");
    await expect(escrow.connect(admin).transferAdmin(stranger.address))
      .to.emit(escrow, "AdminTransferred")
      .withArgs(admin.address, stranger.address);
    expect(await escrow.admin()).to.equal(stranger.address);
    // the old admin is revoked
    await expect(escrow.connect(admin).openDispute(0, 0)).to.be.revertedWithCustomError(escrow, "NotAdmin");
  });

  it("silenceWindow and raiseCooldown are admin-tunable without a redeploy", async () => {
    const { escrow, admin, stranger } = await deployFixture();
    await expect(escrow.connect(stranger).setSilenceWindow(7 * 86400)).to.be.revertedWithCustomError(escrow, "NotAdmin");
    await expect(escrow.connect(stranger).setRaiseCooldown(3600)).to.be.revertedWithCustomError(escrow, "NotAdmin");
    await expect(escrow.connect(admin).setSilenceWindow(7 * 86400))
      .to.emit(escrow, "SilenceWindowSet")
      .withArgs(7 * 86400);
    await expect(escrow.connect(admin).setRaiseCooldown(3600))
      .to.emit(escrow, "RaiseCooldownSet")
      .withArgs(3600);
    expect(await escrow.silenceWindow()).to.equal(7 * 86400);
    expect(await escrow.raiseCooldown()).to.equal(3600);
  });
});
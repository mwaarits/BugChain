import { ethers } from "./hre";

export const DAY = 86400;

export interface Fixture {
  escrow: any;
  admin: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  business: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  researcher: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  researcher2: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  stranger: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  silenceWindow: number;
}

export async function deployFixture(defaults: { silenceWindow?: number } = {}): Promise<Fixture> {
  const silenceWindow = defaults.silenceWindow ?? 3 * 86400;
  const [admin, business, researcher, researcher2, stranger] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("BountyEscrow");
  const escrow = await factory.deploy(silenceWindow);
  await escrow.waitForDeployment();
  return { escrow, admin, business, researcher, researcher2, stranger, silenceWindow };
}
import { expect } from "chai";
import { deployments, ethers } from "hardhat";

const setup = deployments.createFixture(async () => {
  await deployments.fixture(["SuperVaultFactory"]);
  const SuperVaultFactory = await ethers.getContract("SuperVaultFactory");
  return { SuperVaultFactory };
});

describe("SuperVaultFactory", () => {
  it("shouldn't allow 0x addresses as the leverage contract", async () => {
    const { SuperVaultFactory } = await setup();
    await expect(SuperVaultFactory.clone(ethers.constants.AddressZero)).to.be.reverted;
  });
});

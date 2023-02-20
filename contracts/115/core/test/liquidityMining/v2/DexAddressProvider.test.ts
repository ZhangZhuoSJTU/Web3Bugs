import { deployments, ethers } from "hardhat";
import { DEXES } from "../../../config/deployment";
import { AddressProvider, DexAddressProvider } from "../../../typechain-types";

const { expectRevert } = require("@openzeppelin/test-helpers");

const setup = deployments.createFixture(async () => {
  await deployments.fixture(["DexAddressProvider"]);
  const [owner, alice, proxy1, router1] = await ethers.getSigners();
  const dexAddressProvider: DexAddressProvider = await ethers.getContract("DexAddressProvider");
  const addressProvider: AddressProvider = await ethers.getContract("AddressProvider");

  return {
    owner,
    alice,
    proxy1,
    router1,
    dexAddressProvider,
    addressProvider,
  };
});

describe("--- DexAddressProvider ---", () => {
  it("should set AddressProvider correctly", async () => {
    const { dexAddressProvider, addressProvider } = await setup();
    const _addressProvider = await dexAddressProvider.parallel();
    expect(_addressProvider).to.be.equal(addressProvider.address);
  });
  it("should set dexMapping correctly", async () => {
    const { dexAddressProvider } = await setup();
    for (const dex of DEXES) {
      const [_proxy, _router] = await dexAddressProvider.dexMapping(ethers.BigNumber.from(DEXES.indexOf(dex)));
      const { proxy, router } = dex;
      expect(_proxy).to.be.equal(proxy);
      expect(_router).to.be.equal(router);
    }
  });
  it("should revert if trying to set AddressProvider to address 0", async () => {
    const { owner } = await setup();
    const { deploy } = deployments;
    await expectRevert(
      deploy("DexAddressProvider", {
        from: owner.address,
        args: [ethers.constants.AddressZero, DEXES],
      }),
      "LM000",
    );
  });
  it("protocol manager should be able to setDexMapping correclty", async () => {
    const { dexAddressProvider, proxy1, router1 } = await setup();
    await dexAddressProvider.setDexMapping(1, proxy1.address, router1.address);
    const [proxy, router] = await dexAddressProvider.dexMapping(1);
    expect(proxy).to.be.equal(proxy1.address);
    expect(router).to.be.equal(router1.address);
  });
  it("should revert if trying to setDexMapping by other then protocol manager or contract", async () => {
    const { dexAddressProvider, alice, proxy1, router1 } = await setup();
    await expectRevert(dexAddressProvider.connect(alice).setDexMapping(1, proxy1.address, router1.address), "LM010");
  });
  it("should revert if trying to set proxy to address 0", async () => {
    const { dexAddressProvider, router1 } = await setup();
    await expectRevert(dexAddressProvider.setDexMapping(1, ethers.constants.AddressZero, router1.address), "LM000");
  });
  it("should revert if trying to set router to address 0", async () => {
    const { dexAddressProvider, proxy1 } = await setup();
    await expectRevert(dexAddressProvider.setDexMapping(1, proxy1.address, ethers.constants.AddressZero), "LM000");
  });
});

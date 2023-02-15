import { ethers } from "hardhat";
import { expect } from "chai";

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import type { SandclockFactory, TestERC20, Vault } from "@root/typechain";

describe("SandclockFactory", () => {
  let owner: SignerWithAddress;

  let underlying: TestERC20;
  let factory: SandclockFactory;

  beforeEach(async () => {
    [owner] = await ethers.getSigners();

    let TestERC20 = await ethers.getContractFactory("TestERC20");
    let SandclockFactory = await ethers.getContractFactory("SandclockFactory");

    underlying = (await TestERC20.deploy(0)) as TestERC20;
    factory = (await SandclockFactory.deploy()) as SandclockFactory;
  });

  describe("deployVault", () => {
    it("deploys a vault with a deterministic address", async () => {
      const Vault = await ethers.getContractFactory("Vault");

      // CREATE2 params
      const salt = ethers.utils.id("Vault_USDC");
      const encodedArgs = Vault.interface.encodeDeploy([
        underlying.address,
        1209600,
        0,
        owner.address,
      ]);
      const code = ethers.utils.hexConcat([Vault.bytecode, encodedArgs]);

      const expectedAddress = ethers.utils.getCreate2Address(
        factory.address,
        salt,
        ethers.utils.keccak256(code)
      );

      // deploy through factory
      const action = await factory.connect(owner).deployVault(code, salt, {
        gasLimit: 10000000,
      });

      // emits the correct event
      await expect(action)
        .to.emit(factory, "NewVault")
        .withArgs(expectedAddress, salt);

      // deployed contract works as intended
      const vault = (await ethers.getContractAt(
        "Vault",
        expectedAddress
      )) as Vault;

      expect(await vault.underlying()).to.equal(underlying.address);
    });
  });
});

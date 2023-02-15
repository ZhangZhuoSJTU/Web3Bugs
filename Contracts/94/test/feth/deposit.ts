import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { FETH } from "../../typechain-types";
import { deployContracts } from "../helpers/deploy";

describe("FETH / deposit", function () {
  const value = ethers.utils.parseEther("1");

  let feth: FETH;
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let rando: SignerWithAddress;
  let tx: ContractTransaction;

  beforeEach(async () => {
    [deployer, user, rando] = await ethers.getSigners();
    ({ feth } = await deployContracts({ deployer }));
  });

  describe("Direct ETH transfer", () => {
    beforeEach(async () => {
      tx = await user.sendTransaction({ to: feth.address, value: value });
    });

    it("Emits Transfer", async () => {
      await expect(tx).to.emit(feth, "Transfer").withArgs(ethers.constants.AddressZero, user.address, value);
    });

    it("Has available balance", async () => {
      const balance = await feth.balanceOf(user.address);
      expect(balance).to.eq(value);
    });

    it("Has total balance", async () => {
      const balance = await feth.totalBalanceOf(user.address);
      expect(balance).to.eq(value);
    });

    it("Transfers ETH", async () => {
      await expect(tx).to.changeEtherBalances([feth, user], [value, value.mul(-1)]);
    });
  });

  describe("`deposit`", () => {
    beforeEach(async () => {
      tx = await feth.connect(user).deposit({ value: value });
    });

    it("Emits Transfer", async () => {
      await expect(tx).to.emit(feth, "Transfer").withArgs(ethers.constants.AddressZero, user.address, value);
    });

    it("Has available balance", async () => {
      const balance = await feth.balanceOf(user.address);
      expect(balance).to.eq(value);
    });

    it("Has total balance", async () => {
      const balance = await feth.totalBalanceOf(user.address);
      expect(balance).to.eq(value);
    });

    it("Transfers ETH", async () => {
      await expect(tx).to.changeEtherBalances([feth, user], [value, value.mul(-1)]);
    });
  });

  describe("`depositFor`", () => {
    beforeEach(async () => {
      tx = await feth.connect(rando).depositFor(user.address, { value: value });
    });

    it("Emits Transfer", async () => {
      await expect(tx).to.emit(feth, "Transfer").withArgs(ethers.constants.AddressZero, user.address, value);
    });

    it("Has available balance", async () => {
      const balance = await feth.balanceOf(user.address);
      expect(balance).to.eq(value);
    });

    it("Has total balance", async () => {
      const balance = await feth.totalBalanceOf(user.address);
      expect(balance).to.eq(value);
    });

    it("Transfers ETH", async () => {
      await expect(tx).to.changeEtherBalances([feth, rando], [value, value.mul(-1)]);
    });
  });
});

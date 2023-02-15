import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, upgrades } from "hardhat";
import { JPEG, JPEGStaking } from "../types";
import { units } from "./utils";

const { expect } = chai;

chai.use(solidity);

describe("JPEGStaking", () => {
  let owner: SignerWithAddress, alice: SignerWithAddress;
  let jpeg: JPEG, sJpegd: JPEGStaking;

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    alice = accounts[1];

    const JPEG = await ethers.getContractFactory("JPEG");
    jpeg = await JPEG.deploy(units(1000000000)); // 1B JPEG'd
    await jpeg.deployed();

    const JPEGStaking = await ethers.getContractFactory("JPEGStaking");
    sJpegd = <JPEGStaking>(
      await upgrades.deployProxy(JPEGStaking, [jpeg.address])
    );
    await sJpegd.deployed();
  });

  it("stake should not work with invalid parameters", async () => {
    await expect(sJpegd.stake(0)).to.be.revertedWith("invalid_amount");
    await expect(sJpegd.stake(units(1))).to.be.revertedWith(
      "ERC20: transfer amount exceeds allowance"
    );
  });

  it("stake should work", async () => {
    await jpeg.approve(sJpegd.address, units(1));
    await sJpegd.stake(units(1));

    expect(await sJpegd.balanceOf(owner.address)).to.equal(units(1));
  });

  it("unstake should not work with invalid parameters", async () => {
    await expect(sJpegd.unstake(0)).to.be.revertedWith("invalid_amount");
    await expect(sJpegd.unstake(units(2))).to.be.revertedWith("invalid_amount");
  });

  it("unstake should work", async () => {
    await jpeg.approve(sJpegd.address, units(1));
    await sJpegd.stake(units(1));
    await sJpegd.transfer(alice.address, units(1));
    await sJpegd.connect(alice).unstake(units(1));

    expect(await jpeg.balanceOf(alice.address)).to.equal(units(1));
  });
});

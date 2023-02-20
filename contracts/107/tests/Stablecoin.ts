import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { StableCoin } from "../types";
import { units } from "./utils";

const { expect } = chai;

chai.use(solidity);

const minter_role =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const pauser_role =
  "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a";

describe("Stablecoin", () => {
  let owner: SignerWithAddress, alice: SignerWithAddress;
  let pusd: StableCoin;

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    alice = accounts[1];

    const StableCoin = await ethers.getContractFactory("StableCoin");
    pusd = await StableCoin.deploy();
    await pusd.deployed();
  });

  it("MINTER can mint tokens", async () => {
    await expect(pusd.mint(owner.address, units(1))).to.revertedWith(
      "StableCoin: must have minter role to mint"
    );

    await pusd.grantRole(minter_role, owner.address);
    await pusd.mint(owner.address, units(1));

    expect(await pusd.balanceOf(owner.address)).to.equal(units(1));
  });

  it("PAUSER can pause token transfer", async () => {
    await expect(pusd.pause()).to.revertedWith(
      "StableCoin: must have pauser role to pause"
    );

    await pusd.grantRole(minter_role, owner.address);
    await pusd.mint(owner.address, units(1));
    await pusd.transfer(alice.address, units(1));
    expect(await pusd.balanceOf(alice.address)).to.equal(units(1));

    await pusd.grantRole(pauser_role, owner.address);
    await pusd.pause();

    await expect(pusd.transfer(alice.address, units(1))).to.revertedWith("");
  });

  it("PAUSER can unpause token transfer", async () => {
    await expect(pusd.unpause()).to.revertedWith(
      "StableCoin: must have pauser role to unpause"
    );

    await pusd.grantRole(minter_role, owner.address);
    await pusd.mint(owner.address, units(1));
    await pusd.grantRole(pauser_role, owner.address);
    await pusd.pause();
    await expect(pusd.transfer(alice.address, units(1))).to.revertedWith("");

    await pusd.unpause();
    await pusd.transfer(alice.address, units(1));
    expect(await pusd.balanceOf(alice.address)).to.equal(units(1));
  });
});

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { JPEG } from "../types";
import { units } from "./utils";

const { expect } = chai;

chai.use(solidity);

const minter_role =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

describe("JPEG", () => {
  let minter: SignerWithAddress, user: SignerWithAddress;
  let jpeg: JPEG;

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    minter = accounts[0];
    user = accounts[1];

    const JPEG = await ethers.getContractFactory("JPEG");
    jpeg = await JPEG.deploy(units(1000000000)); // 1B JPEG'd
    await jpeg.deployed();
    await jpeg.grantRole(minter_role, minter.address);
  });

  it("should allow the minter to mint tokens", async () => {
    await jpeg.mint(user.address, units(10));
  });

  it("shouldn't allow users to mint tokens", async () => {
    await expect(jpeg.connect(user).mint(user.address, units(10))).to.be
      .reverted;
  });
});

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { CryptoPunks, JPEG, JPEGLock } from "../types";
import { units, timeTravel, days } from "./utils";

const { expect } = chai;

chai.use(solidity);

describe("JPEGLock", () => {
  let owner: SignerWithAddress, alice: SignerWithAddress;
  let jpeg: JPEG, cryptopunks: CryptoPunks, jpegLock: JPEGLock;

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    alice = accounts[1];

    const JPEG = await ethers.getContractFactory("JPEG");
    jpeg = await JPEG.deploy(units(1000000000)); // 1B JPEG'd
    await jpeg.deployed();

    await jpeg.transfer(alice.address, units(500000000));

    const JPEGLock = await ethers.getContractFactory("JPEGLock");
    jpegLock = await JPEGLock.deploy(jpeg.address);
    await jpegLock.deployed();
  });

  it("should not allow the owner to renounce ownership", async () => {
    await expect(jpegLock.renounceOwnership()).to.be.revertedWith(
      "Cannot renounce ownership"
    );
  });
  
  it("should allow the owner to change lock duration", async () => {
    await expect(jpegLock.setLockTime(0)).to.be.revertedWith("Invalid lock time");
    
    await jpegLock.setLockTime(10);
    expect(await jpegLock.lockTime()).to.equal(10);

    await jpegLock.setLockTime(days(365));
  });

  it("Only owner can lock tokens", async () => {
    await jpeg.connect(alice).approve(jpegLock.address, units(500000000));
    await expect(
      jpegLock.connect(alice).lockFor(alice.address, 0, units(500000000))
    ).to.be.reverted;
    await jpegLock.lockFor(alice.address, 0, units(500000000));
  });

  it("Cannot unlock before 1 year", async () => {
    await jpeg.connect(alice).approve(jpegLock.address, units(500000000));
    await jpegLock.lockFor(alice.address, 0, units(500000000));
    await expect(jpegLock.connect(alice).unlock(0)).to.be.revertedWith(
      "locked"
    );
    await timeTravel(days(365));
    await jpegLock.connect(alice).unlock(0);
    expect(await jpeg.balanceOf(alice.address)).to.equal(units(500000000));
  });

  it("Only position owner can unlock after 1 year", async () => {
    await jpeg.connect(alice).approve(jpegLock.address, units(500000000));
    await jpegLock.lockFor(alice.address, 0, units(500000000));
    await timeTravel(days(365));
    await expect(jpegLock.unlock(0)).to.be.revertedWith("unauthorized");
    await jpegLock.connect(alice).unlock(0);
  });
});

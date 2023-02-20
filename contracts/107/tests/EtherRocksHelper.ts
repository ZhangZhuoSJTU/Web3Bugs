import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, upgrades } from "hardhat";
import { ZERO_ADDRESS } from "./utils";
import { EtherRock, EtherRocksHelper } from "../types";

const { expect } = chai;

chai.use(solidity);

describe("EtherRocksHelper", () => {
  let owner: SignerWithAddress, user: SignerWithAddress;
  let rocks: EtherRock, helper: EtherRocksHelper;

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[1];

    const EtherRocks = await ethers.getContractFactory("EtherRock");
    rocks = await EtherRocks.deploy();
    await rocks.deployed();

    const EtherRocksHelper = await ethers.getContractFactory(
      "EtherRocksHelper"
    );
    helper = <EtherRocksHelper>(
      await upgrades.deployProxy(EtherRocksHelper, [rocks.address])
    );
    await helper.deployed();
  });

  it("should not allow the owner to renounce ownership", async () => {
    await expect(helper.renounceOwnership()).to.be.revertedWith(
      "Cannot renounce ownership"
    );
  });

  it("should return the owner of this contract when the nft is owned by the helper", async () => {
    await rocks.connect(owner).buyRock(0);
    await rocks.giftRock(0, helper.address);
    expect(await helper.ownerOf(0)).to.equal(owner.address);
  });

  it("should return the nft owner in all other cases", async () => {
    await rocks.connect(user).buyRock(0);
    expect(await helper.ownerOf(0)).to.equal(user.address);
  });

  it("should only allow the owner to call transferFrom and safeTransferFrom", async () => {
    await expect(
      helper.connect(user).transferFrom(owner.address, user.address, 1)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      helper.connect(user).safeTransferFrom(owner.address, user.address, 1)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should revert if neither the contract or the precompute address hold the nft", async () => {
    await rocks.connect(user).buyRock(0);
    await expect(
      helper.transferFrom(user.address, owner.address, 1)
    ).to.be.revertedWith("FlashEscrow: call_failed");
  });

  it("should keep the nft if the recipient is the owner", async () => {
    await rocks.connect(user).buyRock(0);
    const { predictedAddress } = await helper.precompute(user.address, 0);
    await rocks.connect(user).giftRock(0, predictedAddress);
    await helper.transferFrom(user.address, owner.address, 0);
    expect((await rocks.getRockInfo(0))[0]).to.equal(helper.address);
    expect(await helper.ownerOf(0)).to.equal(owner.address);
  });

  it("should not allow to buy rocks", async () => {
    await rocks.connect(user).buyRock(0);
    await rocks.connect(user).sellRock(0, 1);
    expect((await rocks.getRockInfo(0))[1]).to.be.true;
    const { predictedAddress } = await helper.precompute(user.address, 0);
    await rocks.connect(user).giftRock(0, predictedAddress);
    await helper.transferFrom(user.address, owner.address, 0);
    expect((await rocks.getRockInfo(0))[1]).to.be.false;
    await expect(rocks.buyRock(0, { value: 1 })).to.be.revertedWith("Not for sale");
  });

  it("should send the nft if the recipient is anyone besides the owner", async () => {
    await rocks.connect(user).buyRock(0);
    const { predictedAddress } = await helper.precompute(user.address, 0);
    await rocks.connect(user).giftRock(0, predictedAddress);
    await helper.transferFrom(user.address, user.address, 0);
    expect((await rocks.getRockInfo(0))[0]).to.equal(user.address);
    expect(await helper.ownerOf(0)).to.equal(user.address);
  });

  it("should allow the owner to send nfts", async () => {
    await rocks.buyRock(0);
    await rocks.giftRock(0, helper.address);
    await helper.safeTransferFrom(owner.address, user.address, 0);
    expect((await rocks.getRockInfo(0))[0]).to.equal(user.address);
    expect(await helper.ownerOf(0)).to.equal(user.address);
  });

  it("can't precompute with the 0 address or the contract as the owner", async () => {
    await expect(helper.precompute(helper.address, 1)).to.be.revertedWith(
      "NFTEscrow: invalid_owner"
    );
    await expect(helper.precompute(ZERO_ADDRESS, 1)).to.be.revertedWith(
      "NFTEscrow: invalid_owner"
    );
  });
});

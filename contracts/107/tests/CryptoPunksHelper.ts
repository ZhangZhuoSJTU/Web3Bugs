import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, upgrades } from "hardhat";
import { ZERO_ADDRESS } from "./utils";
import { CryptoPunks, CryptoPunksHelper } from "../types";

const { expect } = chai;

chai.use(solidity);

describe("CryptoPunksHelper", () => {
  let owner: SignerWithAddress, user: SignerWithAddress;
  let cryptoPunks: CryptoPunks, helper: CryptoPunksHelper;

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    user = accounts[1];

    const CryptoPunks = await ethers.getContractFactory("CryptoPunks");
    cryptoPunks = await CryptoPunks.deploy();
    await cryptoPunks.deployed();

    const CryptoPunksHelper = await ethers.getContractFactory(
      "CryptoPunksHelper"
    );
    helper = <CryptoPunksHelper>(
      await upgrades.deployProxy(CryptoPunksHelper, [cryptoPunks.address])
    );
    await helper.deployed();
  });

  it("should not allow the owner to renounce ownership", async () => {
    await expect(helper.renounceOwnership()).to.be.revertedWith(
      "Cannot renounce ownership"
    );
  });

  it("should return the owner of this contract when the nft is owned by the helper", async () => {
    await cryptoPunks.connect(owner).getPunk(1);
    await cryptoPunks.transferPunk(helper.address, 1);
    expect(await helper.ownerOf(1)).to.equal(owner.address);
  });

  it("should return the nft owner in all other cases", async () => {
    await cryptoPunks.connect(user).getPunk(1);
    expect(await helper.ownerOf(1)).to.equal(user.address);
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
    await cryptoPunks.connect(user).getPunk(1);
    await expect(
      helper.transferFrom(user.address, owner.address, 1)
    ).to.be.revertedWith("FlashEscrow: call_failed");
  });

  it("should keep the nft if the recipient is the owner", async () => {
    await cryptoPunks.connect(user).getPunk(1);
    const { predictedAddress } = await helper.precompute(user.address, 1);
    await cryptoPunks.connect(user).transferPunk(predictedAddress, 1);
    await helper.transferFrom(user.address, owner.address, 1);
    expect(await cryptoPunks.punkIndexToAddress(1)).to.equal(helper.address);
    expect(await helper.ownerOf(1)).to.equal(owner.address);
  });

  it("should send the nft if the recipient is anyone besides the owner", async () => {
    await cryptoPunks.connect(user).getPunk(1);
    const { predictedAddress } = await helper.precompute(user.address, 1);
    await cryptoPunks.connect(user).transferPunk(predictedAddress, 1);
    await helper.transferFrom(user.address, user.address, 1);
    expect(await cryptoPunks.punkIndexToAddress(1)).to.equal(user.address);
    expect(await helper.ownerOf(1)).to.equal(user.address);
  });

  it("should allow the owner to send nfts", async () => {
    await cryptoPunks.getPunk(1);
    await cryptoPunks.transferPunk(helper.address, 1);
    await helper.safeTransferFrom(owner.address, user.address, 1);
    expect(await cryptoPunks.punkIndexToAddress(1)).to.equal(user.address);
    expect(await helper.ownerOf(1)).to.equal(user.address);
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

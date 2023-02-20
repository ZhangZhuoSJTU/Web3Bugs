import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer, utils } from "ethers";
import { TransferService } from "../type/TransferService";
import { Malt } from "../type/Malt";
import { hardhatSnapshot, hardhatRevert } from "./helpers";

const { deployMockContract } = waffle;

describe("MALT Token", function() {
  let accounts: Signer[];
  let owner: Signer;
  let stabilizer: Signer;
  let timelock: Signer;
  let dao: Signer;

  let malt: Malt;
  let snapshotId: string;

  let mockTransferService: TransferService;

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    const MaltFactory = await ethers.getContractFactory("Malt");
    [owner, stabilizer, timelock, dao, ...accounts] = await ethers.getSigners();
    const ownerAddress = await owner.getAddress();
    const timelockAddress = await timelock.getAddress();
    const stabilizerAddress = await stabilizer.getAddress();
    const daoAddress = await dao.getAddress();

    mockTransferService = ((await deployMockContract(owner, [
      "function verifyTransfer(address, address, uint256) returns (bool, string memory)"
    ])) as any) as TransferService;

    await mockTransferService.mock.verifyTransfer.returns(true, "");

    malt = (await MaltFactory.deploy("Malt Stablecoin", "MALT")) as Malt;
    await malt.initialize(
      timelockAddress,
      ownerAddress,
      mockTransferService.address,
      [ownerAddress, daoAddress, stabilizerAddress],
      [stabilizerAddress]
    );
    await malt.deployed();
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("has correct meta data", async function() {
    expect(await malt.name()).to.equal("Malt Stablecoin");
    expect(await malt.symbol()).to.equal("MALT");
    expect(await malt.decimals()).to.equal(18);

    // Supply is zero initially
    expect(await malt.totalSupply()).to.equal(0);
    expect(await malt.transferService()).to.equal(mockTransferService.address);
  });

  it("Allows DAO and Stabilizer to mint tokens", async function() {
    const mintAmount = 100;
    const ownerAddress = await owner.getAddress();
    await malt.connect(dao).mint(ownerAddress, mintAmount);
    await malt.connect(stabilizer).mint(ownerAddress, mintAmount);

    expect(await malt.totalSupply()).to.equal(mintAmount * 2);
    expect(await malt.balanceOf(ownerAddress)).to.equal(mintAmount * 2);
  });

  it("fails to mint without privilege", async function() {
    const mintAmount = 100;
    const otherAccount = accounts[0];
    const otherAddress = await otherAccount.getAddress();

    await expect(malt.connect(otherAddress).mint(otherAddress, mintAmount)).to.be.reverted;
  });

  it("fails to transfer when no balance", async function() {
    const otherAccount = accounts[0];
    const ownerAddress = await owner.getAddress();
    const otherAddress = await otherAccount.getAddress();

    await expect(malt.transfer(otherAddress, 100)).to.be.reverted;
  });

  it("successfully transfers", async function() {
    const mintAmount = 100;
    const otherAccount = accounts[0];
    const ownerAddress = await owner.getAddress();
    const otherAddress = await otherAccount.getAddress();

    expect(await malt.balanceOf(otherAddress)).to.equal(0);

    await malt.connect(stabilizer).mint(ownerAddress, mintAmount);
    await malt.transfer(otherAddress, mintAmount);

    expect(await malt.balanceOf(ownerAddress)).to.equal(0);
    expect(await malt.balanceOf(otherAddress)).to.equal(mintAmount);
  });

  it("fails transferFrom without approval", async function() {
    const mintAmount = 100;
    const otherAccount = accounts[0];
    const ownerAddress = await owner.getAddress();
    const otherAddress = await otherAccount.getAddress();

    await malt.connect(stabilizer).mint(ownerAddress, mintAmount);

    await expect(malt.transferFrom(ownerAddress, otherAddress, mintAmount)).to.be.reverted;
  });

  it("transfers after approval", async function() {
    const mintAmount = 100;
    const otherAccount = accounts[0];
    const ownerAddress = await owner.getAddress();
    const otherAddress = await otherAccount.getAddress();

    await malt.connect(stabilizer).mint(ownerAddress, mintAmount);

    await malt.approve(otherAddress, mintAmount);

    const val = await malt.allowance(ownerAddress, otherAddress);

    expect(val).to.equal(mintAmount);

    await malt.connect(otherAccount).transferFrom(ownerAddress, otherAddress, mintAmount);

    expect(await malt.balanceOf(ownerAddress)).to.equal(0);
    expect(await malt.balanceOf(otherAddress)).to.equal(mintAmount);
  });

  it("fails transferFrom without sufficient balance", async function() {
    const mintAmount = 100;
    const otherAccount = accounts[0];
    const ownerAddress = await owner.getAddress();
    const otherAddress = await otherAccount.getAddress();

    await malt.connect(stabilizer).mint(ownerAddress, mintAmount);

    await malt.approve(otherAddress, mintAmount);

    await expect(
      malt.connect(otherAccount).transferFrom(ownerAddress, otherAddress, mintAmount * 2)
    ).to.be.reverted;
  });

  it("DAO can burn tokens", async function() {
    const mintAmount = 100;
    const ownerAddress = await owner.getAddress();

    await malt.connect(stabilizer).mint(ownerAddress, mintAmount);

    expect(await malt.totalSupply()).to.equal(mintAmount);

    await malt.connect(stabilizer).burn(ownerAddress, mintAmount);

    expect(await malt.totalSupply()).to.equal(0);
  });

  it("Other account cannot burn tokens", async function() {
    const mintAmount = 100;
    const ownerAddress = await owner.getAddress();
    const otherAccount = accounts[0];
    const otherAddress = await otherAccount.getAddress();

    await malt.connect(stabilizer).mint(otherAddress, mintAmount);

    expect(await malt.totalSupply()).to.equal(mintAmount);

    await expect(malt.connect(otherAccount).burn(otherAddress, mintAmount)).to.be.reverted;

    expect(await malt.totalSupply()).to.equal(mintAmount);
  });

  it("TransferService returning false on verify reverts transfers", async function() {
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();

    await malt.connect(stabilizer).mint(userOneAddress, utils.parseEther('1000000'));

    // Should succeed
    await malt.connect(user1).transfer(userTwoAddress, utils.parseEther('10'));

    // Verify now returns false
    const msg = "Failed 1"
    await mockTransferService.mock.verifyTransfer.returns(false, msg);

    // Same transfer now fails
    await expect(malt.connect(user1).transfer(userTwoAddress, utils.parseEther('10'))).to.be.revertedWith(msg);
  });

  it("TransferService returning false on verify reverts minting", async function() {
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();

    // Works fine
    await malt.connect(stabilizer).mint(userOneAddress, utils.parseEther('1000000'));

    // Verify now returns false
    const msg = "Failed 2"
    await mockTransferService.mock.verifyTransfer.returns(false, msg);

    // Minting now fails
    await expect(malt.connect(stabilizer).mint(userOneAddress, utils.parseEther('1000000'))).to.be.revertedWith(msg);
  });

  it("TransferService returning false on verify reverts minting", async function() {
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();
    await malt.connect(stabilizer).mint(userOneAddress, utils.parseEther('1000000'));

    // Works fine
    await malt.connect(stabilizer).burn(userOneAddress, utils.parseEther('10'));

    // Verify now returns false
    const msg = "Failed 3"
    await mockTransferService.mock.verifyTransfer.returns(false, msg);

    // Burning now fails
    await expect(malt.connect(stabilizer).burn(userOneAddress, utils.parseEther('10'))).to.be.revertedWith(msg);
  });

  it("Allows admins to set new TransferService contract", async function() {
    const [newContract, newContract2, user, user2] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(malt.connect(user).setTransferService(newAddress)).to.be.reverted;
    await expect(malt.connect(user2).setTransferService(newAddress)).to.be.reverted;

    await malt.setTransferService(newAddress);
    expect(await malt.transferService()).to.equal(newAddress);

    await malt.setTransferService(new2Address);
    expect(await malt.transferService()).to.equal(new2Address);
  });
});

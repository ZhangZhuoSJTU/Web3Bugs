import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { MaltDAO } from "../type/MaltDAO";
import { Malt } from "../type/Malt";
import { TransferService } from "../type/TransferService";
import { ERC20 } from "../type/ERC20";
import { ContractFactory, constants, utils, Contract, BigNumber } from 'ethers';
import { hardhatSnapshot, hardhatRevert, increaseTime } from "./helpers";
import IERC20 from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import MaltArtifacts from "../artifacts/contracts/Malt.sol/Malt.json";

const { deployMockContract } = waffle;

describe("DAO", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;
  let offering: Signer;

  let dao: MaltDAO;
  let malt: ERC20;
  let snapshotId: string;

  let epochLength = 60 * 30; // 30 minutes
  let genesisTime = Math.floor(new Date().getTime() / 1000);
  let offeringMint = utils.parseEther('10000000');
  let mockTransferService: TransferService;

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, admin, offering, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const offeringAddress = await offering.getAddress();

    mockTransferService = ((await deployMockContract(owner, [
      "function verifyTransfer(address, address, uint256) returns (bool, string memory)"
    ])) as any) as TransferService;
    await mockTransferService.mock.verifyTransfer.returns(true, "");

    const ERC20Factory = await ethers.getContractFactory("Malt");

    // Deploy ERC20 tokens
    malt = (await ERC20Factory.deploy("Malt Stablecoin", "MALT")) as Malt;

    // Deploy the MaltDAO
    const MaltDAOFactory = await ethers.getContractFactory("MaltDAO");

    dao = (await MaltDAOFactory.deploy()) as MaltDAO;

    await malt.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress, dao.address], []);
    await malt.deployed();

    expect(await malt.balanceOf(offeringAddress)).to.equal(0);

    await dao.initialize(
      ownerAddress,
      adminAddress,
      malt.address,
      epochLength,
      genesisTime,
      offeringAddress,
      offeringMint
    );
    await dao.deployed();

    expect(await malt.balanceOf(offeringAddress)).to.equal(offeringMint);
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Has correct initial conditions", async function() {
    expect(await dao.malt()).to.equal(malt.address);
    expect(await dao.epoch()).to.equal(0);
    expect(await dao.epochLength()).to.equal(epochLength);
    expect(await dao.genesisTime()).to.equal(genesisTime);
    expect(await dao.advanceIncentive()).to.equal(100);
  });

  it("Reverts when calling advance too early", async function() {
    await expect(dao.advance()).to.be.reverted;

    await increaseTime(epochLength);

    expect(await dao.epoch()).to.equal(0);
    await dao.advance();
    expect(await dao.epoch()).to.equal(1);
  });

  it("Mints incentive to caller of advance", async function() {
    const ownerAddress = await owner.getAddress();
    await increaseTime(epochLength);

    const initialBalance = await malt.balanceOf(ownerAddress);
    await dao.advance();
    // Increased by 100 Malt
    expect(await malt.balanceOf(ownerAddress)).to.equal(initialBalance.add(utils.parseEther('100')));
  });

  it("Returns correct start time for epoch 0", async function() {
    expect(await dao.getEpochStartTime(0)).to.equal(genesisTime);
  });

  it("Returns correct start time for epoch 10", async function() {
    const desiredEpoch = 10;
    const diff = desiredEpoch * epochLength;
    expect(await dao.getEpochStartTime(desiredEpoch)).to.equal(genesisTime + diff);
  });

  it("Correctly returns the number of epochs per year", async function() {
    // 17532 is number of epochs when epoch length is 30mins
    expect(await dao.epochsPerYear()).to.equal(17532);
  });

  it("Only timelock can call mint on DAO", async function() {
    const [user1, user2, dest] = accounts;
    const destAddress = await dest.getAddress();
    const amount = utils.parseEther('1000');

    await expect(dao.connect(user1).mint(destAddress, amount)).to.be.reverted;
    await expect(dao.connect(user2).mint(destAddress, amount)).to.be.reverted;

    const initialBalance = await malt.balanceOf(destAddress);

    await dao.connect(owner).mint(destAddress, amount);

    expect(await malt.balanceOf(destAddress)).to.equal(initialBalance.add(amount));
  });

  it("Disallows minting 0 amount", async function() {
    const [user1, user2, dest] = accounts;
    const destAddress = await dest.getAddress();
    const amount = utils.parseEther('0');

    await expect(dao.connect(owner).mint(destAddress, amount)).to.be.revertedWith("Cannot have zero amount");
  });

  it("Only allows admin to set Malt token", async function() {
    const [newContract, newContract2, user, user2] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(dao.connect(user).setMaltToken(newAddress)).to.be.reverted;
    await expect(dao.connect(user2).setMaltToken(newAddress)).to.be.reverted;

    await dao.connect(admin).setMaltToken(newAddress);
    expect(await dao.malt()).to.equal(newAddress);

    await dao.setMaltToken(new2Address);
    expect(await dao.malt()).to.equal(new2Address);
  });

  it("It only allows admins to update epoch length", async function() {
    expect(await dao.epochLength()).to.equal(epochLength);

    const [user, user2] = accounts;

    await expect( dao.connect(user).setEpochLength(10)).to.be.reverted;
    await expect( dao.connect(user2).setEpochLength(10)).to.be.reverted;

    const newEpochLength = 356;
    await dao.connect(admin).setEpochLength(newEpochLength);
    expect(await dao.epochLength()).to.equal(newEpochLength);

    // Default signer has the Timelock role
    await dao.setEpochLength(422);
    expect(await dao.epochLength()).to.equal(422);
  });
});

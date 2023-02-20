import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import ms from "ms";
import { BOOST_CONFIG } from "../../../config/deployment";
import {
  AccessController,
  AddressProvider,
  GovernanceAddressProvider,
  MockMIMO,
  PAR,
  VotingEscrow,
  VotingMinerV2,
} from "../../../typechain-types";

const { timeAndMine } = require("hardhat");

const MINT_AMOUNT = ethers.BigNumber.from("1000000000000000000000"); // 1000 GOV
const STAKE_AMOUNT = ethers.BigNumber.from("100000000000000000000"); // 100 GOV

const ONE_WEEK = ethers.BigNumber.from(ms("1 week")).div(1000);
const ONE_MONTH = ethers.BigNumber.from(ms("4 weeks")).div(1000);

const setup = deployments.createFixture(async () => {
  await deployments.fixture(["SetCore", "SetGovernance"]);
  const { deploy } = deployments;
  const [owner, manager, voter, voter2] = await ethers.getSigners();
  const controller: AccessController = await ethers.getContract("AccessController");
  const a: AddressProvider = await ethers.getContract("AddressProvider");
  const ga: GovernanceAddressProvider = await ethers.getContract("GovernanceAddressProvider");
  const mimo: MockMIMO = await ethers.getContract("MockMIMO");
  const stablex: PAR = await ethers.getContract("PAR");
  const escrow: VotingEscrow = await ethers.getContract("VotingEscrow");

  const managerRole = await controller.MANAGER_ROLE();
  const minterRole = await controller.MINTER_ROLE();
  await controller.grantRole(managerRole, manager.address);
  await controller.grantRole(minterRole, owner.address);

  await deploy("VotingMinerV2", {
    from: owner.address,
    args: [ga.address, BOOST_CONFIG],
  });
  const miner: VotingMinerV2 = await ethers.getContract("VotingMinerV2");

  await escrow.setMiner(miner.address);

  // Mint and approve escrow to create lock
  await mimo.mint(voter.address, STAKE_AMOUNT);
  await mimo.mint(voter2.address, STAKE_AMOUNT);
  await mimo.connect(voter).approve(escrow.address, STAKE_AMOUNT);
  await mimo.connect(voter2).approve(escrow.address, STAKE_AMOUNT);

  const latestBlock = await ethers.provider.getBlock("latest");
  const startTime = ethers.BigNumber.from(latestBlock.timestamp);

  return {
    owner,
    manager,
    voter,
    voter2,
    controller,
    a,
    ga,
    miner,
    mimo,
    escrow,
    managerRole,
    startTime,
    stablex,
  };
});

const setup2 = deployments.createFixture(async () => {
  await deployments.fixture(["SetCore", "SetGovernance"]);
  const { deploy } = deployments;
  const [owner, manager, voter, voter2] = await ethers.getSigners();
  const controller: AccessController = await ethers.getContract("AccessController");
  const ga: GovernanceAddressProvider = await ethers.getContract("GovernanceAddressProvider");
  const mimo: MockMIMO = await ethers.getContract("MockMIMO");
  const escrow: VotingEscrow = await ethers.getContract("VotingEscrow");
  const stablex: PAR = await ethers.getContract("PAR");

  const managerRole = await controller.MANAGER_ROLE();
  const minterRole = await controller.MINTER_ROLE();
  await controller.grantRole(managerRole, manager.address);
  await controller.grantRole(minterRole, owner.address);

  await deploy("VotingMinerV2", {
    from: owner.address,
    args: [ga.address, BOOST_CONFIG],
  });
  const miner: VotingMinerV2 = await ethers.getContract("VotingMinerV2");

  // Mint and approve escrow to create lock
  await mimo.mint(voter.address, STAKE_AMOUNT);
  await mimo.mint(voter2.address, STAKE_AMOUNT);
  await mimo.connect(voter).approve(escrow.address, STAKE_AMOUNT);
  await mimo.connect(voter2).approve(escrow.address, STAKE_AMOUNT);

  const latestBlock = await ethers.provider.getBlock("latest");
  const startTime = ethers.BigNumber.from(latestBlock.timestamp);

  return {
    voter,
    miner,
    escrow,
    startTime,
    mimo,
    stablex,
  };
});

describe("--- VotingMinerV2 ---", async () => {
  it("initialized VotingMiner correctly", async () => {
    const { mimo, miner, voter } = await setup();
    const balance = await mimo.balanceOf(miner.address);
    assert.equal(balance.toString(), "0");

    const totalStake = await miner.totalStake();
    assert.equal(totalStake.toString(), "0");

    const stake = await miner.stake(voter.address);
    assert.equal(stake.toString(), "0");
  });
  it("stake should update correctly when creating lock", async () => {
    const { escrow, startTime, voter, miner, voter2 } = await setup();
    await escrow.connect(voter).createLock(STAKE_AMOUNT, startTime.add(ONE_WEEK));
    let totalStake = await miner.totalStake();
    const votingPower = await escrow.balanceOf(voter.address);
    const stake = await miner.stake(voter.address);

    assert.equal(votingPower.toString(), totalStake.toString());
    assert.equal(votingPower.toString(), stake.toString());

    await escrow.connect(voter2).createLock(STAKE_AMOUNT, startTime.add(ONE_MONTH));

    totalStake = await miner.totalStake();
    const votingPower2 = await escrow.balanceOf(voter2.address);
    const stake2 = await miner.stake(voter2.address);
    assert.equal(votingPower.add(votingPower2).toString(), totalStake.toString());
    assert.equal(votingPower2.toString(), stake2.toString());
  });
  it("stake should update correctly when increase lock length", async () => {
    const { startTime, escrow, voter, miner } = await setup();
    const lockEnd = startTime.add(ONE_WEEK);
    await escrow.connect(voter).createLock(STAKE_AMOUNT, lockEnd);
    await escrow.connect(voter).increaseLockLength(startTime.add(ONE_WEEK.mul(ethers.BigNumber.from(2))));

    const votingPower = await escrow.balanceOf(voter.address);
    const stake = await miner.stake(voter.address);
    const totalStake = await miner.totalStake();

    assert.equal(votingPower.toString(), stake.toString());
    assert.equal(votingPower.toString(), totalStake.toString());
  });
  it("stake should update correctly when increase lock amount", async () => {
    const { startTime, escrow, mimo, voter, miner } = await setup();
    const lockEnd = startTime.add(ONE_WEEK);
    await escrow.connect(voter).createLock(STAKE_AMOUNT, lockEnd);

    await mimo.mint(voter.address, STAKE_AMOUNT);
    await mimo.connect(voter).approve(escrow.address, STAKE_AMOUNT);
    await escrow.connect(voter).increaseLockAmount(STAKE_AMOUNT);

    const votingPower = await escrow.balanceOf(voter.address);
    const stake = await miner.stake(voter.address);
    const totalStake = await miner.totalStake();

    assert.equal(votingPower.toString(), stake.toString());
    assert.equal(votingPower.toString(), totalStake.toString());
  });
  it("should releaseMIMO correctly", async () => {
    const { mimo, escrow, miner, startTime, voter, voter2 } = await setup();
    await mimo.mint(miner.address, MINT_AMOUNT);
    await escrow.connect(voter).createLock(STAKE_AMOUNT, startTime.add(ONE_MONTH));

    let balance = await mimo.balanceOf(voter.address);
    assert.equal(balance.toString(), "0");

    await miner.connect(voter).releaseMIMO(voter.address);
    balance = await mimo.balanceOf(voter.address);
    assert.equal(balance.toString(), MINT_AMOUNT.toString());

    await escrow.connect(voter2).createLock(STAKE_AMOUNT, startTime.add(ONE_MONTH));
    balance = await mimo.balanceOf(voter.address);
    assert.equal(balance.toString(), MINT_AMOUNT.toString());

    await mimo.mint(miner.address, MINT_AMOUNT);
    await miner.connect(voter).releaseMIMO(voter.address);
    balance = await mimo.balanceOf(voter.address);

    assert.equal(
      balance.div(ethers.BigNumber.from(1e15)).toString(),
      ethers.BigNumber.from("1500000000000000000000").div(ethers.BigNumber.from(1e15)).toString(),
    );
    await timeAndMine.setTime(startTime.add(ONE_WEEK.mul(3)).toNumber());
    await timeAndMine.mine(1);
    await miner.connect(voter).releaseMIMO(voter.address);
    await mimo.mint(miner.address, MINT_AMOUNT);
    await miner.connect(voter).releaseMIMO(voter.address);
    balance = await mimo.balanceOf(voter.address);
    expect(balance.div(ethers.BigNumber.from(1e15)).toNumber()).to.be.closeTo(
      ethers.BigNumber.from("1700000").toNumber(),
      1,
    );
  });
  it("should releasePAR correctly", async () => {
    const { stablex, escrow, miner, startTime, voter, voter2 } = await setup();
    await stablex.mint(miner.address, MINT_AMOUNT);
    await escrow.connect(voter).createLock(STAKE_AMOUNT, startTime.add(ONE_MONTH));

    let balance = await stablex.balanceOf(voter.address);
    assert.equal(balance.toString(), "0");

    await miner.connect(voter).releaseMIMO(voter.address);
    balance = await stablex.balanceOf(voter.address);
    assert.equal(balance.toString(), MINT_AMOUNT.toString());

    await escrow.connect(voter2).createLock(STAKE_AMOUNT, startTime.add(ONE_MONTH));
    balance = await stablex.balanceOf(voter.address);
    assert.equal(balance.toString(), MINT_AMOUNT.toString());

    await stablex.mint(miner.address, MINT_AMOUNT);
    await miner.connect(voter).releaseMIMO(voter.address);
    balance = await stablex.balanceOf(voter.address);

    assert.equal(
      balance.div(ethers.BigNumber.from(1e15)).toString(),
      ethers.BigNumber.from("1500000000000000000000").div(ethers.BigNumber.from(1e15)).toString(),
    );
    await timeAndMine.setTime(startTime.add(ONE_WEEK.mul(3)).toNumber());
    await timeAndMine.mine(1);
    await miner.connect(voter).releaseMIMO(voter.address);
    await stablex.mint(miner.address, MINT_AMOUNT);
    await miner.connect(voter).releaseMIMO(voter.address);
    balance = await stablex.balanceOf(voter.address);
    expect(balance.div(ethers.BigNumber.from(1e15)).toNumber()).to.be.closeTo(
      ethers.BigNumber.from("1700000").toNumber(),
      1,
    );
  });
  it("should be able to syncStake correctly", async () => {
    const { miner, voter, escrow, startTime } = await setup2();
    await escrow.connect(voter).createLock(STAKE_AMOUNT, startTime.add(ONE_WEEK));
    const voterInfoBeforeSync = await miner.userInfo(voter.address);
    const tx = await miner.syncStake(voter.address);
    const receipt = await tx.wait(1);
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    const { timestamp } = block;
    const voterEscrowBalance = await escrow.balanceOfAt(voter.address, timestamp);
    const voterInfoAfterSync = await miner.userInfo(voter.address);
    const totalStake = await miner.totalStake();

    assert.notEqual(voterEscrowBalance.toString(), "0");
    assert.equal(voterInfoBeforeSync.stake.toString(), "0");
    assert.equal(voterInfoAfterSync.stake.toString(), voterEscrowBalance.toString());
    assert.equal(totalStake.toString(), voterEscrowBalance.toString());
    assert.notEqual(voterInfoAfterSync.stakeWithBoost.toString(), "0");
    assert.equal(voterInfoAfterSync.accAmountPerShare.toString(), "0");
    assert.equal(voterInfoAfterSync.accParAmountPerShare.toString(), "0");
  });
  it("should updated state correclty if syncStake called when existing stake", async () => {
    const { miner, voter, escrow, startTime, mimo, stablex } = await setup2();
    await escrow.setMiner(miner.address);
    mimo.mint(miner.address, 100);
    stablex.mint(miner.address, 100);
    await escrow.connect(voter).createLock(STAKE_AMOUNT, startTime.add(ONE_WEEK));
    const voterInfoBeforeSync = await miner.userInfo(voter.address);
    const tx = await miner.syncStake(voter.address);
    const receipt = await tx.wait(1);
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    const { timestamp } = block;
    const voterInfoAfterSync = await miner.userInfo(voter.address);
    const totalStake = await miner.totalStake();
    const voterEscrowBalance = await escrow.balanceOfAt(voter.address, timestamp);

    assert.equal(voterEscrowBalance.toString(), totalStake.toString());
    assert.equal(voterEscrowBalance.toString(), voterInfoAfterSync.stake.toString());
    assert.equal(voterInfoBeforeSync.accAmountPerShare.toString(), voterInfoAfterSync.accAmountPerShare.toString());
    assert.equal(
      voterInfoBeforeSync.accParAmountPerShare.toString(),
      voterInfoAfterSync.accParAmountPerShare.toString(),
    );
  });
});

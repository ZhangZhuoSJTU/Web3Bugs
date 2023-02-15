import {
  AccessControllerInstance,
  VotingEscrowInstance,
  GovernanceAddressProviderInstance,
  AddressProviderInstance,
  VotingMinerInstance,
  MIMOInstance,
} from "../../types/truffle-contracts";
import { setupMIMO } from "../utils/helpers";

const { BN, time } = require("@openzeppelin/test-helpers");

const AccessController = artifacts.require("AccessController");
const GovernanceAddressProvider = artifacts.require("GovernanceAddressProvider");
const AddressProvider = artifacts.require("AddressProvider");
const VotingEscrow = artifacts.require("VotingEscrow");
const VotingMiner = artifacts.require("VotingMiner");

const MINT_AMOUNT = new BN("1000000000000000000000"); // 1000 GOV
const STAKE_AMOUNT = new BN("100000000000000000000"); // 100 GOV
const ONE_WEEK = time.duration.weeks(1);
const ONE_MONTH = time.duration.weeks(4);
const NAME = "MIMO Voting Power";
const SYMBOL = "vMIMO";

contract("VotingMiner", (accounts) => {
  const [owner, manager, voter, voter2] = accounts;

  let controller: AccessControllerInstance;
  let a: AddressProviderInstance;
  let ga: GovernanceAddressProviderInstance;
  let escrow: VotingEscrowInstance;
  let miner: VotingMinerInstance;
  let mimo: MIMOInstance;
  let startTime: any;

  beforeEach(async () => {
    controller = await AccessController.new();
    a = await AddressProvider.new(controller.address);
    ga = await GovernanceAddressProvider.new(a.address);
    miner = await VotingMiner.new(ga.address);
    mimo = await setupMIMO(a.address, controller, owner, [owner]);

    escrow = await VotingEscrow.new(mimo.address, ga.address, miner.address, NAME, SYMBOL);

    await ga.setMIMO(mimo.address);
    await ga.setVotingEscrow(escrow.address);

    const managerRole = await controller.MANAGER_ROLE();
    await controller.grantRole(managerRole, manager);

    // Mint and approve escrow to create lock
    await mimo.mint(voter, STAKE_AMOUNT);
    await mimo.mint(voter2, STAKE_AMOUNT);
    await mimo.approve(escrow.address, STAKE_AMOUNT, { from: voter });
    await mimo.approve(escrow.address, STAKE_AMOUNT, { from: voter2 });

    startTime = await time.latest();
  });

  it("initialized VotingMiner correctly", async () => {
    const balance = await mimo.balanceOf(miner.address);
    assert.equal(balance.toString(), "0");

    const totalStake = await miner.totalStake();
    assert.equal(totalStake.toString(), "0");

    const stake = await miner.stake(voter);
    assert.equal(stake.toString(), "0");
  });

  it("stake should update correctly when creating lock", async () => {
    await escrow.createLock(STAKE_AMOUNT, startTime.add(ONE_WEEK), { from: voter });

    let totalStake = await miner.totalStake();
    const votingPower = await escrow.balanceOf(voter);
    const stake = await miner.stake(voter);

    assert.equal(votingPower.toString(), totalStake.toString());
    assert.equal(votingPower.toString(), stake.toString());

    await escrow.createLock(STAKE_AMOUNT, startTime.add(ONE_MONTH), { from: voter2 });

    totalStake = await miner.totalStake();
    const votingPower2 = await escrow.balanceOf(voter2);
    const stake2 = await miner.stake(voter2);
    assert.equal(votingPower.add(votingPower2).toString(), totalStake.toString());
    assert.equal(votingPower2.toString(), stake2.toString());
  });

  it("stake should update correctly when increase lock length", async () => {
    const lockEnd = startTime.add(ONE_WEEK);
    await escrow.createLock(STAKE_AMOUNT, lockEnd, { from: voter });
    await escrow.increaseLockLength(startTime.add(ONE_WEEK.mul(new BN(2))), { from: voter });

    const votingPower = await escrow.balanceOf(voter);
    const stake = await miner.stake(voter);
    const totalStake = await miner.totalStake();

    assert.equal(votingPower.toString(), stake.toString());
    assert.equal(votingPower.toString(), totalStake.toString());
  });

  it("stake should update correctly when increase lock amount", async () => {
    const lockEnd = startTime.add(ONE_WEEK);
    await escrow.createLock(STAKE_AMOUNT, lockEnd, { from: voter });

    await mimo.mint(voter, STAKE_AMOUNT);
    await mimo.approve(escrow.address, STAKE_AMOUNT, { from: voter });
    await escrow.increaseLockAmount(STAKE_AMOUNT, { from: voter });

    const votingPower = await escrow.balanceOf(voter);
    const stake = await miner.stake(voter);
    const totalStake = await miner.totalStake();

    assert.equal(votingPower.toString(), stake.toString());
    assert.equal(votingPower.toString(), totalStake.toString());
  });

  it("should releaseMIMO correctly", async () => {
    await mimo.mint(miner.address, MINT_AMOUNT);
    await escrow.createLock(STAKE_AMOUNT, startTime.add(ONE_MONTH), { from: voter });

    let balance = await mimo.balanceOf(voter);
    assert.equal(balance.toString(), "0");

    await miner.releaseMIMO(voter, { from: voter });
    balance = await mimo.balanceOf(voter);
    assert.equal(balance.toString(), MINT_AMOUNT.toString());

    await escrow.createLock(STAKE_AMOUNT, startTime.add(ONE_MONTH), { from: voter2 });
    balance = await mimo.balanceOf(voter);
    assert.equal(balance.toString(), MINT_AMOUNT.toString());

    await mimo.mint(miner.address, MINT_AMOUNT);
    await miner.releaseMIMO(voter, { from: voter });
    balance = await mimo.balanceOf(voter);
    assert.equal(balance.div(new BN(1e15)).toString(), new BN("1500000000000000000000").div(new BN(1e15)).toString());

    await time.increaseTo(startTime.add(ONE_WEEK.muln(3)));
    await miner.releaseMIMO(voter, { from: voter });
    await mimo.mint(miner.address, MINT_AMOUNT);
    await miner.releaseMIMO(voter, { from: voter });
    balance = await mimo.balanceOf(voter);
    assert.equal(balance.div(new BN(1e15)).toString(), "1700000");
  });
});

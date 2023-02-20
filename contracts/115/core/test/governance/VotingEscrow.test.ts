import {
  AccessControllerInstance,
  VotingEscrowInstance,
  MockMIMOInstance,
  GovernanceAddressProviderInstance,
  AddressProviderInstance,
  VotingMinerInstance,
  MIMOInstance,
} from "../../types/truffle-contracts";
import { setupMIMO } from "../utils/helpers";

const { BN, expectEvent, expectRevert, time } = require("@openzeppelin/test-helpers");

const AccessController = artifacts.require("AccessController");
const GovernanceAddressProvider = artifacts.require("GovernanceAddressProvider");
const AddressProvider = artifacts.require("AddressProvider");
const MockMIMO = artifacts.require("MockMIMO");
const VotingEscrow = artifacts.require("VotingEscrow");
const VotingMiner = artifacts.require("VotingMiner");

const MINT_AMOUNT = new BN("1000000000000000000000"); // 1000 GOV
const STAKE_AMOUNT = new BN("100000000000000000000"); // 100 GOV
const ONE_WEEK = time.duration.weeks(1);
const ONE_MONTH = time.duration.weeks(4);
const FOUR_YEARS = time.duration.years(4);
const BUFFER = time.duration.minutes(1);
const NAME = "MIMO Voting Power";
const SYMBOL = "vMIMO";

contract("VotingEscrow", (accounts) => {
  const [owner, manager, voter, poorVoter] = accounts;

  let controller: AccessControllerInstance;
  let a: AddressProviderInstance;
  let ga: GovernanceAddressProviderInstance;
  let stakingToken: MockMIMOInstance;
  let escrow: VotingEscrowInstance;
  let votingMiner: VotingMinerInstance;
  let mimo: MIMOInstance;
  let startTime: any;

  beforeEach(async () => {
    controller = await AccessController.new();
    a = await AddressProvider.new(controller.address);
    ga = await GovernanceAddressProvider.new(a.address);
    stakingToken = await MockMIMO.new();
    votingMiner = await VotingMiner.new(ga.address);
    escrow = await VotingEscrow.new(stakingToken.address, ga.address, votingMiner.address, NAME, SYMBOL);

    mimo = await setupMIMO(a.address, controller, owner, [owner]);
    await ga.setMIMO(mimo.address);
    await ga.setVotingEscrow(escrow.address);

    const managerRole = await controller.MANAGER_ROLE();
    await controller.grantRole(managerRole, manager);

    startTime = await time.latest();

    // Mint and approve escrow to create lock
    await stakingToken.mint(voter, MINT_AMOUNT);
    await stakingToken.approve(escrow.address, STAKE_AMOUNT, { from: voter });
  });

  it("Initializes correctly", async () => {
    const name = await escrow.name();
    const symbol = await escrow.symbol();
    const decimals = await escrow.decimals();
    assert.equal(name, NAME);
    assert.equal(symbol, SYMBOL);
    assert.equal(decimals.toNumber(), 18);

    const maxtime = await escrow.MAXTIME();
    assert.equal(maxtime.toString(), FOUR_YEARS.toString());

    const miner = await escrow.miner();
    assert.equal(miner, votingMiner.address);

    const minimumLockTime = await escrow.minimumLockTime();
    assert.equal(minimumLockTime, time.duration.days(1).toString());
  });

  it("Cannot create lock when not enough balance", async () => {
    const currentVotingPower = await stakingToken.balanceOf(poorVoter);
    assert.equal(currentVotingPower.toNumber(), 0);

    await expectRevert(
      escrow.createLock(STAKE_AMOUNT, startTime.add(ONE_WEEK), { from: poorVoter }),
      "ERC20: transfer amount exceeds balance",
    );
  });

  it("Cannot create lock when under 1 day", async () => {
    await expectRevert(
      escrow.createLock(STAKE_AMOUNT, startTime.add(BUFFER), { from: voter }),
      "Lock duration should be larger than minimum locktime",
    );
  });

  it("Can create lock", async () => {
    const stakingTokenAllowance = await stakingToken.allowance(voter, escrow.address);
    assert(stakingTokenAllowance.eq(STAKE_AMOUNT));
    const beforeVotingPower = await escrow.balanceOf(voter);
    assert(beforeVotingPower.isZero());

    const lockEnd = startTime.add(ONE_WEEK);
    await escrow.createLock(STAKE_AMOUNT, lockEnd, { from: voter });

    const lock = await escrow.locked(voter);
    assert.equal(lock[0].toString(), STAKE_AMOUNT.toString());
    assert.equal(lock[1].toString(), lockEnd.toString());

    const afterVotingPower = await escrow.balanceOf(voter);
    assert(afterVotingPower.gt(new BN(0)));
  });

  it("Voting Power should be calculated correctly", async () => {
    const maxtime = await escrow.MAXTIME();
    const stakingTokenAllowance = await stakingToken.allowance(voter, escrow.address);
    assert(stakingTokenAllowance.eq(STAKE_AMOUNT));
    const beforeVotingPower = await escrow.balanceOf(voter);
    assert(beforeVotingPower.isZero());

    const locktime = startTime.add(maxtime.mul(new BN(2)));
    await escrow.createLock(STAKE_AMOUNT, locktime, { from: voter });

    assert.equal((await escrow.balanceOf(voter)).toString(), STAKE_AMOUNT.toString());

    const tests = [
      [locktime.sub(maxtime), STAKE_AMOUNT],
      [locktime.sub(maxtime.div(new BN(2))), STAKE_AMOUNT.div(new BN(2))],
      [locktime.sub(maxtime.div(new BN(50))), STAKE_AMOUNT.div(new BN(50))],
    ];

    // Const lock = await escrow.locked(voter);
    // console.log("latest: %s", latest);
    // console.log("MAXTIME: %s", maxtime);
    // console.log("lock.amount %s, lock.end %s", lock[0], lock[1]);

    for (const test of tests) {
      const timestamp = test[0];
      const expectedVotingPower = test[1];
      const actualVotingPower = await escrow.balanceOfAt(voter, timestamp);

      // Console.log("balanceOfAt(voter, %s); expected: %s; actual: %s", timestamp, expectedVotingPower, actualVotingPower);
      assert.equal(actualVotingPower.toString(), expectedVotingPower.toString());
    }
  });

  it("should be able to increase the lock length into the future", async () => {
    await escrow.createLock(STAKE_AMOUNT, startTime.add(ONE_WEEK), { from: voter });
    const oneWeekVotingPower = await escrow.balanceOf(voter);

    await escrow.increaseLockLength(startTime.add(ONE_WEEK.mul(new BN(2))), { from: voter });
    const twoWeekVotingPower = await escrow.balanceOf(voter);
    assert(twoWeekVotingPower.gt(oneWeekVotingPower));
  });

  it("should NOT be able to decrease the lock length into the past", async () => {
    await escrow.createLock(STAKE_AMOUNT, startTime.add(ONE_MONTH), { from: voter });

    await expectRevert(
      escrow.increaseLockLength(startTime.sub(ONE_WEEK), { from: voter }),
      "Can only increase lock time",
    );
  });

  it.skip("should NOT be able to overwrite existing lock");

  it("should be able to increase the number of locked tokens", async () => {
    await escrow.createLock(STAKE_AMOUNT, startTime.add(ONE_WEEK), { from: voter });
    const beforeVotingPower = await escrow.balanceOf(voter);
    const additionalAmount = STAKE_AMOUNT;
    await stakingToken.approve(escrow.address, additionalAmount, { from: voter });
    await escrow.increaseLockAmount(additionalAmount, { from: voter });
    const afterVotingPower = await escrow.balanceOf(voter);
    assert(afterVotingPower.gt(beforeVotingPower));
  });

  it("should be able to withdraw tokens after the lock has expired", async () => {
    const lockTime = startTime.add(ONE_WEEK);
    await escrow.createLock(STAKE_AMOUNT, lockTime, { from: voter });

    await time.increaseTo(lockTime);
    const tx = await escrow.withdraw({ from: voter });
    expectEvent(tx, "Withdraw", {
      provider: voter,
      value: STAKE_AMOUNT,
    });
    const refundedBalance = await stakingToken.balanceOf(voter);
    assert(refundedBalance.eq(MINT_AMOUNT));
  });

  it("should NOT be able to withdraw tokens before the lock has expired", async () => {
    await escrow.createLock(STAKE_AMOUNT, startTime.add(ONE_WEEK), { from: voter });
    await expectRevert(escrow.withdraw({ from: voter }), "The lock didn't expire");
  });

  it("voting power should decay linearly to 0 at lock expiry", async () => {
    const numberYears = 4;
    const lockTime = time.duration.years(numberYears);
    const maxTime = await escrow.MAXTIME();
    assert(lockTime.lte(maxTime));
    const unlockTime = startTime.add(lockTime);
    await escrow.createLock(STAKE_AMOUNT, unlockTime, { from: voter });

    let votingPower: BN = await escrow.balanceOf(voter);
    for (let i = 0; i < numberYears; i++) {
      await time.increase(time.duration.years(1));
      const newVotingPower = await escrow.balanceOf(voter);
      assert(newVotingPower.lte(votingPower));
      votingPower = newVotingPower;
    }

    const latest = await time.latest();
    assert(latest.gte(lockTime));
    assert(votingPower.isZero());
  });

  it("voting power should be capped at MAXTIME", async () => {
    const maxTime = await escrow.MAXTIME();
    const lockTime = maxTime.add(ONE_WEEK);
    const unlockTime = startTime.add(lockTime);
    await escrow.createLock(STAKE_AMOUNT, unlockTime, { from: voter });

    // At above MAX_TIME
    const votingPowerBeyond: BN = await escrow.balanceOf(voter);

    // At MAX_TIME
    await time.increase(ONE_WEEK.sub(BUFFER)); // Reduce flakiness
    const votingPowerAt: BN = await escrow.balanceOf(voter);
    assert(votingPowerBeyond.eq(votingPowerAt)); // Cannot earn VP beyond MAX_TIME

    // Go under MAX_TIME
    await time.increase(ONE_WEEK);
    const votingPowerUnder: BN = await escrow.balanceOf(voter);
    assert(votingPowerUnder.lt(votingPowerAt)); // Decay begins
  });

  it("Non-managers should NOT be able to expire contract", async () => {
    const managerRole = await controller.MANAGER_ROLE();
    const hasRole = await controller.hasRole(managerRole, voter);
    assert.equal(hasRole, false);

    await expectRevert(escrow.expireContract({ from: voter }), "Caller is not a Manager");
    const isExpired = await escrow.expired();
    assert.equal(isExpired, false);
  });

  it("Managers should be able to expire contract", async () => {
    const managerRole = await controller.MANAGER_ROLE();
    const hasRole = await controller.hasRole(managerRole, manager);
    assert.equal(hasRole, true);

    const receipt = await escrow.expireContract({ from: manager });
    expectEvent(receipt, "Expired");
    const isExpired = await escrow.expired();
    assert.equal(isExpired, true);
  });

  it("Managers should be able to set miner", async () => {
    await escrow.setMiner(poorVoter, { from: manager });
    const miner = await escrow.miner();
    assert.equal(miner, poorVoter);
  });

  it("Managers should be able to set miner", async () => {
    await escrow.setMinimumLockTime(ONE_WEEK, { from: manager });
    const minimumLockTime = await escrow.minimumLockTime();
    assert.equal(minimumLockTime, ONE_WEEK.toString());
  });

  it("should be able to withdraw lock anytime when contract is expired", async () => {
    await escrow.createLock(STAKE_AMOUNT, startTime.add(ONE_WEEK), { from: voter });
    await escrow.expireContract({ from: manager });
    const isExpired = await escrow.expired();
    assert.equal(isExpired, true);

    const tx = await escrow.withdraw({ from: voter });
    expectEvent(tx, "Withdraw", {
      provider: voter,
      value: STAKE_AMOUNT,
    });
    const refundedBalance = await stakingToken.balanceOf(voter);
    assert(refundedBalance.eq(MINT_AMOUNT));
  });
});

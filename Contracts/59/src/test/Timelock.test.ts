import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { Timelock } from "../type/Timelock";
import { ContractFactory, constants, utils, Contract, BigNumber } from 'ethers';
// @ts-ignore
import { time } from "@openzeppelin/test-helpers";
import { hardhatSnapshot, hardhatRevert, increaseTime } from "./helpers";

const { deployMockContract } = waffle;

describe("Timelock", function() {
  let accounts: Signer[];
  let owner: Signer;
  let snapshotId: string;
  let timelock: Timelock;
  let encoder = new utils.AbiCoder();

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, ...accounts] = await ethers.getSigners();
    const TimelockFactory = await ethers.getContractFactory("Timelock");

    const ownerAddress = await owner.getAddress();

    timelock = (await TimelockFactory.deploy()) as Timelock;

    await timelock.initialize(ownerAddress, ownerAddress);
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Allows owner to set the delay", async function() {
    const newDelay = 10;
    await timelock.connect(owner).setDelay(newDelay);

    expect(await timelock.delay()).to.equal(newDelay);
  });

  it("Disallows another account from setting delay", async function() {
    const otherAccount = accounts[0];
    await expect(timelock.connect(otherAccount).setDelay(10)).to.be.reverted;
  });

  it("Allows owner to set the grace period", async function() {
    const newGracePeriod = 10000000000;
    await timelock.connect(owner).setGracePeriod(newGracePeriod);

    expect(await timelock.gracePeriod()).to.equal(newGracePeriod);
  });

  it("Disallows another account from setting the grace period", async function() {
    const otherAccount = accounts[0];
    await expect(timelock.connect(otherAccount).setGracePeriod(10)).to.be.reverted;
  });

  it("Can queue a simple transaction", async function() {
    const args = encoder.encode([], []);
    const now = new Date().getTime();
    const then = Math.floor(now / 1000) + 60 * 60 * 24 * 3;

    const tx = await timelock.queueTransaction(timelock.address, 0, 'setGracePeriod(uint256)', args, then);
    const txHash = await tx.wait();
  });

  it("Can cancel a simple transaction", async function() {
    const args = encoder.encode([], []);
    const now = new Date().getTime();
    const then = Math.floor(now / 1000) + 60 * 60 * 24 * 3;

    const tx = await timelock.queueTransaction(timelock.address, 0, 'setGracePeriod(uint256)', args, then);
    const txHash = await tx.wait()

    const txTwo = await timelock.cancelTransaction(timelock.address, 0, 'setGracePeriod(uint256)', args, then);

    await txTwo.wait();
  });

  it("Can execute a simple transaction", async function() {
    const newGracePeriod = 60 * 60 * 24 * 10;
    const args = encoder.encode(["uint256"], [ newGracePeriod ]);
    const now = new Date().getTime();
    const then = Math.floor(now / 1000) + 60 * 60 * 24 * 3;

    const tx = await timelock.queueTransaction(timelock.address, 0, 'setGracePeriod(uint256)', args, then);
    const txHash = await tx.wait()

    const ownerAddress = await owner.getAddress();

    await increaseTime(60*60*24*5);

    const txTwo = await timelock.executeTransaction(timelock.address, 0, 'setGracePeriod(uint256)', args, then);

    await txTwo.wait();

    const gracePeriod = await timelock.gracePeriod();

    expect(gracePeriod).to.equal(newGracePeriod);
  });

  it("Reverts an early execution", async function() {
    const args = encoder.encode([], []);
    const now = new Date().getTime();
    const then = Math.floor(now / 1000) + 60 * 60 * 24 * 3;

    const tx = await timelock.queueTransaction(timelock.address, 0, 'setGracePeriod(uint256)', args, then);
    const txHash = await tx.wait()

    await expect(timelock.executeTransaction(timelock.address, 0, 'setGracePeriod(uint256)', args, then)).to.be.reverted;
  });

  it("Reverts execution after grace period", async function() {
    const args = encoder.encode([], []);
    const now = new Date().getTime();
    const then = Math.floor(now / 1000) + 60 * 60 * 24 * 3;

    const tx = await timelock.queueTransaction(timelock.address, 0, 'setGracePeriod(uint256)', args, then);
    const txHash = await tx.wait()

    await increaseTime(60*60*24*50);

    await expect(timelock.executeTransaction(timelock.address, 0, 'setGracePeriod(uint256)', args, then)).to.be.reverted;
  });

  it("Reverts execution that wasn't queued", async function() {
    const args = encoder.encode([], []);
    const now = new Date().getTime();
    const then = Math.floor(now / 1000) + 60 * 60 * 24 * 3;

    await expect(timelock.executeTransaction(timelock.address, 0, 'setGracePeriod(uint256)', args, then)).to.be.reverted;
  });

  it("Disallows another user from calling queue", async function() {
    const otherAccount = accounts[0];

    const args = encoder.encode([], []);
    const now = new Date().getTime();
    const then = Math.floor(now / 1000) + 60 * 60 * 24 * 3;

    await expect(timelock.connect(otherAccount).queueTransaction(timelock.address, 0, 'setGracePeriod(uint256)', args, then)).to.be.reverted;
  });

  it("Reverts a canceled transaction", async function() {
    const args = encoder.encode([], []);
    const now = new Date().getTime();
    const then = Math.floor(now / 1000) + 60 * 60 * 24 * 3;

    const tx = await timelock.queueTransaction(timelock.address, 0, 'setGracePeriod(uint256)', args, then);
    const txHash = await tx.wait()

    const txTwo = await timelock.cancelTransaction(timelock.address, 0, 'setGracePeriod(uint256)', args, then);

    await txTwo.wait();
    await increaseTime(60*60*24*5);

    await expect(timelock.executeTransaction(timelock.address, 0, 'setGracePeriod(uint256)', args, then)).to.be.reverted;
  });
});

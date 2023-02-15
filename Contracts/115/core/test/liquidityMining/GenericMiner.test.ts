import {
  AccessControllerInstance,
  MockGenericMinerInstance,
  MIMOInstance,
  GovernanceAddressProviderInstance,
} from "../../types/truffle-contracts";
import { setupMIMO } from "../utils/helpers";
const { BN } = require("@openzeppelin/test-helpers");

const MockGenericMiner = artifacts.require("MockGenericMiner");
const AccessController = artifacts.require("AccessController");
const AddressProvider = artifacts.require("AddressProvider");
const GovernanceAddressProvider = artifacts.require("GovernanceAddressProvider");

let genericMiner: MockGenericMinerInstance;
let a: GovernanceAddressProviderInstance;
let mimo: MIMOInstance;
let controller: AccessControllerInstance;

contract("Generic Miner", (accounts) => {
  const [owner, A, B] = accounts;
  beforeEach(async () => {
    controller = await AccessController.new();
    const addresses = await AddressProvider.new(controller.address);
    a = await GovernanceAddressProvider.new(addresses.address);
    mimo = await setupMIMO(a.address, controller, owner);
    await a.setMIMO(mimo.address);
    genericMiner = await MockGenericMiner.new(a.address);
  });

  it("initialized Generic Miner correctly", async () => {
    const balance = await mimo.balanceOf(genericMiner.address);
    assert.equal(balance.toString(), "0");
  });

  it("should allow to increase productivity for a user", async () => {
    await genericMiner.increaseStake(A, 1);

    const amount = await genericMiner.stake(A);
    const totalStake = await genericMiner.totalStake();
    assert.equal(amount.toString(), "1");
    assert.equal(totalStake.toString(), "1");
  });

  it("should be able to read user info via userInfo", async () => {
    await genericMiner.increaseStake(A, 1);

    const userInfo = await genericMiner.userInfo(A);

    assert.equal(userInfo.stake.toString(), "1");
    assert.equal(userInfo.accAmountPerShare.toString(), "0");
  });

  it("should allow to decrease productivity for a user", async () => {
    await genericMiner.increaseStake(A, 2);
    await genericMiner.decreaseStake(A, 1);
    const amount = await genericMiner.stake(A);
    const totalStake = await genericMiner.totalStake();
    assert.equal(amount.toString(), "1");
    assert.equal(totalStake.toString(), "1");
  });

  it("total productivity should add up correctly", async () => {
    await genericMiner.increaseStake(A, 2);
    await genericMiner.increaseStake(B, 3);
    await genericMiner.decreaseStake(A, 1);
    const totalStake = await genericMiner.totalStake();
    assert.equal(totalStake.toString(), "4");
  });

  it("first user should receive previous tokens", async () => {
    await mimo.mint(genericMiner.address, 100);
    await genericMiner.increaseStake(A, 1);
    await genericMiner.increaseStake(B, 1);
    await genericMiner.decreaseStake(A, 1);

    const balance = await mimo.balanceOf(A);
    assert.equal(balance.toString(), "100");
  });

  it("tokens should be fairly distributed", async () => {
    await genericMiner.increaseStake(A, 3);
    await genericMiner.increaseStake(B, 1);
    await mimo.mint(genericMiner.address, 100);
    await genericMiner.decreaseStake(A, 3);
    await genericMiner.decreaseStake(B, 1);

    const balanceA = await mimo.balanceOf(A);
    assert.equal(balanceA.toString(), "75");
    const balanceB = await mimo.balanceOf(B);
    assert.equal(balanceB.toString(), "25");
  });

  it("tokens distirbution complex scenario", async () => {
    await genericMiner.increaseStake(A, 1);
    await genericMiner.increaseStake(B, 1);
    await mimo.mint(genericMiner.address, 100);

    await genericMiner.increaseStake(A, 2); // A:3, B:1 -> A:50, B:50
    assert.equal((await mimo.balanceOf(A)).toString(), "50");

    await mimo.mint(genericMiner.address, 100);

    await genericMiner.increaseStake(B, 2); // A:3, B:3 -> A:125, B:75
    assert.equal((await mimo.balanceOf(B)).toString(), "75");

    await mimo.mint(genericMiner.address, 100);

    await genericMiner.decreaseStake(A, 3); // A:0, B:3 -> A:175, B:125
    assert.equal((await mimo.balanceOf(A)).toString(), "175");

    await mimo.mint(genericMiner.address, 100);

    await genericMiner.decreaseStake(B, 3); // A:0, B:0 -> A:175, B:225
    assert.equal((await mimo.balanceOf(B)).toString(), "225");
  });

  it("should allow a user to withdraw outstanding tokens without updating his stake", async () => {
    await genericMiner.increaseStake(A, 3);
    await mimo.mint(genericMiner.address, 100);
    await genericMiner.releaseMIMO(A);

    const balanceA = await mimo.balanceOf(A);
    assert.equal(balanceA.toString(), "100");
  });

  it("should allow a user to withdraw outstanding tokens without updating his stake & subsequent staking is correct", async () => {
    await genericMiner.increaseStake(A, 1);
    await genericMiner.increaseStake(B, 1);
    await mimo.mint(genericMiner.address, 100);

    await genericMiner.releaseMIMO(A);
    assert.equal((await mimo.balanceOf(A)).toString(), "50");
    await genericMiner.increaseStake(A, 2); // A:3, B:1 -> A:50, B:50

    await mimo.mint(genericMiner.address, 100);

    await genericMiner.increaseStake(B, 2); // A:3, B:3 -> A:125, B:75
    assert.equal((await mimo.balanceOf(B)).toString(), "75");

    await mimo.mint(genericMiner.address, 100);

    await genericMiner.decreaseStake(A, 3); // A:0, B:3 -> A:175, B:125
    assert.equal((await mimo.balanceOf(A)).toString(), "175");

    await mimo.mint(genericMiner.address, 100);

    await genericMiner.releaseMIMO(B);
    assert.equal((await mimo.balanceOf(B)).toString(), "225");
    await genericMiner.decreaseStake(B, 3); // A:0, B:0 -> A:175, B:225
  });

  it("should handle big differences in orders of magnitude correctly MIMO << STAKE", async () => {
    const e26 = new BN("100000000000000000000000000"); // 1e26
    await genericMiner.increaseStake(A, e26);
    await genericMiner.increaseStake(B, e26);
    await mimo.mint(genericMiner.address, 2);
    await genericMiner.decreaseStake(A, e26);
    await genericMiner.decreaseStake(B, e26);
    assert.equal((await mimo.balanceOf(A)).toString(), "1");
    assert.equal((await mimo.balanceOf(B)).toString(), "1");
  });

  it("should handle big differences in orders of magnitude correctly MIMO >> STAKE", async () => {
    const e26 = new BN("100000000000000000000000000"); // 1e26
    await genericMiner.increaseStake(A, 1);
    await genericMiner.increaseStake(B, 1);
    await mimo.mint(genericMiner.address, e26.mul(new BN(2)));
    await genericMiner.decreaseStake(A, 1);
    await genericMiner.decreaseStake(B, 1);
    assert.equal((await mimo.balanceOf(A)).toString(), e26.toString());
    assert.equal((await mimo.balanceOf(B)).toString(), e26.toString());
  });

  it("should handle big orders of magnitude correctly", async () => {
    const e26 = new BN("100000000000000000000000000"); // 1e26
    await genericMiner.increaseStake(A, e26.toString());
    await genericMiner.increaseStake(B, e26.toString());
    await mimo.mint(genericMiner.address, e26.mul(new BN(2)).toString());
    await genericMiner.decreaseStake(A, e26.toString());
    await genericMiner.decreaseStake(B, e26.toString());
    assert.equal((await mimo.balanceOf(A)).toString(), e26.toString());
    assert.equal((await mimo.balanceOf(B)).toString(), e26.toString());
  });

  it("should be able read pendingMIMO tokens", async () => {
    await genericMiner.increaseStake(A, 1);
    await mimo.mint(genericMiner.address, 100);
    const pendingMIMO1 = await genericMiner.pendingMIMO(A);
    assert.equal(pendingMIMO1.toString(), "100");

    await genericMiner.increaseStake(B, 1);
    await mimo.mint(genericMiner.address, 100);
    const pendingMIMO2 = await genericMiner.pendingMIMO(A);
    assert.equal(pendingMIMO2.toString(), "150");

    await genericMiner.releaseMIMO(B);
    const pendingMIMO3 = await genericMiner.pendingMIMO(A);
    assert.equal(pendingMIMO3.toString(), "150");

    const pendingMIMO4 = await genericMiner.pendingMIMO(B);
    assert.equal(pendingMIMO4.toString(), "0");
  });
});

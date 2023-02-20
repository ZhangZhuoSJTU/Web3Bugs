import {
  DemandMinerInstance,
  AccessControllerInstance,
  MIMOInstance,
  MockBPTInstance,
  GovernanceAddressProviderInstance,
} from "../../types/truffle-contracts";
import { setupMIMO } from "../utils/helpers";

const { BN, expectRevert } = require("@openzeppelin/test-helpers");

const DemandMiner = artifacts.require("DemandMiner");
const MockBPT = artifacts.require("MockBPT");
const AccessController = artifacts.require("AccessController");
const AddressProvider = artifacts.require("AddressProvider");
const GovernanceAddressProvider = artifacts.require("GovernanceAddressProvider");

let demandMiner: DemandMinerInstance;
let balancerToken: MockBPTInstance;

let a: GovernanceAddressProviderInstance;
let mimo: MIMOInstance;
let controller: AccessControllerInstance;

contract("Demand Miner", (accounts) => {
  const [owner, A, B, C] = accounts;
  beforeEach(async () => {
    controller = await AccessController.new();
    const addresses = await AddressProvider.new(controller.address);
    a = await GovernanceAddressProvider.new(addresses.address);
    mimo = await setupMIMO(a.address, controller, owner);
    await a.setMIMO(mimo.address);

    balancerToken = await MockBPT.new();
    demandMiner = await DemandMiner.new(a.address, balancerToken.address);

    await balancerToken.mint(A, 1000);
    await balancerToken.mint(B, 1000);
    await balancerToken.approve(demandMiner.address, 1000, { from: A });
    await balancerToken.approve(demandMiner.address, 1000, { from: B });
  });

  it("initialized Demand Miner correctly", async () => {
    const balance = await mimo.balanceOf(demandMiner.address);
    assert.equal(balance.toString(), "0");

    const totalStake = await demandMiner.totalStake();
    assert.equal(totalStake.toString(), "0");
  });

  it("should not allow to deploy a DemandMiner for MIMO tokens", async () => {
    await expectRevert.unspecified(DemandMiner.new(a.address, mimo.address));
  });

  it("should allow to deposit tokens and receive stake for a user", async () => {
    await demandMiner.deposit(2, { from: A });
    await demandMiner.withdraw(1, { from: A });
    const amount = await demandMiner.stake(A);
    const totalStake = await demandMiner.totalStake();
    assert.equal(amount.toString(), "1");
    assert.equal(totalStake.toString(), "1");
  });

  it("total stake should add up correctly after deposit & withdraws", async () => {
    await demandMiner.deposit(2, { from: A });
    await demandMiner.deposit(3, { from: B });
    await demandMiner.withdraw(1, { from: A });
    const totalStake = await demandMiner.totalStake();
    assert.equal(totalStake.toString(), "4");
  });

  it("first user should receive previous tokens", async () => {
    await mimo.mint(demandMiner.address, 100);
    await demandMiner.deposit(1, { from: A });
    await demandMiner.deposit(1, { from: B });
    await demandMiner.withdraw(1, { from: A });

    const balance = await mimo.balanceOf(A);
    assert.equal(balance.toString(), "100");
  });

  it("tokens should be fairly distributed", async () => {
    await demandMiner.deposit(3, { from: A });
    await demandMiner.deposit(1, { from: B });
    await mimo.mint(demandMiner.address, 100);
    await demandMiner.withdraw(3, { from: A });
    await demandMiner.withdraw(1, { from: B });

    const balanceA = await mimo.balanceOf(A);
    assert.equal(balanceA.toString(), "75");
    const balanceB = await mimo.balanceOf(B);
    assert.equal(balanceB.toString(), "25");
  });

  it("tokens distribution complex scenario", async () => {
    await demandMiner.deposit(1, { from: A });
    await demandMiner.deposit(1, { from: B });
    await mimo.mint(demandMiner.address, 100);

    await demandMiner.deposit(2, { from: A }); // A:3, B:1 -> A:50, B:50
    assert.equal((await mimo.balanceOf(A)).toString(), "50");

    await mimo.mint(demandMiner.address, 100);

    await demandMiner.deposit(2, { from: B }); // A:3, B:3 -> A:125, B:75
    assert.equal((await mimo.balanceOf(B)).toString(), "75");

    await mimo.mint(demandMiner.address, 100);

    await demandMiner.withdraw(3, { from: A }); // A:0, B:3 -> A:175, B:125
    assert.equal((await mimo.balanceOf(A)).toString(), "175");

    await mimo.mint(demandMiner.address, 100);

    await demandMiner.withdraw(3, { from: B }); // A:0, B:0 -> A:175, B:225
    assert.equal((await mimo.balanceOf(B)).toString(), "225");
  });

  it("deposits & withdrawals should be correct", async () => {
    const a_balance_before = await balancerToken.balanceOf(A);
    const b_balance_before = await balancerToken.balanceOf(B);
    const demandMiner_balance_before = await balancerToken.balanceOf(demandMiner.address);
    assert.equal(demandMiner_balance_before.toString(), "0");

    await demandMiner.deposit(5, { from: A });
    await demandMiner.deposit(1, { from: B });
    await demandMiner.withdraw(1, { from: A });

    const a_balance_after = await balancerToken.balanceOf(A);
    const b_balance_after = await balancerToken.balanceOf(B);
    const demandMiner_balance_after = await balancerToken.balanceOf(demandMiner.address);

    assert.equal(a_balance_after.toString(), a_balance_before.sub(new BN("4")).toString());
    assert.equal(b_balance_after.toString(), b_balance_before.sub(new BN("1")).toString());
    assert.equal(demandMiner_balance_after.toString(), "5");
  });

  it("should not allow to withdraw more than deposit", async () => {
    const balance_before = await balancerToken.balanceOf(A);
    await demandMiner.deposit(1, { from: A });
    await demandMiner.deposit(10, { from: B });
    await expectRevert(demandMiner.withdraw(2, { from: A }), "INSUFFICIENT_STAKE_FOR_USER");

    const balance_after = await balancerToken.balanceOf(A);
    assert.equal(balance_after.toString(), balance_before.sub(new BN("1")).toString());
  });

  it("deposit should fail if not enough tokens", async () => {
    await expectRevert(demandMiner.deposit(2, { from: C }), "ERC20: transfer amount exceeds balance");
  });

  it.skip("should emit correct events");
  it.skip("should handle safeTransfer correctly");

  it.skip("should now allow direct access to _increaseStake & _decreaseStake");
});

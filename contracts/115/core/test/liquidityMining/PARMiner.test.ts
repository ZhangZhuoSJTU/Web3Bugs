import { assert } from "chai";
import {
  AccessControllerInstance,
  MIMOInstance,
  GovernanceAddressProviderInstance,
  PARMinerInstance,
  PARInstance,
} from "../../types/truffle-contracts";
import { setupMIMO } from "../utils/helpers";

const { BN, expectRevert } = require("@openzeppelin/test-helpers");

const PAR = artifacts.require("PAR");
const PARMiner = artifacts.require("PARMiner");
const AccessController = artifacts.require("AccessController");
const AddressProvider = artifacts.require("AddressProvider");
const GovernanceAddressProvider = artifacts.require("GovernanceAddressProvider");

let parMiner: PARMinerInstance;

let a: GovernanceAddressProviderInstance;
let mimo: MIMOInstance;
let par: PARInstance;
let controller: AccessControllerInstance;

contract("PAR Miner", (accounts) => {
  const [owner, A, B, C, D] = accounts;
  beforeEach(async () => {
    controller = await AccessController.new();
    const addresses = await AddressProvider.new(controller.address);
    a = await GovernanceAddressProvider.new(addresses.address);
    mimo = await setupMIMO(a.address, controller, owner);
    await a.setMIMO(mimo.address);

    par = await PAR.new(addresses.address);
    await addresses.setStableX(par.address);
    parMiner = await PARMiner.new(a.address);

    const MINTER_ROLE = await controller.MINTER_ROLE();
    await controller.grantRole(MINTER_ROLE, owner);

    await par.mint(A, "1000");
    await par.mint(B, "1000");
    await par.mint(C, "1000");
    await par.approve(parMiner.address, 1000, { from: A });
    await par.approve(parMiner.address, 1000, { from: B });
    await par.approve(parMiner.address, 1000, { from: C });
  });

  it("initialized PAR Miner correctly", async () => {
    const balance = await mimo.balanceOf(parMiner.address);
    assert.equal(balance.toString(), "0");

    const totalStake = await parMiner.totalStake();
    assert.equal(totalStake.toString(), "0");
  });

  it("should allow to deposit tokens and receive stake for a user", async () => {
    await parMiner.deposit(2, { from: A });
    await parMiner.withdraw(1, { from: A });
    const amount = await parMiner.stake(A);
    const totalStake = await parMiner.totalStake();
    assert.equal(amount.toString(), "1");
    assert.equal(totalStake.toString(), "1");
  });

  it("first user should receive previous tokens", async () => {
    await mimo.mint(parMiner.address, 100);
    await par.mint(parMiner.address, 100);
    await parMiner.deposit(1, { from: A });
    await parMiner.deposit(1, { from: B });
    await parMiner.withdraw(1, { from: A });

    const mimoBalance = await mimo.balanceOf(A);
    assert.equal(mimoBalance.toString(), "100");
    const parBalance = await par.balanceOf(A);
    assert.equal(parBalance.toString(), "1100", "1000 PAR + 100 PAR reward");
  });

  it("tokens should be fairly distributed", async () => {
    await parMiner.deposit(3, { from: A });
    await parMiner.deposit(1, { from: B });
    await mimo.mint(parMiner.address, 100);
    await par.mint(parMiner.address, 100);
    await parMiner.withdraw(3, { from: A });
    await parMiner.withdraw(1, { from: B });

    const balanceA = await mimo.balanceOf(A);
    assert.equal(balanceA.toString(), "75");
    const parBalanceA = await par.balanceOf(A);
    assert.equal(parBalanceA.toString(), "1075", "1000 PAR + 75 PAR reward");

    const balanceB = await mimo.balanceOf(B);
    assert.equal(balanceB.toString(), "25");
    const parBalanceB = await par.balanceOf(B);
    assert.equal(parBalanceB.toString(), "1025", "1000 PAR + 25 PAR reward");
  });

  it("tokens distribution complex scenario", async () => {
    await parMiner.deposit(1, { from: A });
    await parMiner.deposit(1, { from: B });
    // A: 1 stake -> 50%
    // B: 1 stake -> 50%
    await mimo.mint(parMiner.address, 100);
    await par.mint(parMiner.address, 2);

    await parMiner.deposit(2, { from: A });
    assert.equal((await mimo.balanceOf(A)).toString(), "50");
    assert.equal((await par.balanceOf(A)).toString(), "997");
    assert.equal((await parMiner.stake(A)).toString(), "4", "3 PAR deposit + 1 PAR reward");
    assert.equal((await parMiner.pendingPAR(A)).toString(), "0");
    assert.equal((await parMiner.pendingPAR(B)).toString(), "1");

    // A: 4 stake -> 80%
    // B: 1 stake -> 20%

    await mimo.mint(parMiner.address, 100);
    await par.mint(parMiner.address, 10);

    await parMiner.deposit(2, { from: B });
    assert.equal(
      (await mimo.balanceOf(B)).toString(),
      "70",
      "50 MIMO from the first reward, and 20 MIMO from the previous reward",
    );
    assert.equal((await par.balanceOf(B)).toString(), "997");
    assert.equal(
      (await parMiner.stake(B)).toString(),
      "6",
      "3 PAR deposit + 1 PAR from first reward and 2 PAR from the previous reward",
    );
    assert.equal((await parMiner.pendingPAR(A)).toString(), "8", "8 PAR from the previous reward");

    // A: 4 stake -> 40%
    // B: 6 stake -> 60%

    await mimo.mint(parMiner.address, 100);
    await par.mint(parMiner.address, 10);

    assert.equal((await parMiner.pendingPAR(A)).toString(), "12");
    assert.equal((await parMiner.stake(A)).toString(), "4");

    assert.equal((await par.balanceOf(A)).toString(), "997", "1000-3 PAR staked");
    await parMiner.withdraw(await parMiner.stake(A), { from: A });
    assert.equal((await mimo.balanceOf(A)).toString(), "170", "50 + 80 + 40 from third reward");
    assert.equal((await par.balanceOf(A)).toString(), "1013", "997 PAR + 4 stake + 12 reward");

    // A: 0 stake -> 0%
    // B: 6 stake -> 100%

    await mimo.mint(parMiner.address, 100);
    await par.mint(parMiner.address, 10);

    assert.equal((await par.balanceOf(B)).toString(), "997", "1000-3 PAR staked");
    await parMiner.withdraw(await parMiner.stake(B), { from: B });
    assert.equal((await mimo.balanceOf(B)).toString(), "230");
    assert.equal((await par.balanceOf(B)).toString(), "1019", "997 PAR + 4 + 18 in rewards");
  });

  it("deposits & withdrawals should be correct", async () => {
    const a_balance_before = await par.balanceOf(A);
    const b_balance_before = await par.balanceOf(B);
    const parMiner_balance_before = await par.balanceOf(parMiner.address);
    assert.equal(parMiner_balance_before.toString(), "0");

    await parMiner.deposit(5, { from: A });
    await parMiner.deposit(1, { from: B });
    await parMiner.withdraw(1, { from: A });

    const a_balance_after = await par.balanceOf(A);
    const b_balance_after = await par.balanceOf(B);
    const parMiner_balance_after = await par.balanceOf(parMiner.address);

    assert.equal(a_balance_after.toString(), a_balance_before.sub(new BN("4")).toString());
    assert.equal(b_balance_after.toString(), b_balance_before.sub(new BN("1")).toString());
    assert.equal(parMiner_balance_after.toString(), "5");
  });

  it("should not allow to withdraw more than deposit", async () => {
    const balance_before = await par.balanceOf(A);
    await parMiner.deposit(1, { from: A });
    await parMiner.deposit(10, { from: B });
    await expectRevert(parMiner.withdraw(2, { from: A }), "INSUFFICIENT_STAKE_FOR_USER");

    const balance_after = await par.balanceOf(A);
    assert.equal(balance_after.toString(), balance_before.sub(new BN("1")).toString());
  });

  it("deposit should fail if not enough tokens", async () => {
    await expectRevert(parMiner.deposit(2, { from: D }), "ERC20: transfer amount exceeds balance");
  });

  it("should allow a user to withdraw outstanding reward tokens without updating his stake", async () => {
    await parMiner.deposit(1, { from: A });
    await mimo.mint(parMiner.address, 100);
    await par.mint(parMiner.address, 100);
    await parMiner.releaseMIMO(A);
    await parMiner.releasePAR(A);

    assert.equal((await mimo.balanceOf(A)).toString(), "100");
    assert.equal((await par.balanceOf(A)).toString(), "1099");

    assert.equal((await parMiner.stake(A)).toString(), "1");
  });

  it("should allow the user to restake their PAR reward", async () => {
    await parMiner.deposit(1, { from: A });
    await par.mint(parMiner.address, 100);

    assert.equal((await parMiner.pendingPAR(A)).toString(), "100");
    await parMiner.restakePAR(A);

    assert.equal((await par.balanceOf(A)).toString(), "999");
    assert.equal((await parMiner.stake(A)).toString(), "101");
    assert.equal((await parMiner.pendingPAR(A)).toString(), "0");
  });

  it("complex PAR reward", async () => {
    await parMiner.deposit(200, { from: A });
    await par.mint(parMiner.address, 100);

    assert.strictEqual((await parMiner.pendingPAR(A)).toString(), "100");

    await parMiner.deposit(800, { from: B });
    await par.mint(parMiner.address, 100);

    assert.strictEqual((await parMiner.pendingPAR(A)).toString(), "120");
    assert.strictEqual((await parMiner.pendingPAR(B)).toString(), "80");

    await parMiner.deposit(1000, { from: C });

    await par.mint(parMiner.address, 100);

    assert.strictEqual((await parMiner.pendingPAR(A)).toString(), "130");
    assert.strictEqual((await parMiner.pendingPAR(B)).toString(), "120");
    assert.strictEqual((await parMiner.pendingPAR(C)).toString(), "50");

    await parMiner.withdraw(400, { from: C });
    await par.mint(parMiner.address, 100);

    assert.strictEqual((await par.balanceOf(C)).toString(), "450", "400 original balance + 50 PAR that was pending");

    assert.strictEqual((await parMiner.pendingPAR(A)).toString(), "143", "130 + 13"); // Slight rounding issue, user has 12.5% of the total stake
    assert.strictEqual((await parMiner.pendingPAR(B)).toString(), "170", "120 + 50");
    assert.strictEqual((await parMiner.pendingPAR(C)).toString(), "38", "0 + 38"); // Slight rounding issue, user has 37.5% of the total stake
  });
});

import { deployments, ethers } from "hardhat";
import {
  AccessController,
  DexAddressProvider,
  GovernanceAddressProvider,
  MockMIMO,
  PAR,
  PARMinerV2,
} from "../../../typechain-types";

const { expectRevert } = require("@openzeppelin/test-helpers");

const setup = deployments.createFixture(async () => {
  await deployments.fixture(["SetCore", "SetGovernance", "GovernanceV2"]);
  const [owner, alice, bob, charlie, denise] = await ethers.getSigners();
  const a: GovernanceAddressProvider = await ethers.getContract("GovernanceAddressProvider");
  const dexAP: DexAddressProvider = await ethers.getContract("DexAddressProvider");
  const mimo: MockMIMO = await ethers.getContract("MockMIMO");
  const par: PAR = await ethers.getContract("PAR");
  const controller: AccessController = await ethers.getContract("AccessController");
  const parMiner: PARMinerV2 = await ethers.getContract("PARMinerV2");
  const MINTER_ROLE = await controller.MINTER_ROLE();
  await controller.grantRole(MINTER_ROLE, owner.address);

  await par.mint(alice.address, "1000");
  await par.mint(bob.address, "1000");
  await par.mint(charlie.address, "1000");
  await par.connect(alice).approve(parMiner.address, 1000);
  await par.connect(bob).approve(parMiner.address, 1000);
  await par.connect(charlie).approve(parMiner.address, 1000);

  return {
    owner,
    alice,
    bob,
    charlie,
    denise,
    a,
    dexAP,
    mimo,
    par,
    controller,
    parMiner,
  };
});

describe("--- PARMinerV2 ---", () => {
  it("initialized PAR Miner correctly", async () => {
    const { mimo, parMiner } = await setup();
    const balance = await mimo.balanceOf(parMiner.address);
    assert.equal(balance.toString(), "0");

    const totalStake = await parMiner.totalStake();
    assert.equal(totalStake.toString(), "0");
  });
  it("should allow to deposit tokens and receive stake for a user", async () => {
    const { parMiner, alice } = await setup();
    await parMiner.connect(alice).deposit(2);
    await parMiner.connect(alice).withdraw(1);
    const amount = await parMiner.stake(alice.address);
    const totalStake = await parMiner.totalStake();

    assert.equal(amount.toString(), "1");
    assert.equal(totalStake.toString(), "1");
  });
  it("first user should receive previous tokens", async () => {
    const { mimo, parMiner, alice, bob, par } = await setup();
    await mimo.mint(parMiner.address, 100);
    await par.mint(parMiner.address, 100);
    await parMiner.connect(alice).deposit(1);
    await parMiner.connect(bob).deposit(1);
    await parMiner.connect(alice).withdraw(1);

    const mimoBalance = await mimo.balanceOf(alice.address);
    assert.equal(mimoBalance.toString(), "100");
    const parBalance = await par.balanceOf(alice.address);
    assert.equal(parBalance.toString(), "1100", "1000 PAR + 100 PAR reward");
  });
  it("tokens should be fairly distributed", async () => {
    const { parMiner, mimo, par, alice, bob } = await setup();
    await parMiner.connect(alice).deposit(3);
    await parMiner.connect(bob).deposit(1);
    await mimo.mint(parMiner.address, 100);
    await par.mint(parMiner.address, 100);
    await parMiner.connect(alice).withdraw(3);
    await parMiner.connect(bob).withdraw(1);

    const balanceA = await mimo.balanceOf(alice.address);
    assert.equal(balanceA.toString(), "75");
    const parBalanceA = await par.balanceOf(alice.address);
    assert.equal(parBalanceA.toString(), "1075", "1000 PAR + 75 PAR reward");

    const balanceB = await mimo.balanceOf(bob.address);
    assert.equal(balanceB.toString(), "25");
    const parBalanceB = await par.balanceOf(bob.address);
    assert.equal(parBalanceB.toString(), "1025", "1000 PAR + 25 PAR reward");
  });
  it("tokens distribution complex scenario", async () => {
    const { parMiner, alice, bob, par, mimo } = await setup();
    await parMiner.connect(alice).deposit(1);
    await parMiner.connect(bob).deposit(1);
    // A: 1 stake -> 80%
    // B: 1 stake -> 20%
    await mimo.mint(parMiner.address, 100);
    await par.mint(parMiner.address, 2);

    await parMiner.connect(alice).deposit(2);
    assert.equal((await mimo.balanceOf(alice.address)).toString(), "50");
    assert.equal((await par.balanceOf(alice.address)).toString(), "997");
    assert.equal((await parMiner.stake(alice.address)).toString(), "4", "3 PAR deposit + 1 PAR reward");
    assert.equal((await parMiner.pendingPAR(alice.address)).toString(), "0");
    assert.equal((await parMiner.pendingPAR(bob.address)).toString(), "1");

    // A: 4 stake -> 80%
    // B: 1 stake -> 20%

    await mimo.mint(parMiner.address, 100);
    await par.mint(parMiner.address, 10);

    await parMiner.connect(bob).deposit(2);
    assert.equal(
      (await mimo.balanceOf(bob.address)).toString(),
      "70",
      "50 MIMO from the first reward, and 20 MIMO from the previous reward",
    );
    assert.equal((await par.balanceOf(bob.address)).toString(), "997");
    assert.equal(
      (await parMiner.stake(bob.address)).toString(),
      "6",
      "3 PAR deposit + 1 PAR from first reward and 2 PAR from the previous reward",
    );
    assert.equal((await parMiner.pendingPAR(alice.address)).toString(), "8", "8 PAR from the previous reward");

    // A: 4 stake -> 40%
    // B: 6 stake -> 60%

    await mimo.mint(parMiner.address, 100);
    await par.mint(parMiner.address, 10);

    assert.equal((await parMiner.pendingPAR(alice.address)).toString(), "12");
    assert.equal((await parMiner.stake(alice.address)).toString(), "4");

    assert.equal((await par.balanceOf(alice.address)).toString(), "997", "1000-3 PAR staked");
    await parMiner.connect(alice).withdraw(await parMiner.stake(alice.address));
    assert.equal((await mimo.balanceOf(alice.address)).toString(), "170", "50 + 80 + 40 from third reward");
    assert.equal((await par.balanceOf(alice.address)).toString(), "1013", "997 PAR + 4 stake + 12 reward");

    // A: 0 stake -> 0%
    // B: 6 stake -> 100%

    await mimo.mint(parMiner.address, 100);
    await par.mint(parMiner.address, 10);

    assert.equal((await par.balanceOf(bob.address)).toString(), "997", "1000-3 PAR staked");
    await parMiner.connect(bob).withdraw(await parMiner.stake(bob.address));
    assert.equal((await mimo.balanceOf(bob.address)).toString(), "230");
    assert.equal((await par.balanceOf(bob.address)).toString(), "1019", "997 PAR + 4 + 18 in rewards");
  });
  it("deposits & withdrawals should be correct", async () => {
    const { par, alice, bob, parMiner } = await setup();
    const a_balance_before = await par.balanceOf(alice.address);
    const b_balance_before = await par.balanceOf(bob.address);
    const parMiner_balance_before = await par.balanceOf(parMiner.address);
    assert.equal(parMiner_balance_before.toString(), "0");

    await parMiner.connect(alice).deposit(5);
    await parMiner.connect(bob).deposit(1);
    await parMiner.connect(alice).withdraw(1);

    const a_balance_after = await par.balanceOf(alice.address);
    const b_balance_after = await par.balanceOf(bob.address);
    const parMiner_balance_after = await par.balanceOf(parMiner.address);

    assert.equal(a_balance_after.toString(), a_balance_before.sub(ethers.BigNumber.from("4")).toString());
    assert.equal(b_balance_after.toString(), b_balance_before.sub(ethers.BigNumber.from("1")).toString());
    assert.equal(parMiner_balance_after.toString(), "5");
  });
  it("should not allow to withdraw more than deposit", async () => {
    const { par, alice, bob, parMiner } = await setup();
    const balance_before = await par.balanceOf(alice.address);
    await parMiner.connect(alice).deposit(1);
    await parMiner.connect(bob).deposit(10);
    await expectRevert(parMiner.connect(alice).withdraw(2), "LM102");

    const balance_after = await par.balanceOf(alice.address);
    assert.equal(balance_after.toString(), balance_before.sub(ethers.BigNumber.from("1")).toString());
  });
  it("deposit should fail if not enough tokens", async () => {
    const { parMiner, denise } = await setup();
    await expectRevert(parMiner.connect(denise).deposit(2), "ERC20: transfer amount exceeds balance");
  });
  it("should allow a user to withdraw outstanding reward tokens without updating his stake", async () => {
    const { alice, parMiner, par, mimo } = await setup();
    await parMiner.connect(alice).deposit(1);
    await mimo.mint(parMiner.address, 100);
    await par.mint(parMiner.address, 100);
    await parMiner.releaseRewards(alice.address);

    assert.equal((await mimo.balanceOf(alice.address)).toString(), "100");
    assert.equal((await par.balanceOf(alice.address)).toString(), "1099");

    assert.equal((await parMiner.stake(alice.address)).toString(), "1");
  });
  it("should allow the user to restake their PAR reward", async () => {
    const { parMiner, par, alice } = await setup();
    await parMiner.connect(alice).deposit(1);
    await par.mint(parMiner.address, 100);

    assert.equal((await parMiner.pendingPAR(alice.address)).toString(), "100");
    await parMiner.restakePAR(alice.address);

    assert.equal((await par.balanceOf(alice.address)).toString(), "999");
    assert.equal((await parMiner.stake(alice.address)).toString(), "101");
    assert.equal((await parMiner.pendingPAR(alice.address)).toString(), "0");
  });
  it("complex PAR reward", async () => {
    const { parMiner, par, alice, bob, charlie } = await setup();
    await parMiner.connect(alice).deposit(200);
    await par.mint(parMiner.address, 100);

    assert.strictEqual((await parMiner.pendingPAR(alice.address)).toString(), "100");

    await parMiner.connect(bob).deposit(800);
    await par.mint(parMiner.address, 100);

    assert.strictEqual((await parMiner.pendingPAR(alice.address)).toString(), "120");
    assert.strictEqual((await parMiner.pendingPAR(bob.address)).toString(), "80");

    await parMiner.connect(charlie).deposit(1000);

    await par.mint(parMiner.address, 100);

    assert.strictEqual((await parMiner.pendingPAR(alice.address)).toString(), "130");
    assert.strictEqual((await parMiner.pendingPAR(bob.address)).toString(), "120");
    assert.strictEqual((await parMiner.pendingPAR(charlie.address)).toString(), "50");

    await parMiner.connect(charlie).withdraw(400);
    await par.mint(parMiner.address, 100);

    assert.strictEqual(
      (await par.balanceOf(charlie.address)).toString(),
      "450",
      "400 original balance + 50 PAR that was pending",
    );

    assert.strictEqual((await parMiner.pendingPAR(alice.address)).toString(), "143", "130 + 13"); // Slight rounding issue, user has 12.5% of the total stake
    assert.strictEqual((await parMiner.pendingPAR(bob.address)).toString(), "170", "120 + 50");
    assert.strictEqual((await parMiner.pendingPAR(charlie.address)).toString(), "38", "0 + 38"); // Slight rounding issue, user has 37.5% of the total stake
  });
});

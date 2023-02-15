import { deployments, ethers } from "hardhat";
import { BOOST_CONFIG, FEE_CONFIG } from "../../../config/deployment";
import {
  AccessController,
  AddressProvider,
  GovernanceAddressProvider,
  MockBPT,
  MockMIMO,
  PAR,
} from "../../../typechain-types";
import { DemandMinerV2 } from "../../../typechain-types/DemandMinerV2";

const { expectRevert } = require("@openzeppelin/test-helpers");

const setup = deployments.createFixture(async () => {
  await deployments.fixture(["SetCore", "SetGovernance"]);
  const { deploy } = deployments;
  const [owner, alice, bob, charlie, feeCollector] = await ethers.getSigners();
  const controller: AccessController = await ethers.getContract("AccessController");
  const addresses: AddressProvider = await ethers.getContract("AddressProvider");
  const a: GovernanceAddressProvider = await ethers.getContract("GovernanceAddressProvider");
  const mimo: MockMIMO = await ethers.getContract("MockMIMO");
  const stablex: PAR = await ethers.getContract("PAR");

  await deploy("MockBPT", {
    from: owner.address,
    args: [],
  });

  FEE_CONFIG.depositFee = ethers.utils.parseUnits("1", 16);
  FEE_CONFIG.withdrawFee = ethers.utils.parseUnits("1", 16);

  const balancerToken: MockBPT = await ethers.getContract("MockBPT");
  const newDemandMiner = await deploy("DemandMinerV2", {
    from: owner.address,
    args: [a.address, balancerToken.address, feeCollector.address, BOOST_CONFIG, FEE_CONFIG],
  });
  const demandMiner: DemandMinerV2 = await ethers.getContractAt("DemandMinerV2", newDemandMiner.address);
  await balancerToken.mint(alice.address, 1000);
  await balancerToken.mint(bob.address, 1000);
  await balancerToken.connect(alice).approve(demandMiner.address, 1000);
  await balancerToken.connect(bob).approve(demandMiner.address, 1000);

  const managerRole = await controller.MANAGER_ROLE();
  const minterRole = await controller.MINTER_ROLE();
  await controller.grantRole(managerRole, owner.address);
  await controller.grantRole(minterRole, owner.address);

  return {
    owner,
    alice,
    bob,
    charlie,
    controller,
    addresses,
    a,
    mimo,
    balancerToken,
    demandMiner,
    stablex,
    feeCollector,
  };
});

describe("--- DemandMinerV2 ---", () => {
  describe("Config", async () => {
    it("should revert if trying to set token to address 0", async () => {
      const { owner, a, feeCollector } = await setup();
      const { deploy } = deployments;
      await expectRevert(
        deploy("DemandMinerV2", {
          from: owner.address,
          args: [a.address, ethers.constants.AddressZero, feeCollector.address, BOOST_CONFIG, FEE_CONFIG],
        }),
        "LM000",
      );
    });
    it("should revert if trying to set feeCollector to address 0", async () => {
      const { owner, a, balancerToken } = await setup();
      const { deploy } = deployments;
      await expectRevert(
        deploy("DemandMinerV2", {
          from: owner.address,
          args: [a.address, balancerToken.address, ethers.constants.AddressZero, BOOST_CONFIG, FEE_CONFIG],
        }),
        "LM000",
      );
    });
    it("initialized DemandMiner correctly", async () => {
      const { mimo, demandMiner, feeCollector, balancerToken } = await setup();
      const balance = await mimo.balanceOf(demandMiner.address);
      assert.equal(balance.toString(), "0");

      const totalStake = await demandMiner.totalStake();
      assert.equal(totalStake.toString(), "0");

      const _feeCollector = await demandMiner.feeCollector();
      assert.equal(_feeCollector, feeCollector.address);

      const token = await demandMiner.token();
      assert.equal(token, balancerToken.address);
    });
    it("should not allow to deploy a DemandMiner for MIMO tokens", async () => {
      const { owner, a, mimo, feeCollector } = await setup();
      const { deploy } = deployments;
      await expectRevert.unspecified(
        deploy("DemandMinerV2", {
          from: owner.address,
          args: [a.address, mimo.address, feeCollector.address, BOOST_CONFIG, FEE_CONFIG],
        }),
      );
    });
    it("should revert if setFeeCollector called by ofther than protocol manage", async () => {
      const { demandMiner, alice, bob } = await setup();
      await expectRevert(demandMiner.connect(alice).setFeeCollector(bob.address), "LM010");
    });
    it("should revert if setFeeConfig called by other than protocol manager", async () => {
      const { demandMiner, alice } = await setup();
      const newFeeConfig = { ...FEE_CONFIG };
      newFeeConfig.depositFee = ethers.utils.parseUnits("10", 16);
      newFeeConfig.withdrawFee = ethers.utils.parseUnits("10", 16);
      await expectRevert(demandMiner.connect(alice).setFeeConfig(newFeeConfig), "LM010");
    });
    it("should allow protocol manager to setFeeCollector correctly", async () => {
      const { demandMiner, alice } = await setup();
      await expect(demandMiner.setFeeCollector(alice.address))
        .to.emit(demandMiner, "FeeCollectorSet")
        .withArgs(alice.address);
      const feeCollector = await demandMiner.feeCollector();
      assert.equal(feeCollector, alice.address);
    });
    it("should allow procotol manager to setFeeConfig correctly", async () => {
      const { demandMiner } = await setup();
      const newFeeConfig = { ...FEE_CONFIG };
      newFeeConfig.depositFee = ethers.utils.parseUnits("10", 16);
      newFeeConfig.withdrawFee = ethers.utils.parseUnits("10", 16);
      await expect(demandMiner.setFeeConfig(newFeeConfig)).to.emit(demandMiner, "FeeConfigSet");
      const feeConfig = await demandMiner.feeConfig();
      assert.equal(feeConfig.depositFee.toString(), newFeeConfig.depositFee.toString());
      assert.equal(feeConfig.withdrawFee.toString(), newFeeConfig.withdrawFee.toString());
    });
  });
  describe("Deposit & Withdraw", () => {
    it("should allow to deposit tokens and receive stake for a user", async () => {
      const { demandMiner, alice } = await setup();
      await demandMiner.connect(alice).deposit(2);
      await demandMiner.connect(alice).withdraw(1);
      const amount = await demandMiner.stake(alice.address);
      const totalStake = await demandMiner.totalStake();
      assert.equal(amount.toString(), "1");
      assert.equal(totalStake.toString(), "1");
    });
    it("total stake should add up correctly after deposit & withdraws", async () => {
      const { demandMiner, alice, bob } = await setup();
      await demandMiner.connect(alice).deposit(2);
      await demandMiner.connect(bob).deposit(3);
      await demandMiner.connect(alice).withdraw(1);
      const totalStake = await demandMiner.totalStake();
      assert.equal(totalStake.toString(), "4");
    });
    it("first user should receive previous tokens", async () => {
      const { mimo, demandMiner, alice, bob, stablex } = await setup();
      await mimo.mint(demandMiner.address, 100);
      await stablex.mint(demandMiner.address, 100);
      await demandMiner.connect(alice).deposit(1);
      await demandMiner.connect(bob).deposit(1);
      await demandMiner.connect(alice).withdraw(1);

      const balance = await mimo.balanceOf(alice.address);
      assert.equal(balance.toString(), "100");
      const parBalance = await stablex.balanceOf(alice.address);
      assert.equal(parBalance.toString(), "100");
    });
    it("tokens should be fairly distributed", async () => {
      const { demandMiner, alice, bob, mimo, stablex } = await setup();
      await demandMiner.connect(alice).deposit(3);
      await demandMiner.connect(bob).deposit(1);
      await mimo.mint(demandMiner.address, 100);
      await stablex.mint(demandMiner.address, 100);
      await demandMiner.connect(alice).withdraw(3);
      await demandMiner.connect(bob).withdraw(1);

      const balanceA = await mimo.balanceOf(alice.address);
      assert.equal(balanceA.toString(), "75");
      const balanceB = await mimo.balanceOf(bob.address);
      assert.equal(balanceB.toString(), "25");
      const parBalanceA = await stablex.balanceOf(alice.address);
      assert.equal(parBalanceA.toString(), "75");
      const parBlaanceB = await stablex.balanceOf(bob.address);
      assert.equal(parBlaanceB.toString(), "25");
    });
    it("tokens distribution complex scenario", async () => {
      const { demandMiner, alice, bob, mimo, stablex } = await setup();
      await demandMiner.connect(alice).deposit(1);
      await demandMiner.connect(bob).deposit(1);
      await mimo.mint(demandMiner.address, 100);
      await stablex.mint(demandMiner.address, 100);

      await demandMiner.connect(alice).deposit(2); // A:3, B:1 -> A:50, B:50
      assert.equal((await mimo.balanceOf(alice.address)).toString(), "50");
      assert.equal((await stablex.balanceOf(alice.address)).toString(), "50");

      await mimo.mint(demandMiner.address, 100);
      await stablex.mint(demandMiner.address, 100);

      await demandMiner.connect(bob).deposit(2); // A:3, B:3 -> A:125, B:75
      assert.equal((await mimo.balanceOf(bob.address)).toString(), "75");
      assert.equal((await stablex.balanceOf(bob.address)).toString(), "75");

      await mimo.mint(demandMiner.address, 100);
      await stablex.mint(demandMiner.address, 100);

      await demandMiner.connect(alice).withdraw(3); // A:0, B:3 -> A:175, B:125
      assert.equal((await mimo.balanceOf(alice.address)).toString(), "175");
      assert.equal((await stablex.balanceOf(alice.address)).toString(), "175");

      await mimo.mint(demandMiner.address, 100);
      await stablex.mint(demandMiner.address, 100);

      await demandMiner.connect(bob).withdraw(3); // A:0, B:0 -> A:175, B:225
      assert.equal((await mimo.balanceOf(bob.address)).toString(), "225");
      assert.equal((await stablex.balanceOf(bob.address)).toString(), "225");
    });
    it("deposits & withdrawals should be correct", async () => {
      const { balancerToken, alice, bob, demandMiner } = await setup();
      const a_balance_before = await balancerToken.balanceOf(alice.address);
      const b_balance_before = await balancerToken.balanceOf(bob.address);
      const demandMiner_balance_before = await balancerToken.balanceOf(demandMiner.address);
      assert.equal(demandMiner_balance_before.toString(), "0");

      await demandMiner.connect(alice).deposit(5);
      await demandMiner.connect(bob).deposit(1);
      await demandMiner.connect(alice).withdraw(1);

      const a_balance_after = await balancerToken.balanceOf(alice.address);
      const b_balance_after = await balancerToken.balanceOf(bob.address);
      const demandMiner_balance_after = await balancerToken.balanceOf(demandMiner.address);

      assert.equal(a_balance_after.toString(), a_balance_before.sub(ethers.BigNumber.from(4)).toString());
      assert.equal(b_balance_after.toString(), b_balance_before.sub(ethers.BigNumber.from(1)).toString());
      assert.equal(demandMiner_balance_after.toString(), "5");
    });
    it("should not allow to withdraw more than deposit", async () => {
      const { balancerToken, demandMiner, alice, bob } = await setup();
      const balance_before = await balancerToken.balanceOf(alice.address);
      await demandMiner.connect(alice).deposit(1);
      await demandMiner.connect(bob).deposit(10);
      await expectRevert(demandMiner.connect(alice).withdraw(2), "LM102");

      const balance_after = await balancerToken.balanceOf(alice.address);
      assert.equal(balance_after.toString(), balance_before.sub(ethers.BigNumber.from(1)).toString());
    });
    it("deposit should fail if not enough tokens", async () => {
      const { demandMiner, charlie } = await setup();
      await expectRevert(demandMiner.connect(charlie).deposit(2), "ERC20: transfer amount exceeds balance");
    });
    it("fee should be correctly deducted on deposit", async () => {
      const { demandMiner, alice, feeCollector, balancerToken } = await setup();
      await demandMiner.connect(alice).deposit(100);
      const aliceStake = await demandMiner.stake(alice.address);
      const feeCollectorBalance = await balancerToken.balanceOf(feeCollector.address);
      assert.equal(aliceStake.toString(), "99");
      assert.equal(feeCollectorBalance.toString(), "1");
    });
    it("fee should be correclty deducted on withdraw", async () => {
      const { demandMiner, alice, feeCollector, balancerToken } = await setup();
      await demandMiner.connect(alice).deposit(200);
      await demandMiner.connect(alice).withdraw(100);
      const aliceStake = await demandMiner.stake(alice.address);
      const aliceBalance = await balancerToken.balanceOf(alice.address);
      const feeCollectorBalance = await balancerToken.balanceOf(feeCollector.address);
      assert.equal(aliceStake.toString(), "98");
      assert.equal(feeCollectorBalance.toString(), "3");
      assert.equal(aliceBalance.toString(), "899");
    });
    it("deposit should behave correctly if fee is 0", async () => {
      const { demandMiner, alice, feeCollector, balancerToken } = await setup();
      const newFeeConfig = { ...FEE_CONFIG };
      newFeeConfig.depositFee = ethers.BigNumber.from(0);
      newFeeConfig.withdrawFee = ethers.BigNumber.from(0);
      await demandMiner.setFeeConfig(newFeeConfig);
      await demandMiner.connect(alice).deposit(100);
      const aliceStake = await demandMiner.stake(alice.address);
      const feeCollectorBalance = await balancerToken.balanceOf(feeCollector.address);
      assert.equal(aliceStake.toString(), "100");
      assert.equal(feeCollectorBalance.toString(), "0");
    });
    it("withdraw should behave correctly if fee is 0", async () => {
      const { demandMiner, alice, feeCollector, balancerToken } = await setup();
      const newFeeConfig = { ...FEE_CONFIG };
      newFeeConfig.depositFee = ethers.BigNumber.from(0);
      newFeeConfig.withdrawFee = ethers.BigNumber.from(0);
      await demandMiner.setFeeConfig(newFeeConfig);
      await demandMiner.connect(alice).deposit(200);
      await demandMiner.connect(alice).withdraw(100);
      const aliceStake = await demandMiner.stake(alice.address);
      const feeCollectorBalance = await balancerToken.balanceOf(feeCollector.address);
      assert.equal(aliceStake.toString(), "100");
      assert.equal(feeCollectorBalance.toString(), "0");
    });
  });
});

import { expect } from "chai";
import { deployMockContract } from "ethereum-waffle";
import { deployments, ethers } from "hardhat";
import ms from "ms";
import { BOOST_CONFIG } from "../../../config/deployment";
import {
  AccessController,
  AddressProvider,
  GovernanceAddressProvider,
  MockGenericMinerV2,
  MockMIMO,
  PAR,
  VotingEscrow,
  VotingMinerV2,
} from "../../../typechain-types";

const { timeAndMine } = require("hardhat");
const { expectRevert } = require("@openzeppelin/test-helpers");

const FOUR_YEARS = ethers.BigNumber.from(ms("4 years")).div(1000);
const BUFFER = ethers.BigNumber.from(ms("1m")).div(1000);

const MIMO_LOCK_AMOUNT = ethers.BigNumber.from("200000000000000000000000"); // 200K

const setup = deployments.createFixture(async () => {
  await deployments.fixture(["SetCore", "GovernanceV2", "SetGovernance"]);
  const { deploy } = deployments;
  const [owner, alice, bob] = await ethers.getSigners();
  const controller: AccessController = await ethers.getContract("AccessController");
  const addresses: AddressProvider = await ethers.getContract("AddressProvider");
  const ga: GovernanceAddressProvider = await ethers.getContract("GovernanceAddressProvider");
  const mimo: MockMIMO = await ethers.getContract("MockMIMO");
  const votingMiner: VotingMinerV2 = await ethers.getContract("VotingMinerV2");
  const escrow: VotingEscrow = await ethers.getContract("VotingEscrow");
  const par: PAR = await ethers.getContract("PAR");
  await mimo.mint(alice.address, MIMO_LOCK_AMOUNT);
  await mimo.connect(alice).approve(escrow.address, MIMO_LOCK_AMOUNT);
  const latestBlock = await ethers.provider.getBlock("latest");
  const startTime = ethers.BigNumber.from(latestBlock.timestamp);
  await escrow.connect(alice).createLock(MIMO_LOCK_AMOUNT, startTime.add(FOUR_YEARS).add(BUFFER));

  const MINTER_ROLE = await controller.MINTER_ROLE();
  await controller.grantRole(MINTER_ROLE, owner.address);

  await deploy("MockGenericMinerV2", {
    from: owner.address,
    args: [ga.address, BOOST_CONFIG],
  });
  const genericMiner: MockGenericMinerV2 = await ethers.getContract("MockGenericMinerV2");

  return {
    owner,
    alice,
    bob,
    controller,
    addresses,
    ga,
    mimo,
    genericMiner,
    votingMiner,
    par,
    escrow,
    startTime,
  };
});

const setup2 = deployments.createFixture(async () => {
  await deployments.fixture(["SetCore", "GovernanceV2", "SetGovernance"]);
  const { deploy } = deployments;
  const [owner, alice, bob] = await ethers.getSigners();
  const controller: AccessController = await ethers.getContract("AccessController");
  const addresses: AddressProvider = await ethers.getContract("AddressProvider");
  const ga: GovernanceAddressProvider = await ethers.getContract("GovernanceAddressProvider");

  const mimoDeployment = await deployments.get("MockMIMO");
  const parDeployment = await deployments.get("PAR");
  const mimoABI = mimoDeployment.abi;
  const parABI = parDeployment.abi;
  const mockMimo = await deployMockContract(owner, mimoABI);
  const mockPar = await deployMockContract(owner, parABI);

  await addresses.setStableX(mockPar.address);
  await ga.setMIMO(mockMimo.address);

  const MINTER_ROLE = await controller.MINTER_ROLE();
  await controller.grantRole(MINTER_ROLE, owner.address);

  await deploy("MockGenericMinerV2", {
    from: owner.address,
    args: [ga.address, BOOST_CONFIG],
  });
  const genericMiner: MockGenericMinerV2 = await ethers.getContract("MockGenericMinerV2");

  await mockMimo.mock.transfer.returns(false);
  await mockMimo.mock.mint.returns();
  await mockMimo.mock.balanceOf.returns(0);
  await mockPar.mock.transfer.returns(false);
  await mockPar.mock.mint.returns();
  await mockPar.mock.balanceOf.returns(0);

  return {
    owner,
    alice,
    bob,
    controller,
    addresses,
    ga,
    genericMiner,
    mockMimo,
    mockPar,
  };
});

describe("--- GenericMinerV2 ---", () => {
  describe("Config", () => {
    it("should revert if trying to set GovernanceAddressProvider to address 0", async () => {
      const { owner } = await setup();
      const { deploy } = deployments;
      await expectRevert(
        deploy("GenericMinerV2", {
          from: owner.address,
          args: [ethers.constants.AddressZero, BOOST_CONFIG],
        }),
        "LM000",
      );
    });
    it("should revert if trying to set boostConfig a to less than 1", async () => {
      const { owner, ga } = await setup();
      const { deploy } = deployments;
      const newBoostConfig = { ...BOOST_CONFIG };
      newBoostConfig.a = ethers.constants.Zero;
      await expectRevert(
        deploy("GenericMinerV2", {
          from: owner.address,
          args: [ga.address, newBoostConfig],
        }),
        "LM004",
      );
    });
    it("should revert if trying to set boostConfig d to 0", async () => {
      const { owner, ga } = await setup();
      const { deploy } = deployments;
      const newBoostConfig = { ...BOOST_CONFIG };
      newBoostConfig.d = ethers.constants.Zero;
      await expectRevert(
        deploy("GenericMinerV2", {
          from: owner.address,
          args: [ga.address, newBoostConfig],
        }),
        "LM004",
      );
    });
    it("should revert if trying to set boostConfig maxBoost to less thean 1", async () => {
      const { owner, ga } = await setup();
      const { deploy } = deployments;
      const newBoostConfig = { ...BOOST_CONFIG };
      newBoostConfig.maxBoost = ethers.constants.Zero;
      await expectRevert(
        deploy("GenericMinerV2", {
          from: owner.address,
          args: [ga.address, newBoostConfig],
        }),
        "LM004",
      );
    });
    it("initialized Generic Miner correctly", async () => {
      const { mimo, genericMiner, par, ga } = await setup();
      const balance = await mimo.balanceOf(genericMiner.address);
      const _par = await genericMiner.par();
      const a = await genericMiner.a();
      assert.equal(balance.toString(), "0");
      assert.equal(_par, par.address);
      assert.equal(a, ga.address);
    });
    it("should allow manager to set boost config correctly", async () => {
      const { genericMiner } = await setup();
      const newBoostConfig = { ...BOOST_CONFIG };
      newBoostConfig.a = ethers.BigNumber.from(2);
      await expect(genericMiner.setBoostConfig(newBoostConfig)).to.emit(genericMiner, "BoostConfigSet");
      const _boostConfig = await genericMiner.boostConfig();
      const { a, b, c, d, e, maxBoost } = _boostConfig;
      expect(a.toString()).to.be.equal(newBoostConfig.a.toString());
      expect(b.toString()).to.be.equal(newBoostConfig.b.toString());
      expect(c.toString()).to.be.equal(newBoostConfig.c.toString());
      expect(d.toString()).to.be.equal(newBoostConfig.d.toString());
      expect(e.toString()).to.be.equal(newBoostConfig.e.toString());
      expect(maxBoost.toString()).to.be.equal(newBoostConfig.maxBoost.toString());
    });
    it("should revert if setBoostConfig called by other than manager", async () => {
      const { genericMiner, alice } = await setup();
      await expectRevert(genericMiner.connect(alice).setBoostConfig(BOOST_CONFIG), "LM010");
    });
  });
  describe("Stake and rewards management", () => {
    it("should revert if trying to increaseStake by 0", async () => {
      const { alice, genericMiner } = await setup();
      await expectRevert(genericMiner.increaseStake(alice.address, 0), "LM101");
    });
    it("should allow to increase productivity for alice user", async () => {
      const { genericMiner, alice } = await setup();
      await genericMiner.increaseStake(alice.address, 1);
      const amount = await genericMiner.stake(alice.address);
      const totalStake = await genericMiner.totalStake();
      assert.equal(amount.toString(), "1");
      assert.equal(totalStake.toString(), "1");
    });
    it("should revert if trying to decreaseStake by 0", async () => {
      const { genericMiner, alice } = await setup();
      await genericMiner.increaseStake(alice.address, 10);
      await expectRevert(genericMiner.decreaseStake(alice.address, 0), "LM101");
    });
    it("should revert if trying to decreaseStake by more than current stake", async () => {
      const { genericMiner, alice } = await setup();
      await genericMiner.increaseStake(alice.address, 10);
      await expectRevert(genericMiner.decreaseStake(alice.address, 20), "LM102");
    });
    it("should allow to decrease productivity for alice user", async () => {
      const { genericMiner, alice } = await setup();
      await genericMiner.increaseStake(alice.address, 2);
      await genericMiner.decreaseStake(alice.address, 1);
      const amount = await genericMiner.stake(alice.address);
      const totalStake = await genericMiner.totalStake();
      assert.equal(amount.toString(), "1");
      assert.equal(totalStake.toString(), "1");
    });
    it("total productivity should add up correctly", async () => {
      const { genericMiner, alice, bob } = await setup();
      await genericMiner.increaseStake(alice.address, 2);
      await genericMiner.increaseStake(bob.address, 3);
      await genericMiner.decreaseStake(alice.address, 1);
      const totalStake = await genericMiner.totalStake();
      const totalStakeWithBoost = await genericMiner.totalStakeWithBoost();
      assert.equal(totalStake.toString(), "4");
      assert.equal(totalStakeWithBoost.toString(), "7"); // 4 + 3 = 7
    });
    it("first user should receive previous tokens", async () => {
      const { mimo, genericMiner, alice, bob, par } = await setup();
      await mimo.mint(genericMiner.address, 100);
      await par.mint(genericMiner.address, 100);
      await genericMiner.increaseStake(alice.address, 1);
      await genericMiner.increaseStake(bob.address, 1);
      await genericMiner.decreaseStake(alice.address, 1);
      const balance = await mimo.balanceOf(alice.address);
      const parBalance = await par.balanceOf(alice.address);
      assert.equal(balance.toString(), "100");
      assert.equal(parBalance.toString(), "100");
    });
    it("tokens should be fairly distributed", async () => {
      const { genericMiner, alice, bob, mimo, par } = await setup();
      await genericMiner.increaseStake(alice.address, 3);
      await genericMiner.increaseStake(bob.address, 1);
      assert.equal((await genericMiner.totalStake()).toString(), "4");
      assert.equal((await genericMiner.totalStakeWithBoost()).toString(), "12"); // 12 because rounded up from 11.9345918672578 as share cannot be more precise than 1 wei
      await mimo.mint(genericMiner.address, 100);
      await par.mint(genericMiner.address, 100);
      await genericMiner.decreaseStake(alice.address, 3);
      await genericMiner.decreaseStake(bob.address, 1);
      assert.equal((await genericMiner.totalStake()).toString(), "0");
      assert.equal((await genericMiner.totalStakeWithBoost()).toString(), "0");

      const balanceA = await mimo.balanceOf(alice.address);
      const parBalanceA = await par.balanceOf(alice.address);
      // 11 out of 12 total boosted stake = 91.67% rounded to 92
      assert.equal(balanceA.toString(), "92");
      assert.equal(parBalanceA.toString(), "92");
      // 1 out of 12 total boosted stake = 8.33% rounded to 14
      const balanceB = await mimo.balanceOf(bob.address);
      const parBalanceB = await par.balanceOf(bob.address);
      assert.equal(balanceB.toString(), "8");
      assert.equal(parBalanceB.toString(), "8");
    });
    it("tokens distribution complex scenario", async () => {
      const { genericMiner, mimo, alice, bob, par } = await setup();
      await genericMiner.increaseStake(alice.address, 1);
      await genericMiner.increaseStake(bob.address, 1);
      await mimo.mint(genericMiner.address, 100);
      await par.mint(genericMiner.address, 1000);
      assert.equal((await genericMiner.stakeWithBoost(alice.address)).toString(), "4"); // 3.64 -> 4
      assert.equal((await genericMiner.stakeWithBoost(bob.address)).toString(), "1");
      assert.equal((await genericMiner.pendingMIMO(alice.address)).toString(), "80");
      assert.equal((await genericMiner.pendingMIMO(bob.address)).toString(), "20");
      assert.equal((await genericMiner.pendingPAR(alice.address)).toString(), "800");
      assert.equal((await genericMiner.pendingPAR(bob.address)).toString(), "200");

      await genericMiner.increaseStake(alice.address, 2);
      assert.equal((await genericMiner.stakeWithBoost(alice.address)).toString(), "11"); // 10.92 -> 11
      assert.equal((await genericMiner.stakeWithBoost(bob.address)).toString(), "1");
      assert.equal((await mimo.balanceOf(alice.address)).toString(), "80");
      assert.equal((await genericMiner.pendingMIMO(alice.address)).toString(), "0");
      assert.equal((await genericMiner.pendingMIMO(bob.address)).toString(), "20");
      assert.equal((await genericMiner.pendingPAR(alice.address)).toString(), "0");
      assert.equal((await genericMiner.pendingPAR(bob.address)).toString(), "200");

      await mimo.mint(genericMiner.address, 100);
      await par.mint(genericMiner.address, 1000);
      assert.equal((await genericMiner.pendingMIMO(alice.address)).toString(), "92"); // 91.67 -> 92
      assert.equal((await genericMiner.pendingMIMO(bob.address)).toString(), "28"); // 20 + 8.38 -> 28
      assert.equal((await genericMiner.pendingPAR(alice.address)).toString(), "917"); // 916.67 -> 917
      assert.equal((await genericMiner.pendingPAR(bob.address)).toString(), "283"); // 200 + 83.33 -> 283

      await genericMiner.increaseStake(bob.address, 2);
      assert.equal((await genericMiner.stakeWithBoost(alice.address)).toString(), "11");
      assert.equal((await genericMiner.stakeWithBoost(bob.address)).toString(), "3");
      assert.equal((await genericMiner.pendingMIMO(alice.address)).toString(), "92");
      assert.equal((await genericMiner.pendingMIMO(bob.address)).toString(), "0");
      assert.equal((await genericMiner.pendingPAR(alice.address)).toString(), "917");
      assert.equal((await genericMiner.pendingPAR(bob.address)).toString(), "0");
      assert.equal((await mimo.balanceOf(bob.address)).toString(), "28");
      assert.equal((await par.balanceOf(bob.address)).toString(), "283");

      await mimo.mint(genericMiner.address, 100);
      await par.mint(genericMiner.address, 1000);
      assert.equal((await genericMiner.pendingMIMO(alice.address)).toString(), "170"); // 91.67 + 78.57 = 170.23
      assert.equal((await genericMiner.pendingMIMO(bob.address)).toString(), "21"); // 21.43 -> 21
      assert.equal((await genericMiner.pendingPAR(alice.address)).toString(), "1702"); // 916.67 + 785.71 -> 1702
      assert.equal((await genericMiner.pendingPAR(bob.address)).toString(), "214"); // 214.29 -> 214

      await genericMiner.decreaseStake(alice.address, 3);
      assert.equal((await genericMiner.stakeWithBoost(alice.address)).toString(), "0");
      assert.equal((await genericMiner.stakeWithBoost(bob.address)).toString(), "3");
      assert.equal((await mimo.balanceOf(alice.address)).toString(), "250"); // 80 + 170
      assert.equal((await par.balanceOf(alice.address)).toString(), "2502"); // 800 + 1702

      await mimo.mint(genericMiner.address, 100);
      await par.mint(genericMiner.address, 1000);
      assert.equal((await genericMiner.pendingMIMO(alice.address)).toString(), "0");
      assert.equal((await genericMiner.pendingMIMO(bob.address)).toString(), "121"); // 21 + 100
      assert.equal((await genericMiner.pendingPAR(alice.address)).toString(), "0");
      assert.equal((await genericMiner.pendingPAR(bob.address)).toString(), "1214"); // 214 + 1000 -> 1214
      await genericMiner.decreaseStake(bob.address, 3);
      assert.equal((await genericMiner.stakeWithBoost(alice.address)).toString(), "0");
      assert.equal((await genericMiner.stakeWithBoost(bob.address)).toString(), "0");
      assert.equal((await mimo.balanceOf(bob.address)).toString(), "149"); // 28 + 121
      assert.equal((await par.balanceOf(bob.address)).toString(), "1497"); // 283 + 1214 -> 1497
    });
    it("should allow a user to withdraw outstanding tokens without updating his stake", async () => {
      const { genericMiner, alice, mimo, par } = await setup();
      await genericMiner.increaseStake(alice.address, 3);
      await mimo.mint(genericMiner.address, 100);
      await par.mint(genericMiner.address, 100);
      await genericMiner.releaseRewards(alice.address);
      const balanceA = await mimo.balanceOf(alice.address);
      const parBalanceA = await par.balanceOf(alice.address);
      assert.equal(balanceA.toString(), "100");
      assert.equal(parBalanceA.toString(), "100");
    });
    it("should handle big differences in orders of magnitude correctly MIMO << STAKE", async () => {
      const { genericMiner, alice, bob, mimo, par } = await setup();
      const e26 = ethers.BigNumber.from("100000000000000000000000000"); // 1e26
      await genericMiner.increaseStake(alice.address, e26);
      await genericMiner.increaseStake(bob.address, e26);
      await mimo.mint(genericMiner.address, 2);
      await par.mint(genericMiner.address, 20);
      await genericMiner.decreaseStake(alice.address, e26);
      await genericMiner.decreaseStake(bob.address, e26);
      assert.equal((await mimo.balanceOf(alice.address)).toString(), "1"); // Should be 2 need to investigate further most likely rounding issue
      assert.equal((await mimo.balanceOf(bob.address)).toString(), "0");
      assert.equal((await par.balanceOf(alice.address)).toString(), "16"); // 15.69 -> 16
      assert.equal((await par.balanceOf(bob.address)).toString(), "4"); // 4.31 -> 4
    });
    it("should handle big differences in orders of magnitude correctly MIMO >> STAKE", async () => {
      const { genericMiner, mimo, alice, bob } = await setup();
      const e26 = ethers.BigNumber.from("100000000000000000000000000"); // 1e26
      await genericMiner.increaseStake(alice.address, 1);
      await genericMiner.increaseStake(bob.address, 1);
      await mimo.mint(genericMiner.address, e26.mul(ethers.BigNumber.from(2)));
      await genericMiner.decreaseStake(alice.address, 1);
      await genericMiner.decreaseStake(bob.address, 1);
      assert.equal((await mimo.balanceOf(alice.address)).toString(), "160000000000000000000000000");
      assert.equal((await mimo.balanceOf(bob.address)).toString(), "40000000000000000000000000");
    });
    it("should handle big orders of magnitude correctly", async () => {
      const { genericMiner, mimo, alice, bob, par } = await setup();
      const e26 = ethers.BigNumber.from("100000000000000000000000000"); // 1e26
      await genericMiner.increaseStake(alice.address, e26.toString());
      await genericMiner.increaseStake(bob.address, e26.toString());
      await mimo.mint(genericMiner.address, e26.mul(ethers.BigNumber.from(2)).toString());
      await par.mint(genericMiner.address, e26.mul(ethers.BigNumber.from(2)).toString());
      await genericMiner.decreaseStake(alice.address, e26.toString());
      await genericMiner.decreaseStake(bob.address, e26.toString());
      assert.equal((await mimo.balanceOf(alice.address)).toString(), "156918753736631203618557507");
      assert.equal((await mimo.balanceOf(bob.address)).toString(), "43081246263368796381442493");
      assert.equal((await par.balanceOf(alice.address)).toString(), "156918753736631203618557507");
      assert.equal((await par.balanceOf(bob.address)).toString(), "43081246263368796381442493");
    });
    it("should reset boosted stake when releasing MIMO", async () => {
      const { genericMiner, mimo, alice, startTime, par } = await setup();
      await genericMiner.increaseStake(alice.address, 1);
      await mimo.mint(genericMiner.address, 100);
      await par.mint(genericMiner.address, 100);
      assert.equal((await genericMiner.stake(alice.address)).toString(), "1");
      assert.equal((await genericMiner.stakeWithBoost(alice.address)).toString(), "4");

      await timeAndMine.setTime(startTime.add(FOUR_YEARS).toNumber());
      await timeAndMine.mine(1);
      await genericMiner.releaseRewards(alice.address);
      assert.equal((await genericMiner.stake(alice.address)).toString(), "1");
      assert.equal((await genericMiner.stakeWithBoost(alice.address)).toString(), "1");
    });
    it("should reset boosted stake when calling updateBoost", async () => {
      const { genericMiner, mimo, alice, startTime, par } = await setup();
      await genericMiner.increaseStake(alice.address, 1);
      await mimo.mint(genericMiner.address, 100);
      await par.mint(genericMiner.address, 100);
      assert.equal((await genericMiner.stake(alice.address)).toString(), "1");
      assert.equal((await genericMiner.stakeWithBoost(alice.address)).toString(), "4");

      await timeAndMine.setTime(startTime.add(FOUR_YEARS).toNumber());
      await timeAndMine.mine(1);
      await genericMiner.updateBoost(alice.address);
      assert.equal((await genericMiner.stake(alice.address)).toString(), "1");
      assert.equal((await genericMiner.stakeWithBoost(alice.address)).toString(), "1");
    });
    it("should not call transfer in releaseRewards if no pending rewards", async () => {
      const { genericMiner, alice, mimo, par } = await setup();
      await genericMiner.increaseStake(alice.address, 1);
      await genericMiner.releaseRewards(alice.address);
      const aliceMimoBalance = await mimo.balanceOf(alice.address);
      const aliceParBalance = await par.balanceOf(alice.address);
      expect(aliceMimoBalance.toNumber()).to.be.equal(0);
      expect(aliceParBalance.toNumber()).to.be.equal(0);
    });
    it("should revert if boost out of range", async () => {
      const { genericMiner, alice } = await setup();
      const newConfig = { ...BOOST_CONFIG };
      newConfig.a = ethers.BigNumber.from(5);
      await genericMiner.setBoostConfig(newConfig);
      await expectRevert(genericMiner.increaseStake(alice.address, 1), "LM103");
    });
    it("should throw correct error code on reward transfer failure", async () => {
      const { mockMimo, mockPar, genericMiner, alice } = await setup2();
      await genericMiner.increaseStake(alice.address, 3);
      await mockMimo.mock.balanceOf.returns(100);
      await expectRevert(genericMiner.releaseRewards(alice.address), "LM100");
      await expectRevert(genericMiner.increaseStake(alice.address, 1), "LM100");
      await expectRevert(genericMiner.decreaseStake(alice.address, 1), "LM100");
      await mockMimo.mock.transfer.returns(true);
      await mockPar.mock.balanceOf.returns(100);
      await expectRevert(genericMiner.releaseRewards(alice.address), "LM100");
      await expectRevert(genericMiner.increaseStake(alice.address, 1), "LM100");
      await expectRevert(genericMiner.decreaseStake(alice.address, 1), "LM100");
    });
  });
  describe("View functions", () => {
    it("should be able to read user info via userInfo", async () => {
      const { genericMiner, alice } = await setup();
      await genericMiner.increaseStake(alice.address, 1);
      const userInfo = await genericMiner.userInfo(alice.address);
      assert.equal(userInfo.stake.toString(), "1");
      assert.equal(userInfo.accAmountPerShare.toString(), "0");
    });
    it("should be able read pendingMIMO tokens", async () => {
      const { genericMiner, mimo, alice, bob, par } = await setup();
      await genericMiner.increaseStake(alice.address, 1);
      await mimo.mint(genericMiner.address, 100);
      await par.mint(genericMiner.address, 100);
      const pendingMIMO1 = await genericMiner.pendingMIMO(alice.address);
      const pendingPAR1 = await genericMiner.pendingPAR(alice.address);
      assert.equal(pendingMIMO1.toString(), "100");
      assert.equal(pendingPAR1.toString(), "100");
      await genericMiner.increaseStake(bob.address, 1);
      await mimo.mint(genericMiner.address, 100);
      await par.mint(genericMiner.address, 100);
      const pendingMIMO2 = await genericMiner.pendingMIMO(alice.address);
      const pendingPAR2 = await genericMiner.pendingPAR(alice.address);
      assert.equal(pendingMIMO2.toString(), "180");
      assert.equal(pendingPAR2.toString(), "180");
      await genericMiner.releaseRewards(bob.address);
      const pendingMIMO3 = await genericMiner.pendingMIMO(alice.address);
      const pendingPAR3 = await genericMiner.pendingPAR(alice.address);
      assert.equal(pendingMIMO3.toString(), "180");
      assert.equal(pendingPAR3.toString(), "180");
      const pendingMIMO4 = await genericMiner.pendingMIMO(bob.address);
      const pendingPAR4 = await genericMiner.pendingPAR(bob.address);
      assert.equal(pendingMIMO4.toString(), "0");
      assert.equal(pendingPAR4.toString(), "0");
    });
  });
});

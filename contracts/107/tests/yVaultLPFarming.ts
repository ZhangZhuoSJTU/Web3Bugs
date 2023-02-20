import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { Controller, JPEG, MockStrategy, TestERC20, YVault, YVaultLPFarming } from "../types";
import { units, ZERO_ADDRESS } from "./utils";

const { expect } = chai;

chai.use(solidity);

const strategist_role =
  "0x17a8e30262c1f919c33056d877a3c22b95c2f5e4dac44683c1c2323cd79fbdb0";
const minter_role =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

describe("yVaultLPFarming", () => {
    let owner: SignerWithAddress,
    user1: SignerWithAddress,
    contract: SignerWithAddress;
  //we are mocking the strategy because setting up the test environment for
  //{StrategyPUSDConvex} is complicated, check StrategyPUSDConvex.ts
  let strategy: MockStrategy;
  let lpFarming: YVaultLPFarming, yVault: YVault, controller: Controller;
  let jpeg: JPEG, token: TestERC20;

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    user1 = accounts[1];
    contract = accounts[2];

    await network.provider.send("hardhat_setCode", [contract.address, "0xab"]); //simulate a contract

    const JPEG = await ethers.getContractFactory("JPEG");
    jpeg = await JPEG.deploy(units(0)); 
    await jpeg.deployed();
    await jpeg.grantRole(minter_role, owner.address);

    const Controller = await ethers.getContractFactory("Controller");
    controller = await Controller.deploy(jpeg.address, owner.address);
    await controller.deployed();

    await controller.grantRole(strategist_role, owner.address);

    const ERC20 = await ethers.getContractFactory("TestERC20");
    token = await ERC20.deploy("TEST", "TEST");
    await token.deployed();

    const RewardPool = await ethers.getContractFactory("MockRewardPool");
    
    const rewardPool = await RewardPool.deploy(
      token.address,
      jpeg.address,
      []
    );
    await rewardPool.deployed();

    const Strategy = await ethers.getContractFactory("MockStrategy");
    strategy = await Strategy.deploy(
      token.address,
      jpeg.address,
      rewardPool.address
    );
    await strategy.deployed();

    await controller.approveStrategy(token.address, strategy.address);
    await controller.setStrategy(token.address, strategy.address);

    const YVault = await ethers.getContractFactory("YVault");

    yVault = await YVault.deploy(token.address, controller.address, {
      numerator: 95,
      denominator: 100,
    });
    await yVault.deployed();

    await controller.setVault(token.address, yVault.address);

    const LPFarming = await ethers.getContractFactory("YVaultLPFarming");

    await expect(LPFarming.deploy(ZERO_ADDRESS, jpeg.address)).to.be.revertedWith("INVALID_VAULT");
    await expect(LPFarming.deploy(yVault.address, ZERO_ADDRESS)).to.be.revertedWith("INVALID_JPEG");

    lpFarming = await LPFarming.deploy(yVault.address, jpeg.address);

    await yVault.setFarmingPool(lpFarming.address);
  });

  it("should allow users to deposit tokens", async () => {
      await expect(lpFarming.deposit(0)).to.be.revertedWith("invalid_amount");

      await token.mint(owner.address, units(500));
      await token.approve(yVault.address, units(500));
      await yVault.depositAll();

      await yVault.approve(lpFarming.address, units(500));
      await lpFarming.deposit(units(500));

      expect(await lpFarming.totalStaked()).to.equal(units(500));
      expect(await lpFarming.balanceOf(owner.address)).to.equal(units(500));
  });

  it("should allow users to withdraw", async () => {
    await token.mint(owner.address, units(500));
    await token.approve(yVault.address, units(500));
    await yVault.depositAll();

    await yVault.approve(lpFarming.address, units(500));
    await lpFarming.deposit(units(500));

    await expect(lpFarming.withdraw(0)).to.be.revertedWith("invalid_amount");
    await expect(lpFarming.withdraw(units(600))).to.be.revertedWith("insufficient_amount");

    await lpFarming.withdraw(units(500));

    expect(await lpFarming.totalStaked()).to.equal(0);
    expect(await lpFarming.balanceOf(owner.address)).to.equal(0);
  });

  it("should allow users to claim", async () => {
    await token.mint(owner.address, units(500));
    await token.mint(user1.address, units(250));
    await token.approve(yVault.address, units(500));
    await token.connect(user1).approve(yVault.address, units(250));
    await yVault.depositAll();
    await yVault.connect(user1).depositAll();

    await yVault.approve(lpFarming.address, units(500));
    await lpFarming.deposit(units(500));
  
    await jpeg.mint(strategy.address, units(500));
    expect(await lpFarming.pendingReward(owner.address)).to.equal(units(500));

    await yVault.connect(user1).approve(lpFarming.address, units(250));
    await lpFarming.connect(user1).deposit(units(250));
    expect(await lpFarming.pendingReward(user1.address)).to.equal(0);

    await jpeg.mint(strategy.address, units(300));
    expect(await lpFarming.pendingReward(owner.address)).to.equal(units(700));
    expect(await lpFarming.pendingReward(user1.address)).to.equal(units(100));

    await lpFarming.claim();
    expect(await jpeg.balanceOf(owner.address)).to.equal(units(700));
    expect(await lpFarming.pendingReward(owner.address)).to.equal(0);
    expect(await lpFarming.pendingReward(user1.address)).to.equal(units(100));

    await lpFarming.connect(user1).claim();
    expect(await jpeg.balanceOf(user1.address)).to.equal(units(100));
    expect(await lpFarming.pendingReward(user1.address)).to.equal(0);

    await expect(lpFarming.claim()).to.be.revertedWith("no_reward");
});

it("should not allow non whitelisted contracts to farm", async () => {
    await token.mint(owner.address, units(500));
    await token.approve(yVault.address, units(500));
    await yVault.depositAll();
    await yVault.transfer(contract.address, units(500));
    await yVault.connect(contract).approve(lpFarming.address, units(500));
    await expect(
      lpFarming.connect(contract).deposit(units(500))
    ).to.be.revertedWith("Contracts aren't allowed to farm");
  });

  it("should allow whitelisted contracts to farm", async () => {
    await token.mint(owner.address, units(500));
    await token.approve(yVault.address, units(500));
    await yVault.depositAll();
    await yVault.transfer(contract.address, units(500));
    await yVault.connect(contract).approve(lpFarming.address, units(500));
    await lpFarming.setContractWhitelisted(contract.address, true);
    await lpFarming.connect(contract).deposit(units(500));
  });
});

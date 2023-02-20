import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { Controller, JPEG, MockStrategy, TestERC20, YVault } from "../types";
import { units, ZERO_ADDRESS } from "./utils";

const { expect } = chai;

chai.use(solidity);

const strategist_role =
  "0x17a8e30262c1f919c33056d877a3c22b95c2f5e4dac44683c1c2323cd79fbdb0";
const minter_role =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

describe("Controller", () => {
  let owner: SignerWithAddress;
  //we are mocking the strategy because setting up the test environment for
  //{StrategyPUSDConvex} is complicated, check StrategyPUSDConvex.ts
  let strategy: MockStrategy;
  let yVault: YVault, controller: Controller;
  let jpeg: JPEG, token: TestERC20;

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    owner = accounts[0];

    const JPEG = await ethers.getContractFactory("JPEG");
    jpeg = await JPEG.deploy(0);
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

    const YVault = await ethers.getContractFactory("YVault");

    yVault = await YVault.deploy(token.address, controller.address, {
      numerator: 95,
      denominator: 100,
    });
    await yVault.deployed();
  });

  it("should return the correct JPEG balance", async () => {
    await controller.approveStrategy(token.address, strategy.address);
    await controller.setStrategy(token.address, strategy.address);
    await jpeg.mint(strategy.address, units(500));
    expect(await controller.balanceOfJPEG(token.address)).to.equal(units(500));
  });

  it("should allow the vault to withdraw jpeg", async () => {
    await controller.approveStrategy(token.address, strategy.address);
    await controller.setStrategy(token.address, strategy.address);
    
    await jpeg.mint(strategy.address, units(500));
    await yVault.setFarmingPool(owner.address);

    await expect(yVault.withdrawJPEG()).to.be.revertedWith("NOT_VAULT");

    await controller.setVault(token.address, yVault.address);

    await yVault.withdrawJPEG();
    expect(await jpeg.balanceOf(owner.address)).to.equal(units(500));
  });

  it("should allow admins to set the fee address", async () => {
    await expect(controller.setFeeAddress(ZERO_ADDRESS)).to.be.revertedWith(
      "INVALID_FEE_ADDRESS"
    );

    await controller.setFeeAddress(owner.address);
  });

  it("should allow strategists to set vaults for tokens", async () => {
    await expect(
      controller.setVault(token.address, ZERO_ADDRESS)
    ).to.be.revertedWith("INVALID_VAULT");

    await controller.setVault(token.address, yVault.address);

    await expect(
      controller.setVault(token.address, yVault.address)
    ).to.be.revertedWith("ALREADY_HAS_VAULT");
  });

  it("should allow admins to approve and revoke strategies", async () => {
    await expect(
      controller.approveStrategy(ZERO_ADDRESS, strategy.address)
    ).to.be.revertedWith("INVALID_TOKEN");
    await expect(
      controller.approveStrategy(token.address, ZERO_ADDRESS)
    ).to.be.revertedWith("INVALID_STRATEGY");
    await controller.approveStrategy(token.address, strategy.address);

    await expect(
      controller.revokeStrategy(ZERO_ADDRESS, strategy.address)
    ).to.be.revertedWith("INVALID_TOKEN");
    await expect(
      controller.revokeStrategy(token.address, ZERO_ADDRESS)
    ).to.be.revertedWith("INVALID_STRATEGY");
    await controller.revokeStrategy(token.address, strategy.address);
  });

  it("should allow strategists to set strategies", async () => {
    await expect(
      controller.setStrategy(token.address, strategy.address)
    ).to.be.revertedWith("STRATEGY_NOT_APPROVED");

    await controller.setVault(token.address, yVault.address);

    await controller.approveStrategy(token.address, strategy.address);
    await controller.setStrategy(token.address, strategy.address);

    await token.mint(strategy.address, units(500));
    await controller.setStrategy(token.address, strategy.address);

    expect(await token.balanceOf(yVault.address)).to.equal(units(500));
  });

  it("should deposit tokens into the strategy when calling earn", async () => {
    await controller.approveStrategy(token.address, strategy.address);
    await controller.setStrategy(token.address, strategy.address);

    await token.mint(controller.address, units(500));

    await controller.earn(token.address, units(500));
    expect(await token.balanceOf(strategy.address)).to.equal(units(500));
    expect(await controller.balanceOf(token.address)).to.equal(units(500));
  });

  it("should allow strategists to withdraw all tokens from a strategy", async () => {
    await controller.approveStrategy(token.address, strategy.address);
    await controller.setStrategy(token.address, strategy.address);
    await controller.setVault(token.address, yVault.address);

    await token.mint(strategy.address, units(500));

    await controller.withdrawAll(token.address);

    expect(await token.balanceOf(yVault.address)).to.equal(units(500));
  });

  it("should allow strategists to withdraw tokens", async () => {
    await token.mint(controller.address, units(500));

    await controller.inCaseTokensGetStuck(token.address, units(500));
    expect(await token.balanceOf(owner.address)).to.equal(units(500));
  });

  it("should allow strategists to withdraw tokens from a strategy", async () => {
    await controller.approveStrategy(token.address, strategy.address);
    await controller.setStrategy(token.address, strategy.address);

    await token.mint(strategy.address, units(500));
    //this strategy is a mock strategy and allows withdrawing strategy tokens.
    //{StrategyPUSDConvex} only allows withdrawing non strategy tokens
    await controller.inCaseStrategyTokensGetStuck(
      strategy.address,
      token.address
    );

    expect(await token.balanceOf(controller.address)).to.equal(units(500));
  });

  it("should allow vaults to withdraw tokens from a strategy", async () => {
    await controller.approveStrategy(token.address, strategy.address);
    await controller.setStrategy(token.address, strategy.address);

    await expect(
      controller.withdraw(token.address, units(500))
    ).to.be.revertedWith("NOT_VAULT");

    await controller.setVault(token.address, owner.address);

    await token.mint(strategy.address, units(500));

    await controller.withdraw(token.address, units(500));

    expect(await token.balanceOf(owner.address)).to.equal(units(500));
  });
});

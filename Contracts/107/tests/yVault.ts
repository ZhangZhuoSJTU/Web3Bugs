import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { Controller, JPEG, MockStrategy, TestERC20, YVault } from "../types";
import { units, ZERO_ADDRESS } from "./utils";

const { expect } = chai;

chai.use(solidity);

const strategist_role =
  "0x17a8e30262c1f919c33056d877a3c22b95c2f5e4dac44683c1c2323cd79fbdb0";
const minter_role =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

describe("yVault", () => {
  let owner: SignerWithAddress,
    user1: SignerWithAddress,
    contract: SignerWithAddress;
  //we are mocking the strategy because setting up the test environment for
  //{StrategyPUSDConvex} is complicated, check StrategyPUSDConvex.ts
  let strategy: MockStrategy;
  let yVault: YVault, controller: Controller;
  let jpeg: JPEG, token: TestERC20;

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    user1 = accounts[1];
    contract = accounts[2];

    await network.provider.send("hardhat_setCode", [contract.address, "0xab"]); //simulate a contract

    const JPEG = await ethers.getContractFactory("JPEG");
    jpeg = await JPEG.deploy(0);
    await jpeg.deployed();
    await jpeg.grantRole(minter_role, owner.address)

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

    await expect(
      YVault.deploy(token.address, ZERO_ADDRESS, {
        numerator: 95,
        denominator: 100,
      })
    ).to.be.revertedWith("INVALID_CONTROLLER");

    await expect(
      YVault.deploy(token.address, controller.address, {
        numerator: 0,
        denominator: 100,
      })
    ).to.be.revertedWith("INVALID_RATE");

    yVault = await YVault.deploy(token.address, controller.address, {
      numerator: 95,
      denominator: 100,
    });
    await yVault.deployed();

    await controller.setVault(token.address, yVault.address);
  });

  it("should have the same decimals as the deposit token", async () => {
    await token.setDecimals(10);
    expect(await yVault.decimals()).to.equal(10);

    await token.setDecimals(18);
    expect(await yVault.decimals()).to.equal(18);
  });

  it("should return the correct JPEG balance", async () => {
    await jpeg.mint(strategy.address, units(500));
    expect(await yVault.balanceOfJPEG()).to.equal(units(500));
  });

  it("should allow the farm to withdraw JPEG", async () => {
    await jpeg.mint(strategy.address, units(500));
    
    await expect(yVault.withdrawJPEG()).to.be.revertedWith("NO_FARM");

    await expect(yVault.setFarmingPool(ZERO_ADDRESS)).to.be.revertedWith("INVALID_FARMING_POOL");

    await yVault.setFarmingPool(owner.address);
    await yVault.withdrawJPEG();

    expect(await jpeg.balanceOf(owner.address)).to.equal(units(500));
  });

  it("should allow users to deposit", async () => {
    await token.mint(user1.address, units(1000));
    await token.connect(user1).approve(yVault.address, units(1000));

    await expect(yVault.connect(user1).deposit(0)).to.be.revertedWith(
      "INVALID_AMOUNT"
    );

    await yVault.connect(user1).deposit(units(500));
    expect(await yVault.balanceOf(user1.address)).to.equal(units(500));
    await yVault.connect(user1).depositAll();
    expect(await yVault.balanceOf(user1.address)).to.equal(units(1000));
  });

  it("should mint the correct amount of tokens", async () => {
    expect(await yVault.getPricePerFullShare()).to.equal(0);
    await token.mint(user1.address, units(1000));
    await token.connect(user1).approve(yVault.address, units(1000));

    await yVault.connect(user1).deposit(units(500));
    expect(await yVault.balanceOf(user1.address)).to.equal(units(500));

    await token.mint(strategy.address, units(500));

    expect(await yVault.getPricePerFullShare()).to.equal(units(2));

    await yVault.connect(user1).deposit(units(500));
    expect(await yVault.balanceOf(user1.address)).to.equal(units(750));
  });

  it("should deposits tokens into the strategy when calling earn", async () => {
    await token.mint(user1.address, units(1000));
    await token.connect(user1).approve(yVault.address, units(1000));

    await yVault.connect(user1).depositAll();
    const available = await yVault.available();

    expect(available).to.equal(units(950));

    await yVault.earn();

    expect(await token.balanceOf(strategy.address)).to.equal(units(950));
    expect(await token.balanceOf(yVault.address)).to.equal(units(50));
  });

  it("should withdraw the correct amount of tokens", async () => {
    await token.mint(user1.address, units(1000));
    await token.connect(user1).approve(yVault.address, units(1000));

    await expect(yVault.connect(user1).withdraw(0)).to.be.revertedWith(
      "INVALID_AMOUNT"
    );
    await expect(yVault.connect(user1).withdraw(units(500))).to.be.revertedWith(
      "NO_TOKENS_DEPOSITED"
    );

    await yVault.connect(user1).depositAll();

    await yVault.connect(user1).withdraw(units(500));
    expect(await token.balanceOf(user1.address)).to.equal(units(500));

    await token.mint(strategy.address, units(500));

    await yVault.connect(user1).withdraw(units(250));
    expect(await token.balanceOf(user1.address)).to.equal(units(1000));
    expect(await token.balanceOf(yVault.address)).to.equal(0);
    expect(await token.balanceOf(strategy.address)).to.equal(units(500));

    await yVault.connect(user1).withdrawAll();
    expect(await token.balanceOf(user1.address)).to.equal(units(1500));
  });

  it("should not allow non whitelisted contracts to deposit and withdraw", async () => {
    await expect(
      yVault.connect(contract).deposit(units(1000))
    ).to.be.revertedWith("Contracts not allowed");
    await expect(
      yVault.connect(contract).withdraw(units(1000))
    ).to.be.revertedWith("Contracts not allowed");
  });

  it("should allow whitelisted contracts to deposit/withdraw", async () => {
    await token.mint(contract.address, units(1000));
    await token.connect(contract).approve(yVault.address, units(1000));

    await yVault.setContractWhitelisted(contract.address, true);
    await yVault.connect(contract).depositAll();
    await yVault.connect(contract).withdrawAll();
  });
});

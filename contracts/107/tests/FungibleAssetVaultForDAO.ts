import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, upgrades } from "hardhat";
import { units, bn, ZERO_ADDRESS, checkAlmostSame } from "./utils";
import {
  CryptoPunks,
  FungibleAssetVaultForDAO,
  MockV3Aggregator,
  StableCoin,
  TestERC20,
} from "../types";

const { expect } = chai;

chai.use(solidity);

const default_admin_role =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const minter_role =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const whitelisted_role =
  "0x8429d542926e6695b59ac6fbdcd9b37e8b1aeb757afab06ab60b1bb5878c3b49";

describe("FungibleAssetVaultForDAO", () => {
  let owner: SignerWithAddress, dao: SignerWithAddress, user: SignerWithAddress;
  let ethVault: FungibleAssetVaultForDAO,
    usdcVault: FungibleAssetVaultForDAO,
    eth_oracle: MockV3Aggregator,
    usd_oracle: MockV3Aggregator,
    usdc: TestERC20,
    stablecoin: StableCoin,
    cryptopunks: CryptoPunks;

  before(async () => {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    dao = accounts[1];
    user = accounts[2];

    const CryptoPunks = await ethers.getContractFactory("CryptoPunks");
    cryptopunks = await CryptoPunks.deploy();
    await cryptopunks.deployed();

    const TestERC20 = await ethers.getContractFactory("TestERC20");
    usdc = await TestERC20.deploy("Test USDC", "USDC");
    await usdc.deployed();

    const StableCoin = await ethers.getContractFactory("StableCoin");
    stablecoin = await StableCoin.deploy();
    await stablecoin.deployed();

    const MockAggregator = await ethers.getContractFactory("MockV3Aggregator");
    eth_oracle = await MockAggregator.deploy(8, 3000e8);
    await eth_oracle.deployed();

    usd_oracle = await MockAggregator.deploy(8, 1e8);
    await usd_oracle.deployed();

    const FungibleAssetVaultForDAO = await ethers.getContractFactory(
      "FungibleAssetVaultForDAO"
    );
    usdcVault = <FungibleAssetVaultForDAO>(
      await upgrades.deployProxy(FungibleAssetVaultForDAO, [
        usdc.address,
        stablecoin.address,
        usd_oracle.address,
        [100, 100],
      ])
    );
    await usdcVault.deployed();
    ethVault = <FungibleAssetVaultForDAO>(
      await upgrades.deployProxy(FungibleAssetVaultForDAO, [
        ZERO_ADDRESS,
        stablecoin.address,
        eth_oracle.address,
        [100, 100],
      ])
    );
    await ethVault.deployed();

    await stablecoin.grantRole(default_admin_role, dao.address);
    await stablecoin.revokeRole(default_admin_role, owner.address);
    await stablecoin.connect(dao).grantRole(minter_role, usdcVault.address);
    await stablecoin.connect(dao).grantRole(minter_role, ethVault.address);

    await usdcVault.grantRole(default_admin_role, dao.address);
    await usdcVault.grantRole(whitelisted_role, dao.address);
    await usdcVault.revokeRole(default_admin_role, owner.address);
    await ethVault.grantRole(default_admin_role, dao.address);
    await ethVault.grantRole(whitelisted_role, dao.address);
    await ethVault.revokeRole(default_admin_role, owner.address);
  });

  it("should be able to update creditLimitRate", async () => {
    await expect(
      usdcVault.setCreditLimitRate({ numerator: 34, denominator: 100 })
    ).to.revertedWith(
      `AccessControl: account ${owner.address.toLowerCase()} is missing role ${default_admin_role}`
    );
    expect(await usdcVault.creditLimitRate()).to.deep.equal([bn(100), bn(100)]);

    await expect(
      usdcVault
        .connect(dao)
        .setCreditLimitRate({ numerator: 101, denominator: 100 })
    ).to.revertedWith("invalid_rate");
    await usdcVault
      .connect(dao)
      .setCreditLimitRate({ numerator: 34, denominator: 100 });

    expect(await usdcVault.creditLimitRate()).to.deep.equal([bn(34), bn(100)]);

    await usdcVault
      .connect(dao)
      .setCreditLimitRate({ numerator: 100, denominator: 100 });
    expect(await usdcVault.creditLimitRate()).to.deep.equal([bn(100), bn(100)]);
  });

  it("should be able to deposit assets", async () => {
    let depositAmount = units(30000);
    await usdc.mint(dao.address, depositAmount);
    await expect(usdcVault.deposit(depositAmount)).to.revertedWith(
      `AccessControl: account ${owner.address.toLowerCase()} is missing role ${whitelisted_role}`
    );
    await expect(usdcVault.connect(dao).deposit(depositAmount)).to.revertedWith(
      "ERC20: transfer amount exceeds allowance"
    );
    await usdc.connect(dao).approve(usdcVault.address, depositAmount);
    await usdcVault.connect(dao).deposit(depositAmount);
    expect(await usdcVault.collateralAmount()).to.equal(depositAmount);

    await expect(ethVault.connect(dao).deposit(0)).to.revertedWith(
      "invalid_amount"
    );

    depositAmount = units(10);
    await expect(
      ethVault.connect(dao).deposit(depositAmount, { value: 0 })
    ).to.revertedWith("invalid_msg_value");
    await ethVault
      .connect(dao)
      .deposit(depositAmount, { value: depositAmount });
    expect(await ethVault.collateralAmount()).to.equal(depositAmount);
  });

  it("should be able to borrow assets", async () => {
    const borrowAmount = units(30000);
    await expect(usdcVault.borrow(borrowAmount)).to.revertedWith(
      `AccessControl: account ${owner.address.toLowerCase()} is missing role ${whitelisted_role}`
    );
    await expect(
      usdcVault.connect(dao).borrow(borrowAmount.add(1))
    ).to.revertedWith("insufficient_credit");
    let balanceBefore = await stablecoin.balanceOf(dao.address);
    await usdcVault.connect(dao).borrow(borrowAmount);
    expect(await stablecoin.balanceOf(dao.address)).to.equal(
      balanceBefore.add(borrowAmount)
    );
    expect(await usdcVault.debtAmount()).to.equal(borrowAmount);

    await expect(
      ethVault.connect(dao).borrow(borrowAmount.add(1))
    ).to.revertedWith("insufficient_credit");
    balanceBefore = await stablecoin.balanceOf(dao.address);
    await ethVault.connect(dao).borrow(borrowAmount);
    expect(await stablecoin.balanceOf(dao.address)).to.equal(
      balanceBefore.add(borrowAmount)
    );
    expect(await ethVault.debtAmount()).to.equal(borrowAmount);
  });

  it("should be able to repay assets", async () => {
    const repayAmount = units(20000);
    await expect(usdcVault.repay(repayAmount)).to.revertedWith(
      `AccessControl: account ${owner.address.toLowerCase()} is missing role ${whitelisted_role}`
    );
    await expect(usdcVault.connect(dao).repay(repayAmount)).to.revertedWith(
      "ERC20: burn amount exceeds allowance"
    );

    // repay partial
    await stablecoin.connect(dao).approve(usdcVault.address, repayAmount);
    await usdcVault.connect(dao).repay(repayAmount);
    expect(await usdcVault.debtAmount()).to.equal(units(10000));

    await stablecoin.connect(dao).approve(ethVault.address, repayAmount);
    await ethVault.connect(dao).repay(repayAmount);
    expect(await ethVault.debtAmount()).to.equal(units(10000));

    // repay all
    await stablecoin.connect(dao).approve(ethVault.address, units(10000));
    await ethVault.connect(dao).repay(units(1000000000));
    expect(await ethVault.debtAmount()).to.equal(0);
  });

  it("should be able to withdraw assets", async () => {
    await expect(ethVault.withdraw(units(1))).to.revertedWith(
      `AccessControl: account ${owner.address.toLowerCase()} is missing role ${whitelisted_role}`
    );
    await expect(
      ethVault.connect(dao).withdraw(units(30000).add(1))
    ).to.revertedWith("invalid_amount");

    await expect(
      usdcVault.connect(dao).withdraw(units(20000).add(1))
    ).to.revertedWith("insufficient_credit");

    // withdraw partial
    let balanceBefore = await usdc.balanceOf(dao.address);
    await usdcVault.connect(dao).withdraw(units(10000));
    expect(await usdc.balanceOf(dao.address)).to.equal(
      balanceBefore.add(units(10000))
    );
    expect(await usdcVault.collateralAmount()).to.equal(units(20000));

    // withdraw all
    balanceBefore = await dao.getBalance();
    await ethVault.connect(dao).withdraw(units(10));
    checkAlmostSame(await dao.getBalance(), balanceBefore.add(units(10)));
    expect(await ethVault.collateralAmount()).to.equal(0);
  });
});

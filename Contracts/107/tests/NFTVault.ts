import { BigNumber } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers, upgrades } from "hardhat";
import {
  FungibleAssetVaultForDAO,
  JPEG,
  JPEGLock,
  MockV3Aggregator,
  NFTVault,
  StableCoin,
  TestERC20,
  TestERC721,
} from "../types";
import {
  units,
  bn,
  timeTravel,
  days,
  checkAlmostSame,
  currentTimestamp,
  ZERO_ADDRESS,
} from "./utils";

const { expect } = chai;

chai.use(solidity);

const default_admin_role =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const minter_role =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const dao_role =
  "0x3b5d4cc60d3ec3516ee8ae083bd60934f6eb2a6c54b1229985c41bfb092b2603";
const liquidator_role =
  "0x5e17fc5225d4a099df75359ce1f405503ca79498a8dc46a7d583235a0ee45c16";
const whitelisted_role =
  "0x8429d542926e6695b59ac6fbdcd9b37e8b1aeb757afab06ab60b1bb5878c3b49";
const apeHash =
  "0x26bca2ecad19e981c90a8c6efd8ee9856bbc5a2042259e6ee31e310fdc08d970";
const alienHash =
  "0x3f00f46bb8cf74b3f3e5365e6a583ab26c2d9cffcbff21b7c25fe510854bc81f";
const aliens = [635, 2890, 3100, 3443, 5822, 5905, 6089, 7523, 7804];
const apes = [
  372, 1021, 2140, 2243, 2386, 2460, 2491, 2711, 2924, 4156, 4178, 4464, 5217,
  5314, 5577, 5795, 6145, 6915, 6965, 7191, 8219, 8498, 9265, 9280,
];

describe("NFTVault", () => {
  let owner: SignerWithAddress,
    dao: SignerWithAddress,
    user: SignerWithAddress;
  let nftVault: NFTVault,
    usdcVault: FungibleAssetVaultForDAO,
    jpegOracle: MockV3Aggregator,
    ethOracle: MockV3Aggregator,
    usd_oracle: MockV3Aggregator,
    usdc: TestERC20,
    stablecoin: StableCoin,
    erc721: TestERC721,
    locker: JPEGLock,
    jpeg: JPEG;

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    dao = accounts[1];
    user = accounts[2];

    const ERC721 = await ethers.getContractFactory("TestERC721");
    erc721 = await ERC721.deploy();
    await erc721.deployed();

    const TestERC20 = await ethers.getContractFactory("TestERC20");
    usdc = await TestERC20.deploy("Test USDC", "USDC");
    await usdc.deployed();

    const StableCoin = await ethers.getContractFactory("StableCoin");
    stablecoin = await StableCoin.deploy();
    await stablecoin.deployed();

    const MockAggregator = await ethers.getContractFactory("MockV3Aggregator");
    jpegOracle = await MockAggregator.deploy(8, 1e8);
    await jpegOracle.deployed();

    ethOracle = await MockAggregator.deploy(8, 3000e8);
    await ethOracle.deployed();

    const floorOracle = await MockAggregator.deploy(18, units(50));
    await floorOracle.deployed();

    const fallbackOracle = await MockAggregator.deploy(18, units(10));
    await fallbackOracle.deployed();

    usd_oracle = await MockAggregator.deploy(8, 1e8);
    await usd_oracle.deployed();

    const JPEG = await ethers.getContractFactory("JPEG");

    jpeg = await JPEG.deploy(units(1000000000));
    await jpeg.deployed();

    const JPEGLock = await ethers.getContractFactory("JPEGLock");
    locker = await JPEGLock.deploy(jpeg.address);
    await locker.deployed();

    const NFTVault = await ethers.getContractFactory("NFTVault");
    nftVault = <NFTVault>await upgrades.deployProxy(NFTVault, [
      stablecoin.address,
      erc721.address,
      ethOracle.address,
      jpegOracle.address,
      floorOracle.address,
      fallbackOracle.address,
      [
        [apeHash, units(2000), apes],
        [alienHash, units(4000), aliens],
      ],
      locker.address,
      [
        [2, 100], //debtInterestApr
        [32, 100], //creditLimitRate
        [33, 100], //liquidationLimitRate
        [25, 100], //valueIncreaseLockRate
        [5, 1000], //organizationFeeRate
        [1, 100], //insuranchePurchaseRate
        [25, 100], //insuranceLiquidationPenaltyRate
        86400 * 3, //insuranceRepurchaseLimit
        units(3000).mul(1000), //borrowAmountCap
      ],
    ]);
    await nftVault.deployed();

    await locker.transferOwnership(nftVault.address);

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

    await stablecoin.grantRole(default_admin_role, dao.address);
    await stablecoin.revokeRole(default_admin_role, owner.address);
    await stablecoin.connect(dao).grantRole(minter_role, nftVault.address);
    await stablecoin.connect(dao).grantRole(minter_role, usdcVault.address);

    await nftVault.grantRole(dao_role, dao.address);
    await nftVault.grantRole(liquidator_role, dao.address);
    await nftVault.revokeRole(dao_role, owner.address);
    await usdcVault.grantRole(default_admin_role, dao.address);
    await usdcVault.grantRole(whitelisted_role, dao.address);
    await usdcVault.revokeRole(default_admin_role, owner.address);
  });

  it("should be able to borrow", async () => {
    await expect(nftVault.borrow(10001, 100, false)).to.be.revertedWith(
      "invalid_nft"
    );

    await erc721.mint(user.address, 1);

    await expect(nftVault.borrow(1, 0, false)).to.be.revertedWith(
      "invalid_amount"
    );

    await expect(nftVault.borrow(1, 100, false)).to.be.revertedWith(
      "ERC721: transfer caller is not owner nor approved"
    );

    const index = 1000;
    const borrowAmount = units(3000).mul(10);
    await erc721.mint(user.address, index);
    await expect(
      nftVault.connect(user).borrow(index, borrowAmount, false)
    ).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");

    await erc721.connect(user).approve(nftVault.address, index);

    await expect(
      nftVault.connect(user).borrow(index, borrowAmount.mul(2), false)
    ).to.be.revertedWith("insufficient_credit");

    const stablecoinBalanceBefore = await stablecoin.balanceOf(user.address);
    await nftVault.connect(user).borrow(index, borrowAmount.div(2), false);

    await expect(
      nftVault.borrow(index, borrowAmount, false)
    ).to.be.revertedWith("unauthorized");

    await nftVault.connect(user).borrow(index, borrowAmount.div(2), false);

    expect(await stablecoin.balanceOf(user.address)).to.be.equal(
      borrowAmount.mul(995).div(1000).add(stablecoinBalanceBefore)
    );

    expect(await nftVault.openPositionsIndexes()).to.deep.equal([
      BigNumber.from(index),
    ]);
    expect(await nftVault.totalPositions()).to.equal(1);
  });

  it("should be able to borrow with insurance", async () => {
    const index = 2000;
    await erc721.mint(user.address, index);

    const borrowAmount = units(3000).mul(10);

    await erc721.connect(user).approve(nftVault.address, index);

    const stablecoinBalanceBefore = await stablecoin.balanceOf(user.address);
    const daoBalanceBefore = await stablecoin.balanceOf(dao.address);
    await nftVault.connect(user).borrow(index, borrowAmount, true);

    expect(await stablecoin.balanceOf(user.address)).to.be.equal(
      borrowAmount.mul(985).div(1000).add(stablecoinBalanceBefore)
    );
    await nftVault.connect(dao).collect();
    checkAlmostSame(
      await stablecoin.balanceOf(dao.address),
      borrowAmount.mul(15).div(1000).add(daoBalanceBefore)
    );
  });

  it("should be able to repay", async () => {
    await expect(nftVault.repay(10001, 100)).to.be.revertedWith("invalid_nft");
    await erc721.mint(user.address, 1);
    await expect(nftVault.repay(1, 100)).to.be.revertedWith("unauthorized");

    const index = 3000;
    await erc721.mint(user.address, index);
    await expect(nftVault.connect(user).repay(index, 100)).to.be.revertedWith(
      "unauthorized"
    );

    await erc721.connect(user).approve(nftVault.address, index);
    await expect(nftVault.connect(user).repay(index, 100)).to.be.revertedWith(
      "unauthorized"
    );

    const borrowAmount = units(3000).mul(10);
    await nftVault.connect(user).borrow(index, borrowAmount, false);

    await expect(nftVault.connect(user).repay(index, 0)).to.be.revertedWith(
      "invalid_amount"
    );

    // pay half
    let position = await nftVault.showPosition(index);
    expect(position.debtPrincipal).to.be.equal(borrowAmount);

    let stablecoinBalanceBefore = await stablecoin.balanceOf(user.address);

    await stablecoin
      .connect(user)
      .approve(nftVault.address, borrowAmount.div(2));
    await nftVault.connect(user).repay(index, borrowAmount.div(2));

    position = await nftVault.showPosition(index);
    checkAlmostSame(position.debtPrincipal, borrowAmount.div(2));

    expect(stablecoinBalanceBefore).to.be.equal(
      borrowAmount.div(2).add(await stablecoin.balanceOf(user.address))
    );

    // user prepares 30000 PUSD to repay full (consider interest)
    const prepareAmount = units(30000);
    await usdc.mint(dao.address, prepareAmount);
    await usdc.connect(dao).approve(usdcVault.address, prepareAmount);
    await usdcVault.connect(dao).deposit(prepareAmount);
    await usdcVault.connect(dao).borrow(prepareAmount);
    await stablecoin.connect(dao).transfer(user.address, prepareAmount);

    // pay half again
    stablecoinBalanceBefore = await stablecoin.balanceOf(user.address);
    await stablecoin
      .connect(user)
      .approve(nftVault.address, ethers.constants.MaxUint256);
    await nftVault.connect(user).repay(index, ethers.constants.MaxUint256);

    position = await nftVault.showPosition(index);
    expect(position.debtPrincipal).to.be.equal(0);

    checkAlmostSame(
      stablecoinBalanceBefore,
      borrowAmount.div(2).add(await stablecoin.balanceOf(user.address))
    );
  });

  it("should allow the DAO to toggle the fallback oracle", async () => {
    await nftVault.connect(dao).toggleFallbackOracle(true);
    const { nftValueETH: fallbackValueETH } = await nftVault.getNFTInfo(0);
    expect(fallbackValueETH).to.equal(units(10));
    await nftVault.connect(dao).toggleFallbackOracle(false);
    const{ nftValueETH } = await nftVault.getNFTInfo(0);
    expect(nftValueETH).to.equal(units(50));
  });

  it("should be able to close position", async () => {
    await expect(nftVault.closePosition(10001)).to.be.revertedWith(
      "invalid_nft"
    );
    await erc721.mint(user.address, 1);
    await expect(nftVault.closePosition(1)).to.be.revertedWith("unauthorized");

    const index = 4000;
    await erc721.mint(user.address, index);

    await erc721.connect(user).approve(nftVault.address, index);

    const borrowAmount = units(3000).mul(10);
    await nftVault.connect(user).borrow(index, borrowAmount, false);

    await expect(
      nftVault.connect(user).closePosition(index)
    ).to.be.revertedWith("position_not_repaid");

    // user prepares 30000 PUSD to repay full (consider interest)
    const prepareAmount = units(30000);
    await usdc.mint(dao.address, prepareAmount);
    await usdc.connect(dao).approve(usdcVault.address, prepareAmount);
    await usdcVault.connect(dao).deposit(prepareAmount);
    await usdcVault.connect(dao).borrow(prepareAmount);
    await stablecoin.connect(dao).transfer(user.address, prepareAmount);

    // full repay to close position
    await stablecoin
      .connect(user)
      .approve(nftVault.address, ethers.constants.MaxUint256);
    await nftVault.connect(user).repay(index, ethers.constants.MaxUint256);
    await nftVault.connect(user).closePosition(index);

    expect(await erc721.ownerOf(index)).to.be.equal(user.address);

    const preview = await nftVault.showPosition(index);
    expect(preview.owner).to.equal(ZERO_ADDRESS);

    expect(await nftVault.openPositionsIndexes()).to.deep.equal([]);
    expect(await nftVault.totalPositions()).to.equal(0);
  });

  it("should be able to liquidate borrow position without insurance", async () => {
    await expect(nftVault.connect(user).liquidate(10001)).to.be.revertedWith(
      "AccessControl: account " +
        user.address.toLowerCase() +
        " is missing role " +
        liquidator_role
    );

    await expect(nftVault.connect(dao).liquidate(10001)).to.be.revertedWith(
      "invalid_nft"
    );

    const index = 4000;
    await erc721.mint(user.address, index);

    let position = await nftVault.showPosition(index);
    expect(position.owner).to.equal(ZERO_ADDRESS);

    await erc721.connect(user).approve(nftVault.address, index);

    position = await nftVault.showPosition(index);
    expect(position.owner).to.equal(ZERO_ADDRESS);

    const borrowAmount = units(29000);
    await nftVault.connect(user).borrow(index, borrowAmount, false);

    await expect(nftVault.connect(dao).liquidate(index)).to.be.revertedWith(
      "position_not_liquidatable"
    );

    // dao prepares 30000 PUSD
    const prepareAmount = units(30000);
    await usdc.mint(dao.address, prepareAmount);
    await usdc.connect(dao).approve(usdcVault.address, prepareAmount);
    await usdcVault.connect(dao).deposit(prepareAmount);
    await usdcVault.connect(dao).borrow(prepareAmount);

    position = await nftVault.showPosition(index);
    expect(position.liquidatable).to.be.equal(false);
    // treat to change eth price
    await ethOracle.updateAnswer(1000e8);
    position = await nftVault.showPosition(index);
    expect(position.liquidatable).to.be.equal(true);

    await expect(nftVault.connect(dao).liquidate(index)).to.be.revertedWith(
      "ERC20: burn amount exceeds allowance"
    );

    await stablecoin.connect(dao).approve(nftVault.address, units(30000));
    await nftVault.connect(dao).liquidate(index);

    expect(await stablecoin.balanceOf(dao.address)).to.be.gt(0);

    expect(await erc721.ownerOf(index)).to.be.equal(dao.address);

    position = await nftVault.showPosition(index);
    expect(position.owner).to.equal(ZERO_ADDRESS);

    // treat to change back eth price
    await ethOracle.updateAnswer(3000e8);

    expect(await nftVault.openPositionsIndexes()).to.deep.equal([]);
    expect(await nftVault.totalPositions()).to.equal(0);
  });

  it("should be able to liquidate borrow position with insurance", async () => {
    const index = 6000;
    await erc721.mint(user.address, index);

    await erc721.connect(user).approve(nftVault.address, index);
    const borrowAmount = units(2000);
    await nftVault.connect(user).borrow(index, borrowAmount, true);

    // dao prepares 30000 PUSD
    const prepareAmount = units(30000);
    await usdc.mint(dao.address, prepareAmount);
    await usdc.connect(dao).approve(usdcVault.address, prepareAmount);
    await usdcVault.connect(dao).deposit(prepareAmount);
    await usdcVault.connect(dao).borrow(prepareAmount);

    // treat to change eth price
    await ethOracle.updateAnswer(100e8);

    await expect(nftVault.connect(dao).liquidate(index)).to.be.revertedWith(
      "ERC20: burn amount exceeds allowance"
    );

    await stablecoin.connect(dao).approve(nftVault.address, units(30000));
    await nftVault.connect(dao).liquidate(index);

    await expect(nftVault.connect(dao).liquidate(index)).to.be.revertedWith(
      "liquidated"
    );

    expect(await erc721.ownerOf(index)).to.be.equal(nftVault.address);

    expect((await nftVault.showPosition(index)).liquidatedAt).to.be.gt(0);
    await expect(
      nftVault.connect(user).borrow(index, borrowAmount, false)
    ).to.be.revertedWith("liquidated");
    await expect(
      nftVault.connect(user).repay(index, borrowAmount)
    ).to.be.revertedWith("liquidated");

    // treat to change back eth price
    await ethOracle.updateAnswer(3000e8);

    expect(await nftVault.openPositionsIndexes()).to.deep.equal([
      BigNumber.from(index),
    ]);
    expect(await nftVault.totalPositions()).to.equal(1);
  });

  it("should be able to repurchase", async () => {
    await expect(nftVault.repurchase(10001)).to.be.revertedWith("invalid_nft");
    await erc721.mint(owner.address, 1);
    await expect(nftVault.repurchase(1)).to.be.revertedWith("unauthorized");

    const index = 5000;
    await erc721.mint(user.address, index);
    await erc721.connect(user).approve(nftVault.address, index);
    const borrowAmount = units(3000).mul(10);
    await nftVault.connect(user).borrow(index, borrowAmount, true);

    const initialTimestamp = await currentTimestamp();

    await expect(nftVault.connect(user).repurchase(index)).to.be.revertedWith(
      "not_liquidated"
    );

    // dao prepares 70000 PUSD
    const prepareAmount = units(70000);
    await usdc.mint(dao.address, prepareAmount);
    await usdc.connect(dao).approve(usdcVault.address, prepareAmount);
    await usdcVault.connect(dao).deposit(prepareAmount);
    await usdcVault.connect(dao).borrow(prepareAmount);

    // treat to change eth price
    await ethOracle.updateAnswer(100e8);

    await stablecoin.connect(dao).approve(nftVault.address, units(70000));
    await nftVault.connect(dao).liquidate(index);

    const elapsed = (await currentTimestamp()) - initialTimestamp;
    const totalDebt = borrowAmount.add(
      borrowAmount
        .mul(2)
        .mul(elapsed)
        .div(100)
        .div(86400 * 365)
    );
    const toRepurchase = totalDebt.add(totalDebt.mul(25).div(100));

    await stablecoin.connect(dao).transfer(user.address, toRepurchase);
    await stablecoin.connect(user).approve(nftVault.address, toRepurchase);

    await nftVault.connect(user).repurchase(index);

    expect(
      await stablecoin.allowance(user.address, nftVault.address)
    ).to.be.closeTo(units(0), units(1) as any);

    expect(await nftVault.openPositionsIndexes()).to.deep.equal([]);
    expect(await nftVault.totalPositions()).to.equal(0);
  });

  it("should allow the DAO to change JPEG lock time", async () => {
    await nftVault.connect(dao).setJPEGLockTime(10);
    expect(await locker.lockTime()).to.equal(10);
  });

  it("should allow the liquidator to claim an nft with expired insurance", async () => {
    const index = 5000;
    await erc721.mint(user.address, index);
    await erc721.connect(user).approve(nftVault.address, index);
    const borrowAmount = units(3000).mul(10);
    await nftVault.connect(user).borrow(index, borrowAmount, true);

    const initialTimestamp = await currentTimestamp();

    // dao prepares 70000 PUSD
    const prepareAmount = units(70000);
    await usdc.mint(dao.address, prepareAmount);
    await usdc.connect(dao).approve(usdcVault.address, prepareAmount);
    await usdcVault.connect(dao).deposit(prepareAmount);
    await usdcVault.connect(dao).borrow(prepareAmount);

    // treat to change eth price
    await ethOracle.updateAnswer(100e8);

    await stablecoin.connect(dao).approve(nftVault.address, units(70000));
    await expect(
      nftVault.connect(dao).claimExpiredInsuranceNFT(index)
    ).to.be.revertedWith("not_liquidated");
    await nftVault.connect(dao).liquidate(index);

    const elapsed = (await currentTimestamp()) - initialTimestamp;
    const totalDebt = borrowAmount.add(
      borrowAmount
        .mul(2)
        .mul(elapsed)
        .div(100)
        .div(86400 * 365)
    );
    const toRepurchase = totalDebt.add(totalDebt.mul(25).div(100));

    await stablecoin.connect(dao).transfer(user.address, toRepurchase);
    await stablecoin.connect(user).approve(nftVault.address, toRepurchase);

    await expect(
      nftVault.connect(dao).claimExpiredInsuranceNFT(index)
    ).to.be.revertedWith("insurance_not_expired");

    await timeTravel(86400 * 3);

    await expect(nftVault.connect(user).repurchase(index)).to.be.revertedWith(
      "insurance_expired"
    );

    await expect(nftVault.claimExpiredInsuranceNFT(index)).to.be.revertedWith(
      "unauthorized"
    );

    await nftVault.connect(dao).claimExpiredInsuranceNFT(index);
    expect(await erc721.ownerOf(index)).to.equal(dao.address);
    await expect(
      nftVault.connect(dao).claimExpiredInsuranceNFT(index)
    ).to.be.revertedWith("no_position");

    expect(await nftVault.openPositionsIndexes()).to.deep.equal([]);
    expect(await nftVault.totalPositions()).to.equal(0);
  });

  it("get ape punk + open position + borrow 600ETH", async () => {
    const index = apes[2];

    await erc721.mint(user.address, index);

    await erc721.connect(user).approve(nftVault.address, index);

    let position = await nftVault.showPosition(index);
    expect(position.owner).to.equal(ZERO_ADDRESS);

    const stablecoinBalanceBefore = await stablecoin.balanceOf(user.address);
    await nftVault.connect(user).borrow(index, units(3000).mul(600), false);

    expect(await stablecoin.balanceOf(user.address)).to.be.equal(
      units(3000).mul(600).mul(995).div(1000).add(stablecoinBalanceBefore)
    );

    position = await nftVault.showPosition(index);
    expect(position.owner).to.be.equal(user.address);
    expect(position.nftIndex).to.be.equal(index);
    expect(position.nftType).to.be.equal(apeHash);
    expect(position.nftValueUSD).to.be.equal(units(3000).mul(2000));
    expect(position.creditLimit).to.be.equal(
      units(3000).mul(2000).mul(32).div(100)
    );
    expect(position.debtPrincipal).to.be.equal(units(3000).mul(600));
    expect(position.debtInterest).to.be.equal(0);
    expect(position.borrowType).to.be.equal(1);
  });

  it("get punk + increase debt limit to 50000ETH + open position + borrow 6000ETH", async () => {
    const index = 7000;

    await erc721.mint(user.address, index);
    await erc721.connect(user).approve(nftVault.address, index);

    await expect(
      nftVault.connect(user).borrow(index, units(3000).mul(6000), false)
    ).to.be.revertedWith("debt_cap");

    const stablecoinBalanceBefore = await stablecoin.balanceOf(user.address);
    await nftVault.connect(dao).setBorrowAmountCap(units(3000).mul(10000)); // increase debt cap
    await expect(
      nftVault.connect(user).borrow(index, units(3000).mul(6000), false)
    ).to.be.revertedWith("insufficient_credit");

    await expect(
      nftVault.connect(user).finalizePendingNFTValueETH(index)
    ).to.be.revertedWith("no_pending_value");

    await nftVault
      .connect(dao)
      .setPendingNFTValueETH(index, units(50000));
    await jpeg.transfer(user.address, units(12000000));
    await jpeg.connect(user).approve(locker.address, units(12000000));

    await nftVault.connect(user).finalizePendingNFTValueETH(index);

    expect(await jpeg.balanceOf(locker.address)).to.equal(units(12000000));

    await nftVault.connect(user).borrow(index, units(3000).mul(6000), false);

    expect(await stablecoin.balanceOf(user.address)).to.be.equal(
      units(3000).mul(6000).mul(995).div(1000).add(stablecoinBalanceBefore)
    );
  });

  it("organization is deducted from debt", async () => {
    const index = 8000;

    await erc721.mint(user.address, index);
    await erc721.connect(user).approve(nftVault.address, index);

    const balanceBefore = await stablecoin.balanceOf(user.address);
    await nftVault.connect(user).borrow(index, units(3000).mul(10), false);
    expect(await stablecoin.balanceOf(user.address)).to.equal(
      balanceBefore.add(units(3000).mul(10).mul(995).div(1000))
    );
  });

  it("insurance fee is deducted from debt", async () => {
    const index = 9000;

    await erc721.mint(user.address, index);
    await erc721.connect(user).approve(nftVault.address, index);

    const balanceBefore = await stablecoin.balanceOf(user.address);
    await nftVault.connect(user).borrow(index, units(3000).mul(10), true);
    expect(await stablecoin.balanceOf(user.address)).to.equal(
      balanceBefore.add(units(3000).mul(10).mul(985).div(1000))
    );
  });

  it("collect mints interest and send to dao", async () => {
    const index = 200;
    const borrowAmount = units(3000).mul(10);
    await erc721.mint(user.address, index);
    await erc721.connect(user).approve(nftVault.address, index);
    await nftVault.connect(user).borrow(index, borrowAmount, true);
    await nftVault.connect(dao).collect();

    await timeTravel(days(1));

    let balanceBefore = await stablecoin.balanceOf(dao.address);
    await nftVault.connect(dao).collect();
    const mintedFee = (await stablecoin.balanceOf(dao.address)).sub(
      balanceBefore
    );
    checkAlmostSame(mintedFee, borrowAmount.mul(2).div(100).div(365));

    await stablecoin.connect(dao).transfer(user.address, mintedFee);

    // user prepares 30000 PUSD to repay full (consider interest)
    const prepareAmount = units(30000);
    await usdc.mint(dao.address, prepareAmount);
    await usdc.connect(dao).approve(usdcVault.address, prepareAmount);
    await usdcVault.connect(dao).deposit(prepareAmount);
    await usdcVault.connect(dao).borrow(prepareAmount);
    await stablecoin.connect(dao).transfer(user.address, prepareAmount);

    // no fee transfer when repay after collect
    balanceBefore = await stablecoin.balanceOf(dao.address);
    await stablecoin
      .connect(user)
      .approve(nftVault.address, borrowAmount.add(mintedFee.mul(2)));
    await nftVault
      .connect(user)
      .repay(index, borrowAmount.add(mintedFee.mul(2)));
    expect(await stablecoin.balanceOf(dao.address)).to.equal(balanceBefore);

    let position = await nftVault.showPosition(index);
    expect(position.debtPrincipal).to.be.equal(0);
    expect(position.debtInterest).to.be.equal(0);
  });

  it("should allow the dao to override floor price", async () => {
    await erc721.mint(owner.address, 0);
    await nftVault.connect(dao).overrideFloor(units(10));
    await erc721.approve(nftVault.address, 0);
    await nftVault.borrow(0, 1, false);
    let position = await nftVault.showPosition(0);
    expect(position.nftValueUSD).to.equal(units(10).mul(3000));
    await nftVault.connect(dao).disableFloorOverride();
    position = await nftVault.showPosition(0);
    expect(position.nftValueUSD).to.equal(units(50).mul(3000));
  });

  it("should allow the dao to set nftType", async () => {
    await erc721.mint(owner.address, 0);
    await expect(nftVault.setNFTType(0, apeHash)).to.be.revertedWith(
      "AccessControl: account " +
        owner.address.toLowerCase() +
        " is missing role " +
        dao_role
    );

    await expect(
      nftVault.connect(dao).setNFTType(0, dao_role)
    ).to.be.revertedWith("invalid_nftType");

    await nftVault.connect(dao).setNFTType(0, apeHash);
    const { nftType } = await nftVault.getNFTInfo(0);
    expect(nftType).to.equal(apeHash);
  });

  it("should allow the dao to set the value of an nft type", async () => {
    await erc721.mint(owner.address, 0);
    await expect(nftVault.setNFTTypeValueETH(apeHash, 100)).to.be.revertedWith(
      "AccessControl: account " +
        owner.address.toLowerCase() +
        " is missing role " +
        dao_role
    );

    await nftVault.connect(dao).setNFTTypeValueETH(apeHash, 100);
  });

  it("should be able to update borrowAmountCap", async () => {
    await expect(
      nftVault.setBorrowAmountCap(units(3000).mul(2000))
    ).to.revertedWith(
      "AccessControl: account " +
        owner.address.toLowerCase() +
        " is missing role " +
        dao_role
    );
    await nftVault.connect(dao).setBorrowAmountCap(units(3000).mul(2000));
    expect((await nftVault.settings()).borrowAmountCap).to.equal(
      units(3000).mul(2000)
    );
  });

  it("should be able to update debtInterestApr", async () => {
    await expect(
      nftVault.setDebtInterestApr({ numerator: 3, denominator: 100 })
    ).to.revertedWith(
      "AccessControl: account " +
        owner.address.toLowerCase() +
        " is missing role " +
        dao_role
    );

    expect((await nftVault.settings()).debtInterestApr).to.deep.equal([
      bn(2),
      bn(100),
    ]);
    await nftVault
      .connect(dao)
      .setDebtInterestApr({ numerator: 3, denominator: 100 });
    expect((await nftVault.settings()).debtInterestApr).to.deep.equal([
      bn(3),
      bn(100),
    ]);
  });

  it("should be able to update creditLimitRate", async () => {
    await expect(
      nftVault.connect(user).setCreditLimitRate({ numerator: 34, denominator: 100 })
    ).to.revertedWith(
      "AccessControl: account " +
        user.address.toLowerCase() +
        " is missing role " +
        dao_role
    );
    expect((await nftVault.settings()).creditLimitRate).to.deep.equal([
      bn(32),
      bn(100),
    ]);
    expect((await nftVault.settings()).liquidationLimitRate).to.deep.equal([
      bn(33),
      bn(100),
    ]);
    await expect(
      nftVault
        .connect(dao)
        .setCreditLimitRate({ numerator: 101, denominator: 100 })
    ).to.revertedWith("invalid_rate");
    await expect(
      nftVault
        .connect(dao)
        .setCreditLimitRate({ numerator: 34, denominator: 100 })
    ).to.revertedWith("credit_rate_exceeds_or_equals_liquidation_rate");
    await nftVault
      .connect(dao)
      .setCreditLimitRate({ numerator: 31, denominator: 100 });
    expect((await nftVault.settings()).creditLimitRate).to.deep.equal([
      bn(31),
      bn(100),
    ]);
    expect((await nftVault.settings()).liquidationLimitRate).to.deep.equal([
      bn(33),
      bn(100),
    ]);
  });

  it("should be able to update liquidationLimitRate", async () => {
    await expect(
      nftVault.setLiquidationLimitRate({ numerator: 30, denominator: 100 })
    ).to.revertedWith(
      "AccessControl: account " +
        owner.address.toLowerCase() +
        " is missing role " +
        dao_role
    );
    expect((await nftVault.settings()).creditLimitRate).to.deep.equal([
      bn(32),
      bn(100),
    ]);
    expect((await nftVault.settings()).liquidationLimitRate).to.deep.equal([
      bn(33),
      bn(100),
    ]);
    await expect(
      nftVault
        .connect(dao)
        .setLiquidationLimitRate({ numerator: 101, denominator: 100 })
    ).to.revertedWith("invalid_rate");
    await expect(
      nftVault
        .connect(dao)
        .setLiquidationLimitRate({ numerator: 30, denominator: 100 })
    ).revertedWith("credit_rate_exceeds_or_equals_liquidation_rate");
    await nftVault
      .connect(dao)
      .setLiquidationLimitRate({ numerator: 34, denominator: 100 });
    expect((await nftVault.settings()).creditLimitRate).to.deep.equal([
      bn(32),
      bn(100),
    ]);
    expect((await nftVault.settings()).liquidationLimitRate).to.deep.equal([
      bn(34),
      bn(100),
    ]);
  });

  it("should be able to update organizationFeeRate", async () => {
    await expect(
      nftVault.setOrganizationFeeRate({ numerator: 6, denominator: 1000 })
    ).to.revertedWith(
      "AccessControl: account " +
        owner.address.toLowerCase() +
        " is missing role " +
        dao_role
    );
    expect((await nftVault.settings()).organizationFeeRate).to.deep.equal([
      bn(5),
      bn(1000),
    ]);
    await nftVault
      .connect(dao)
      .setOrganizationFeeRate({ numerator: 6, denominator: 1000 });
    expect((await nftVault.settings()).organizationFeeRate).to.deep.equal([
      bn(6),
      bn(1000),
    ]);
  });

  it("should be able to update insurancePurchaseRate", async () => {
    await expect(
      nftVault.setInsurancePurchaseRate({ numerator: 2, denominator: 100 })
    ).to.revertedWith(
      "AccessControl: account " +
        owner.address.toLowerCase() +
        " is missing role " +
        dao_role
    );
    expect((await nftVault.settings()).insurancePurchaseRate).to.deep.equal([
      bn(1),
      bn(100),
    ]);
    await nftVault
      .connect(dao)
      .setInsurancePurchaseRate({ numerator: 2, denominator: 100 });
    expect((await nftVault.settings()).insurancePurchaseRate).to.deep.equal([
      bn(2),
      bn(100),
    ]);
  });

  it("should be able to update insuranceLiquidationPenaltyRate", async () => {
    await expect(
      nftVault.setInsuranceLiquidationPenaltyRate({
        numerator: 26,
        denominator: 100,
      })
    ).to.revertedWith(
      "AccessControl: account " +
        owner.address.toLowerCase() +
        " is missing role " +
        dao_role
    );
    expect(
      (await nftVault.settings()).insuranceLiquidationPenaltyRate
    ).to.deep.equal([bn(25), bn(100)]);
    await nftVault
      .connect(dao)
      .setInsuranceLiquidationPenaltyRate({ numerator: 26, denominator: 100 });
    expect(
      (await nftVault.settings()).insuranceLiquidationPenaltyRate
    ).to.deep.equal([bn(26), bn(100)]);
  });
});

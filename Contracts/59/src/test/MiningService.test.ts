import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { RewardReinvestor } from "../type/RewardReinvestor";
import { Bonding } from "../type/Bonding";
import { MiningService } from "../type/MiningService";
import { ERC20VestedMine } from "../type/ERC20VestedMine";
import { Malt } from "../type/Malt";
import { TransferService } from "../type/TransferService";
import { ERC20 } from "../type/ERC20";
import { ContractFactory, constants, utils, Contract, BigNumber } from 'ethers';
import { hardhatSnapshot, hardhatRevert, increaseTime } from "./helpers";
import IERC20 from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import MaltArtifacts from "../artifacts/contracts/Malt.sol/Malt.json";

const { deployMockContract } = waffle;

describe("MiningService", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;
  let bonding: Signer;
  let reinvestor: Signer;

  let miningService: MiningService;
  let dai: ERC20;
  let snapshotId: string;

  let mockMineOne: ERC20VestedMine;
  let mockMineTwo: ERC20VestedMine;
  let mockTransferService: TransferService;

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, admin, bonding, reinvestor, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const bondingAddress = await bonding.getAddress();
    const reinvestorAddress = await reinvestor.getAddress();

    mockTransferService = ((await deployMockContract(owner, [
      "function verifyTransfer(address, address, uint256) returns (bool, string memory)"
    ])) as any) as TransferService;
    await mockTransferService.mock.verifyTransfer.returns(true, "");

    const ERC20Factory = await ethers.getContractFactory("Malt");

    // Deploy ERC20 tokens
    dai = (await ERC20Factory.deploy("Dai Stablecoin", "DAI")) as Malt;

    await dai.initialize(ownerAddress, adminAddress, mockTransferService.address, [], []);
    await dai.deployed();

    mockMineOne = ((await deployMockContract(owner, [
      "function withdrawForAccount(address, uint256, address) returns(uint256)",
      "function balanceOfRewards(address) returns(uint256)",
      "function earned(address) returns(uint256)",
      "function onBond(address, uint256)",
      "function onUnbond(address, uint256)",
    ])) as any) as ERC20VestedMine;
    mockMineTwo = ((await deployMockContract(owner, [
      "function withdrawForAccount(address, uint256, address) returns(uint256)",
      "function balanceOfRewards(address) returns(uint256)",
      "function earned(address) returns(uint256)",
      "function onBond(address, uint256)",
      "function onUnbond(address, uint256)",
    ])) as any) as ERC20VestedMine;

    // Deploy the MiningService
    const MiningServiceFactory = await ethers.getContractFactory("MiningService");

    miningService = (await MiningServiceFactory.deploy()) as MiningService;
    await miningService.initialize(
      ownerAddress,
      adminAddress,
      dai.address,
      reinvestorAddress,
      bondingAddress
    );
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Has correct initial conditions", async function() {
    const bondingAddress = await bonding.getAddress();
    const reinvestorAddress = await reinvestor.getAddress();

    expect(await miningService.reinvestor()).to.equal(reinvestorAddress);
    expect(await miningService.bonding()).to.equal(bondingAddress);
  });

  it("Handles adding a new reward mine", async function() {
    const [user] = accounts;
    await expect(miningService.connect(user).addRewardMine(mockMineOne.address)).to.be.revertedWith("Must have admin privs");

    await miningService.connect(admin).addRewardMine(mockMineOne.address);

    expect(await miningService.numberOfMines()).to.equal(1);
    expect(await miningService.mines(0)).to.equal(mockMineOne.address);
    expect(await miningService.isMineActive(mockMineOne.address)).to.equal(true);
  });

  it("Handles removing a reward mine", async function() {
    const [user] = accounts;
    await expect(miningService.connect(user).addRewardMine(mockMineOne.address)).to.be.revertedWith("Must have admin privs");

    await miningService.connect(admin).addRewardMine(mockMineOne.address);

    await expect(miningService.connect(user).removeRewardMine(mockMineOne.address)).to.be.revertedWith("Must have admin privs");

    await miningService.connect(admin).removeRewardMine(mockMineOne.address);

    expect(await miningService.numberOfMines()).to.equal(0);
    expect(await miningService.isMineActive(mockMineOne.address)).to.equal(false);
  });

  it("Handles removing the first of many reward mines", async function() {
    const [user] = accounts;
    await expect(miningService.connect(user).addRewardMine(mockMineOne.address)).to.be.revertedWith("Must have admin privs");

    await miningService.connect(admin).addRewardMine(mockMineOne.address);
    await miningService.connect(admin).addRewardMine(mockMineTwo.address);

    await expect(miningService.connect(user).removeRewardMine(mockMineOne.address)).to.be.revertedWith("Must have admin privs");

    await miningService.connect(admin).removeRewardMine(mockMineOne.address);

    expect(await miningService.numberOfMines()).to.equal(1);
    expect(await miningService.isMineActive(mockMineOne.address)).to.equal(false);
    expect(await miningService.isMineActive(mockMineTwo.address)).to.equal(true);
  });

  it("Handles removing the last of many reward mines", async function() {
    const [user] = accounts;
    await expect(miningService.connect(user).addRewardMine(mockMineTwo.address)).to.be.revertedWith("Must have admin privs");

    await miningService.connect(admin).addRewardMine(mockMineOne.address);
    await miningService.connect(admin).addRewardMine(mockMineTwo.address);

    await expect(miningService.connect(user).removeRewardMine(mockMineTwo.address)).to.be.revertedWith("Must have admin privs");

    await miningService.connect(admin).removeRewardMine(mockMineTwo.address);

    expect(await miningService.numberOfMines()).to.equal(1);
    expect(await miningService.isMineActive(mockMineOne.address)).to.equal(true);
    expect(await miningService.isMineActive(mockMineTwo.address)).to.equal(false);
  });

  it("Correctly returns balanceOfRewards", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    await miningService.connect(admin).addRewardMine(mockMineOne.address);
    await miningService.connect(admin).addRewardMine(mockMineTwo.address);

    expect(await miningService.numberOfMines()).to.equal(2);

    // Should fail due to no mocks on mines
    await expect(miningService.balanceOfRewards(userAddress)).to.be.reverted;

    // Mock returns
    const mineOneAmount = utils.parseEther('234');
    const mineTwoAmount = utils.parseEther('8347');
    await mockMineOne.mock.balanceOfRewards.withArgs(userAddress).returns(mineOneAmount);
    await mockMineTwo.mock.balanceOfRewards.withArgs(userAddress).returns(mineTwoAmount);

    const balance = await miningService.balanceOfRewards(userAddress);

    expect(balance).to.equal(mineOneAmount.add(mineTwoAmount));
  });

  it("Correctly returns earned", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    await miningService.connect(admin).addRewardMine(mockMineOne.address);
    await miningService.connect(admin).addRewardMine(mockMineTwo.address);

    expect(await miningService.numberOfMines()).to.equal(2);

    // Should fail due to no mocks on mines
    await expect(miningService.earned(userAddress)).to.be.reverted;

    // Mock returns
    const mineOneAmount = utils.parseEther('5823');
    const mineTwoAmount = utils.parseEther('2234');
    await mockMineOne.mock.earned.withArgs(userAddress).returns(mineOneAmount);
    await mockMineTwo.mock.earned.withArgs(userAddress).returns(mineTwoAmount);

    const balance = await miningService.earned(userAddress);

    expect(balance).to.equal(mineOneAmount.add(mineTwoAmount));
  });

  it("Allows a user to withdraw all their rewards", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    await miningService.connect(admin).addRewardMine(mockMineOne.address);
    await miningService.connect(admin).addRewardMine(mockMineTwo.address);
    expect(await miningService.numberOfMines()).to.equal(2);

    const totalWithdraw = utils.parseEther('1000');

    await expect(miningService.connect(user).withdrawAccountRewards(totalWithdraw)).to.be.reverted;

    // Mock returns
    const mineOneAmount = utils.parseEther('600');
    const mineTwoAmount = utils.parseEther('400');
    await mockMineOne.mock.withdrawForAccount.withArgs(userAddress, totalWithdraw, userAddress).returns(mineOneAmount);
    await mockMineTwo.mock.withdrawForAccount.withArgs(userAddress, mineTwoAmount, userAddress).returns(mineTwoAmount);

    await miningService.connect(user).withdrawAccountRewards(totalWithdraw);
  });

  it("Allows a user to withdraw some of their rewards", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    await miningService.connect(admin).addRewardMine(mockMineOne.address);
    await miningService.connect(admin).addRewardMine(mockMineTwo.address);
    expect(await miningService.numberOfMines()).to.equal(2);

    const totalWithdraw = utils.parseEther('1000');

    await expect(miningService.connect(user).withdrawAccountRewards(totalWithdraw)).to.be.reverted;

    // Mock returns
    const mineOneAmount = utils.parseEther('1000');
    await mockMineOne.mock.withdrawForAccount.withArgs(userAddress, mineOneAmount, userAddress).returns(mineOneAmount);

    // mine two is not mocked as it should not get called due to
    // mine one filling up the entire reward

    await miningService.connect(user).withdrawAccountRewards(totalWithdraw);
  });

  it("Handles calling onBond", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    await miningService.connect(admin).addRewardMine(mockMineOne.address);
    await miningService.connect(admin).addRewardMine(mockMineTwo.address);
    expect(await miningService.numberOfMines()).to.equal(2);

    const amount = utils.parseEther('1000');

    await expect(miningService.onBond(userAddress, amount)).to.be.revertedWith("Must have bonding privs");

    await expect(miningService.connect(bonding).onBond(userAddress, amount)).to.be.reverted;
    await mockMineOne.mock.onBond.withArgs(userAddress, amount).returns();
    await expect(miningService.connect(bonding).onBond(userAddress, amount)).to.be.reverted;
    await mockMineTwo.mock.onBond.withArgs(userAddress, amount).returns();

    await miningService.connect(bonding).onBond(userAddress, amount);
  });

  it("Handles calling onUnbond", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();

    await miningService.connect(admin).addRewardMine(mockMineOne.address);
    await miningService.connect(admin).addRewardMine(mockMineTwo.address);
    expect(await miningService.numberOfMines()).to.equal(2);

    const amount = utils.parseEther('1000');

    await expect(miningService.onUnbond(userAddress, amount)).to.be.revertedWith("Must have bonding privs");

    await expect(miningService.connect(bonding).onUnbond(userAddress, amount)).to.be.reverted;
    await mockMineOne.mock.onUnbond.withArgs(userAddress, amount).returns();
    await expect(miningService.connect(bonding).onUnbond(userAddress, amount)).to.be.reverted;
    await mockMineTwo.mock.onUnbond.withArgs(userAddress, amount).returns();

    await miningService.connect(bonding).onUnbond(userAddress, amount);
  });

  it("Allows reinvestor to withdraw on behalf of an account", async function() {
    const [user] = accounts;
    const userAddress = await user.getAddress();
    const reinvestorAddress = await reinvestor.getAddress();

    await miningService.connect(admin).addRewardMine(mockMineOne.address);
    await miningService.connect(admin).addRewardMine(mockMineTwo.address);
    expect(await miningService.numberOfMines()).to.equal(2);

    const totalWithdraw = utils.parseEther('1000');

    await expect(miningService.connect(user).withdrawRewardsForAccount(userAddress, totalWithdraw)).to.be.reverted;
    await expect(miningService.connect(reinvestorAddress).withdrawRewardsForAccount(userAddress, totalWithdraw)).to.be.reverted;

    // Mock returns
    const mineOneAmount = utils.parseEther('600');
    const mineTwoAmount = utils.parseEther('400');
    await mockMineOne.mock.withdrawForAccount.withArgs(userAddress, totalWithdraw, reinvestorAddress).returns(mineOneAmount);
    await mockMineTwo.mock.withdrawForAccount.withArgs(userAddress, mineTwoAmount, reinvestorAddress).returns(mineTwoAmount);

    await expect(miningService.connect(user).withdrawRewardsForAccount(userAddress, totalWithdraw)).to.be.reverted;
    await miningService.connect(reinvestor).withdrawRewardsForAccount(userAddress, totalWithdraw);

    await miningService.connect(reinvestor).withdrawRewardsForAccount(userAddress, totalWithdraw);
  });

  it("Allows admins to set new reinvestor", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(miningService.connect(user).setReinvestor(newAddress)).to.be.reverted;
    await expect(miningService.connect(reinvestor).setReinvestor(newAddress)).to.be.reverted;

    await miningService.connect(admin).setReinvestor(newAddress);
    expect(await miningService.reinvestor()).to.equal(newAddress);

    await miningService.setReinvestor(new2Address);
    expect(await miningService.reinvestor()).to.equal(new2Address);
  });

  it("Allows admins to set new bonding", async function() {
    const [newContract, newContract2, user] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(miningService.connect(user).setBonding(newAddress)).to.be.reverted;
    await expect(miningService.connect(reinvestor).setBonding(newAddress)).to.be.reverted;

    await miningService.connect(admin).setBonding(newAddress);
    expect(await miningService.bonding()).to.equal(newAddress);

    await miningService.setBonding(new2Address);
    expect(await miningService.bonding()).to.equal(new2Address);
  });
});

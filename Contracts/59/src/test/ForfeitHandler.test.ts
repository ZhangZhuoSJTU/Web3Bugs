import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { ForfeitHandler } from "../type/ForfeitHandler";
import { TransferService } from "../type/TransferService";
import { Malt } from "../type/Malt";
import { ERC20 } from "../type/ERC20";
import { ContractFactory, constants, utils, Contract, BigNumber } from 'ethers';
import { hardhatSnapshot, hardhatRevert, increaseTime } from "./helpers";

const { deployMockContract } = waffle;

describe("Forfeit Handler", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;
  let treasury: Signer;
  let swingTrader: Signer;

  let dai: ERC20;

  let forfeitor: ForfeitHandler;
  let snapshotId: string;

  let mockTransferService: TransferService;

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, admin, treasury, swingTrader, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const treasuryAddress = await treasury.getAddress();
    const swingTraderAddress = await swingTrader.getAddress();

    mockTransferService = ((await deployMockContract(owner, [
      "function verifyTransfer(address, address, uint256) returns (bool, string memory)"
    ])) as any) as TransferService;
    await mockTransferService.mock.verifyTransfer.returns(true, "");

    const ERC20Factory = await ethers.getContractFactory("Malt");

    // Deploy ERC20 tokens
    dai = (await ERC20Factory.deploy("Dai Stablecoin", "DAI")) as Malt;

    await dai.initialize(ownerAddress, adminAddress, mockTransferService.address, [ownerAddress], []);
    await dai.deployed();

    // Deploy the ForfeitHandler
    const ForfeitHandlerFactory = await ethers.getContractFactory("ForfeitHandler");

    forfeitor = (await ForfeitHandlerFactory.deploy()) as ForfeitHandler;
    await forfeitor.initialize(
      ownerAddress,
      adminAddress,
      dai.address,
      treasuryAddress,
      swingTraderAddress
    );
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Has correct initial conditions", async function() {
    const treasuryAddress = await treasury.getAddress();
    const swingTraderAddress = await swingTrader.getAddress();

    expect(await forfeitor.rewardToken()).to.equal(dai.address);
    expect(await forfeitor.treasuryMultisig()).to.equal(treasuryAddress);
    expect(await forfeitor.swingTrader()).to.equal(swingTraderAddress);
    expect(await forfeitor.swingTraderRewardCut()).to.equal(500);
    expect(await forfeitor.treasuryRewardCut()).to.equal(500);
  });

  it("It correctly distributes forfeited tokens", async function() {
    const treasuryAddress = await treasury.getAddress();
    const swingTraderAddress = await swingTrader.getAddress();
    const amount = utils.parseEther('1000');
    await dai.mint(forfeitor.address, amount);

    expect(await dai.balanceOf(swingTraderAddress)).to.equal(0);
    expect(await dai.balanceOf(treasuryAddress)).to.equal(0);

    await forfeitor.handleForfeit();

    // Divided by 2 as default settings splits 50/50 between swing trader and treasury
    expect(await dai.balanceOf(swingTraderAddress)).to.equal(amount.div(2));
    expect(await dai.balanceOf(treasuryAddress)).to.equal(amount.div(2));
  });

  it("It handles calling handleForfeit when there is 0 balance", async function() {
    const treasuryAddress = await treasury.getAddress();
    const swingTraderAddress = await swingTrader.getAddress();

    expect(await dai.balanceOf(swingTraderAddress)).to.equal(0);
    expect(await dai.balanceOf(treasuryAddress)).to.equal(0);

    await forfeitor.handleForfeit();

    expect(await dai.balanceOf(swingTraderAddress)).to.equal(0);
    expect(await dai.balanceOf(treasuryAddress)).to.equal(0);
  });

  it("Only allows admins to update reward cut", async function() {
    expect(await forfeitor.swingTraderRewardCut()).to.equal(500);
    expect(await forfeitor.treasuryRewardCut()).to.equal(500);

    const [user, user2] = accounts;

    let treasuryCut = 10;
    let swingTraderCut = 990;
    await expect(forfeitor.connect(user).setRewardCut(treasuryCut, swingTraderCut)).to.be.reverted;
    await expect(forfeitor.connect(user2).setRewardCut(treasuryCut, swingTraderCut)).to.be.reverted;

    await forfeitor.connect(admin).setRewardCut(treasuryCut, swingTraderCut);
    expect(await forfeitor.swingTraderRewardCut()).to.equal(swingTraderCut);
    expect(await forfeitor.treasuryRewardCut()).to.equal(treasuryCut);

    treasuryCut = 0;
    swingTraderCut = 1000;

    // Default signer has the Timelock role
    await forfeitor.setRewardCut(treasuryCut, swingTraderCut);
    expect(await forfeitor.swingTraderRewardCut()).to.equal(swingTraderCut);
    expect(await forfeitor.treasuryRewardCut()).to.equal(treasuryCut);
  });

  it("Enforces cut must add to 100%", async function() {
    expect(await forfeitor.swingTraderRewardCut()).to.equal(500);
    expect(await forfeitor.treasuryRewardCut()).to.equal(500);

    const [user, user2] = accounts;

    // Doesn't add to 1000. Therefore not 100%
    let treasuryCut = 0;
    let swingTraderCut = 990;

    await expect(forfeitor.connect(admin).setRewardCut(treasuryCut, swingTraderCut)).to.be.revertedWith("Reward cut must add to 100%");

    expect(await forfeitor.swingTraderRewardCut()).to.equal(500);
    expect(await forfeitor.treasuryRewardCut()).to.equal(500);
  });

  it("Only allows admin to set treasury", async function() {
    const [newContract, newContract2, user, user2] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(forfeitor.connect(user).setTreasury(newAddress)).to.be.reverted;
    await expect(forfeitor.connect(user2).setTreasury(newAddress)).to.be.reverted;

    await forfeitor.connect(admin).setTreasury(newAddress);
    expect(await forfeitor.treasuryMultisig()).to.equal(newAddress);

    await forfeitor.setTreasury(new2Address);
    expect(await forfeitor.treasuryMultisig()).to.equal(new2Address);
  });
});

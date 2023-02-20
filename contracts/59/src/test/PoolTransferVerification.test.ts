import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { MaltDataLab } from "../type/MaltDataLab";
import { PoolTransferVerification } from "../type/PoolTransferVerification";
import { ContractFactory, constants, utils, Contract, BigNumber } from 'ethers';
import { hardhatSnapshot, hardhatRevert, increaseTime } from "./helpers";
import IERC20 from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import MaltArtifacts from "../artifacts/contracts/Malt.sol/Malt.json";

const { deployMockContract } = waffle;

describe("Transfer Verification", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;
  let pool: Signer;

  let verifier: PoolTransferVerification;
  let snapshotId: string;

  let mockDataLab: MaltDataLab;

  let thresholdBps = 200; // 2%
  let lookback = 60 * 10; // 10 minutes
  let priceTarget = utils.parseEther('1');

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, admin, pool, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const poolAddress = await pool.getAddress();

    mockDataLab = ((await deployMockContract(owner, [
      "function priceTarget() returns(uint256)",
      "function maltPriceAverage(uint256) returns(uint256)",
    ])) as any) as MaltDataLab;
    await mockDataLab.mock.priceTarget.returns(priceTarget);

    // Deploy the PoolTransferVerification
    const PoolTransferVerificationFactory = await ethers.getContractFactory("PoolTransferVerification");

    verifier = (await PoolTransferVerificationFactory.deploy()) as PoolTransferVerification;

    await verifier.initialize(
      ownerAddress,
      adminAddress,
      thresholdBps,
      mockDataLab.address,
      lookback,
      poolAddress,
    );
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Has correct initial conditions", async function() {
    const poolAddress = await pool.getAddress();

    expect(await verifier.thresholdBps()).to.equal(thresholdBps);
    expect(await verifier.maltDataLab()).to.equal(mockDataLab.address);
    expect(await verifier.priceLookback()).to.equal(lookback);
    expect(await verifier.pool()).to.equal(poolAddress);
  });

  it("Only allows admin to add an address to the whitelist", async function() {
    const [user, user1, user2] = accounts;
    const userAddress = await user.getAddress();
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();

    await expect(verifier.connect(user).addToWhitelist(userAddress)).to.be.reverted;
    await expect(verifier.connect(user1).addToWhitelist(userAddress)).to.be.reverted;

    expect(await verifier.isWhitelisted(userAddress)).to.equal(false);
    expect(await verifier.isWhitelisted(userOneAddress)).to.equal(false);
    expect(await verifier.isWhitelisted(userTwoAddress)).to.equal(false);

    await verifier.connect(admin).addToWhitelist(userAddress);
    // owner is timelock for these tests
    await verifier.addToWhitelist(userOneAddress);

    expect(await verifier.isWhitelisted(userAddress)).to.equal(true);
    expect(await verifier.isWhitelisted(userOneAddress)).to.equal(true);
    expect(await verifier.isWhitelisted(userTwoAddress)).to.equal(false);
  });

  it("Only allows admin to remove an address from the whitelist", async function() {
    const [user, user1, user2] = accounts;
    const userAddress = await user.getAddress();
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();

    await verifier.connect(admin).addToWhitelist(userAddress);
    // owner is timelock for these tests
    await verifier.addToWhitelist(userOneAddress);

    expect(await verifier.isWhitelisted(userAddress)).to.equal(true);
    expect(await verifier.isWhitelisted(userOneAddress)).to.equal(true);

    await expect(verifier.connect(user).removeFromWhitelist(userAddress)).to.be.reverted;
    await expect(verifier.connect(user1).removeFromWhitelist(userAddress)).to.be.reverted;

    expect(await verifier.isWhitelisted(userAddress)).to.equal(true);
    expect(await verifier.isWhitelisted(userOneAddress)).to.equal(true);

    await verifier.connect(admin).removeFromWhitelist(userAddress);
    // owner is timelock for these tests
    await verifier.removeFromWhitelist(userOneAddress);

    expect(await verifier.isWhitelisted(userAddress)).to.equal(false);
    expect(await verifier.isWhitelisted(userOneAddress)).to.equal(false);
  });

  it("Always returns true when from address is not the pool", async function() {
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();
    const amount = utils.parseEther('2307');

    const [successOne, stringOne] = await verifier.verifyTransfer(userOneAddress, userTwoAddress, amount);
    const [successTwo, stringTwo] = await verifier.verifyTransfer(userOneAddress, userTwoAddress, amount);
    expect(successOne).to.equal(true);
    expect(stringOne).to.equal("");
    expect(successTwo).to.equal(true);
    expect(stringTwo).to.equal("");
  });

  it("Always returns true on pool transfers when at peg", async function() {
    await mockDataLab.mock.maltPriceAverage.returns(utils.parseEther('1'));
    const poolAddress = await pool.getAddress();
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();
    const amount = utils.parseEther('2307');

    const [successOne] = await verifier.verifyTransfer(poolAddress, userOneAddress, amount);
    const [successTwo] = await verifier.verifyTransfer(poolAddress, userTwoAddress, amount);
    expect(successOne).to.equal(true);
    expect(successTwo).to.equal(true);
  });

  it("Returns false for non-whitelisted transfers from pool when under peg", async function() {
    await mockDataLab.mock.maltPriceAverage.returns(utils.parseEther('0.5'));
    const poolAddress = await pool.getAddress();
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();
    const amount = utils.parseEther('2307');

    const [successOne, stringOne] = await verifier.verifyTransfer(poolAddress, userOneAddress, amount);
    const [successTwo, stringTwo] = await verifier.verifyTransfer(poolAddress, userTwoAddress, amount);
    expect(successOne).to.equal(false);
    expect(stringOne).to.equal("The price of Malt is below peg. Wait for peg to be regained or purchase arbitrage tokens.");
    expect(successTwo).to.equal(false);
    expect(stringTwo).to.equal("The price of Malt is below peg. Wait for peg to be regained or purchase arbitrage tokens.");
  });

  it("Allows whitelisted address to transfer under peg", async function() {
    await mockDataLab.mock.maltPriceAverage.returns(utils.parseEther('0.5'));
    const poolAddress = await pool.getAddress();
    const [user1, user2] = accounts;
    const userOneAddress = await user1.getAddress();
    const userTwoAddress = await user2.getAddress();
    const amount = utils.parseEther('2307');

    await verifier.connect(admin).addToWhitelist(userOneAddress);

    const [successOne] = await verifier.verifyTransfer(poolAddress, userOneAddress, amount);
    const [successTwo] = await verifier.verifyTransfer(poolAddress, userTwoAddress, amount);
    expect(successOne).to.equal(true);
    expect(successTwo).to.equal(false);
  });

  it("It only allows admins to update price lookback period", async function() {
    expect(await verifier.priceLookback()).to.equal(lookback);

    const [user, user1] = accounts;

    await expect(verifier.connect(user).setPriceLookback(10)).to.be.reverted;
    await expect(verifier.connect(user1).setPriceLookback(10)).to.be.reverted;

    const newLookback = 356;
    await verifier.connect(admin).setPriceLookback(newLookback);
    expect(await verifier.priceLookback()).to.equal(newLookback);

    // Default signer has the Timelock role
    await verifier.setPriceLookback(422);
    expect(await verifier.priceLookback()).to.equal(422);
  });

  it("It only allows admins to update price threshold", async function() {
    expect(await verifier.thresholdBps()).to.equal(thresholdBps);

    const [user, user1] = accounts;

    await expect(verifier.connect(user).setThreshold(10)).to.be.reverted;
    await expect(verifier.connect(user1).setThreshold(10)).to.be.reverted;

    const newThreshold = 356;
    await verifier.connect(admin).setThreshold(newThreshold);
    expect(await verifier.thresholdBps()).to.equal(newThreshold);

    // Default signer has the Timelock role
    await verifier.setThreshold(422);
    expect(await verifier.thresholdBps()).to.equal(422);
  });

  it("Only allows admin to set pool", async function() {
    const [newContract, newContract2, user, user2] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(verifier.connect(user).setPool(newAddress)).to.be.reverted;
    await expect(verifier.connect(user2).setPool(newAddress)).to.be.reverted;

    await verifier.connect(admin).setPool(newAddress);
    expect(await verifier.pool()).to.equal(newAddress);

    await verifier.setPool(new2Address);
    expect(await verifier.pool()).to.equal(new2Address);
  });
});

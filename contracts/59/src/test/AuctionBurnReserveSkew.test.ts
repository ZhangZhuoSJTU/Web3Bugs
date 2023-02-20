import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { Signer } from "ethers";
import { AuctionBurnReserveSkew } from "../type/AuctionBurnReserveSkew";
import { Auction } from "../type/Auction";
import { MaltDAO } from "../type/MaltDAO";
import { Malt } from "../type/Malt";
import { ERC20 } from "../type/ERC20";
import { ContractFactory, constants, utils, Contract, BigNumber } from 'ethers';
import { hardhatSnapshot, hardhatRevert, increaseTime } from "./helpers";
import IERC20 from "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json";
import MaltArtifacts from "../artifacts/contracts/Malt.sol/Malt.json";

const { deployMockContract } = waffle;

describe("Auction Burn Reserve Skew", function() {
  let accounts: Signer[];
  let owner: Signer;
  let admin: Signer;
  let stabilizerNode: Signer;

  let skewContract: AuctionBurnReserveSkew;
  let snapshotId: string;

  let mockAuction: Auction;
  let auctionLookback = 10;

  beforeEach(async function() {
    snapshotId = await hardhatSnapshot();
    [owner, admin, stabilizerNode, ...accounts] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const stabilizerNodeAddress = await stabilizerNode.getAddress();

    mockAuction = ((await deployMockContract(owner, [
      "function currentAuctionId() returns (uint256)",
      "function getAuctionCommitments(uint256) returns (uint256, uint256)",
    ])) as any) as Auction;

    // Deploy the AuctionBurnReserveSkew
    const AuctionBurnReserveSkewFactory = await ethers.getContractFactory("AuctionBurnReserveSkew");

    skewContract = (await AuctionBurnReserveSkewFactory.deploy()) as AuctionBurnReserveSkew;

    await skewContract.initialize(
      ownerAddress,
      adminAddress,
      stabilizerNodeAddress,
      mockAuction.address,
      auctionLookback,
    );
  });

  afterEach(async function() {
    await hardhatRevert(snapshotId);
  });

  it("Has correct initial conditions", async function() {
    const stabilizerNodeAddress = await stabilizerNode.getAddress();

    expect(await skewContract.stabilizerNode()).to.equal(stabilizerNodeAddress);
    expect(await skewContract.auction()).to.equal(mockAuction.address);
    expect(await skewContract.auctionAverageLookback()).to.equal(auctionLookback);
    expect(await skewContract.count()).to.equal(0);
  });

  it("Only allows stabilizerNode to call addAbovePegObservation", async function() {
    const [user, user2] = accounts;
    const price = utils.parseEther('1.1');
    await expect(skewContract.connect(user).addAbovePegObservation(price)).to.be.reverted;
    await expect(skewContract.connect(user2).addAbovePegObservation(price)).to.be.reverted;

    await skewContract.connect(stabilizerNode).addAbovePegObservation(price);

    expect(await skewContract.count()).to.equal(1);
    // Above peg observation
    expect(await skewContract.pegObservations(0)).to.equal(1);
  });

  it("Only allows stabilizerNode to call addAbovePegObservation", async function() {
    const [user, user2] = accounts;
    const price = utils.parseEther('0.8');
    await expect(skewContract.connect(user).addBelowPegObservation(price)).to.be.reverted;
    await expect(skewContract.connect(user2).addBelowPegObservation(price)).to.be.reverted;

    await skewContract.connect(stabilizerNode).addBelowPegObservation(price);

    expect(await skewContract.count()).to.equal(1);
    // Below peg observation
    expect(await skewContract.pegObservations(0)).to.equal(0);
  });

  it("Correctly returns peg delta frequency with a single above peg observation", async function() {
    const price = utils.parseEther('1.1');
    await skewContract.connect(stabilizerNode).addAbovePegObservation(price);

    const pegDelta = await skewContract.getPegDeltaFrequency();
    expect(pegDelta).to.equal(1000);
  });

  it("Correctly returns peg delta frequency with a single below peg observation", async function() {
    const price = utils.parseEther('0.7');
    await skewContract.connect(stabilizerNode).addBelowPegObservation(price);

    const pegDelta = await skewContract.getPegDeltaFrequency();
    expect(pegDelta).to.equal(0);
  });

  it("Correctly returns peg delta frequency with all above peg observations", async function() {
    const price = utils.parseEther('1.1');
    for (let i = 0; i < auctionLookback; i++ ) {
      await skewContract.connect(stabilizerNode).addAbovePegObservation(price);
    }

    const pegDelta = await skewContract.getPegDeltaFrequency();
    expect(pegDelta).to.equal(10000);
  });

  it("Correctly returns peg delta frequency with all below peg observations", async function() {
    const price = utils.parseEther('0.7');
    for (let i = 0; i < auctionLookback; i++ ) {
      await skewContract.connect(stabilizerNode).addBelowPegObservation(price);
    }

    const pegDelta = await skewContract.getPegDeltaFrequency();
    expect(pegDelta).to.equal(0);
  });

  it("Correctly returns peg delta frequency with half above and half below peg observations", async function() {
    const abovePrice = utils.parseEther('1.1');
    const belowPrice = utils.parseEther('0.7');
    for (let i = 0; i < auctionLookback / 2; i++ ) {
      await skewContract.connect(stabilizerNode).addAbovePegObservation(abovePrice);
    }
    for (let i = 0; i < auctionLookback / 2; i++ ) {
      await skewContract.connect(stabilizerNode).addBelowPegObservation(belowPrice);
    }

    const pegDelta = await skewContract.getPegDeltaFrequency();
    expect(pegDelta).to.equal(5000);
  });

  it("Correctly returns average auction participation with a single fully subscribed auction", async function() {
    const commitments = utils.parseEther('10234');
    await mockAuction.mock.currentAuctionId.returns(1);
    await mockAuction.mock.getAuctionCommitments.withArgs(0).returns(commitments, commitments);

    const participation = await skewContract.getAverageParticipation();
    expect(participation).to.equal(10000); // 100%
  });

  it("Correctly returns average auction participation with a single half subscribed auction", async function() {
    const commitments = utils.parseEther('10234');
    await mockAuction.mock.currentAuctionId.returns(1);
    await mockAuction.mock.getAuctionCommitments.withArgs(0).returns(commitments, commitments.mul(2));

    const participation = await skewContract.getAverageParticipation();
    expect(participation).to.equal(5000); // 50%
  });

  it("Correctly returns average auction participation with a single zero subscribed auction", async function() {
    const commitments = utils.parseEther('10234');
    await mockAuction.mock.currentAuctionId.returns(1);
    await mockAuction.mock.getAuctionCommitments.withArgs(0).returns(0, commitments);

    const participation = await skewContract.getAverageParticipation();
    expect(participation).to.equal(0); // 0%
  });

  it("Correctly returns average auction participation with many fully subscribed auction", async function() {
    const commitments = utils.parseEther('10234');
    await mockAuction.mock.currentAuctionId.returns(20);
    for (let i = 0; i < 20; i++) {
      await mockAuction.mock.getAuctionCommitments.withArgs(i).returns(commitments, commitments);
    }

    const participation = await skewContract.getAverageParticipation();
    expect(participation).to.equal(10000); // 100%
  });

  it("Correctly returns average auction participation with many half subscribed auction", async function() {
    const commitments = utils.parseEther('10234');
    await mockAuction.mock.currentAuctionId.returns(20);
    for (let i = 0; i < 20; i++) {
      await mockAuction.mock.getAuctionCommitments.withArgs(i).returns(commitments, commitments.mul(2));
    }

    const participation = await skewContract.getAverageParticipation();
    expect(participation).to.equal(5000); // 50%
  });

  it("Correctly returns average auction participation with many zero subscribed auction", async function() {
    const commitments = utils.parseEther('10234');
    await mockAuction.mock.currentAuctionId.returns(20);
    for (let i = 0; i < 20; i++) {
      await mockAuction.mock.getAuctionCommitments.withArgs(i).returns(0, commitments);
    }

    const participation = await skewContract.getAverageParticipation();
    expect(participation).to.equal(0); // 0%
  });

  it("Returns full excess when peg delta and average participation are 100%", async function() {
    // Set up average auction participation to be 100%
    const commitments = utils.parseEther('10234');
    await mockAuction.mock.currentAuctionId.returns(1);
    await mockAuction.mock.getAuctionCommitments.withArgs(0).returns(commitments, commitments);

    // Set up peg delta to be 100% ie all above peg
    const price = utils.parseEther('1.1');
    for (let i = 0; i < auctionLookback; i++ ) {
      await skewContract.connect(stabilizerNode).addAbovePegObservation(price);
    }

    const excess = utils.parseEther('123235');

    const skew = await skewContract.consult(excess);
    expect(skew).to.equal(excess);
  });

  it("Returns 0 skew when peg delta and average participation are 0%", async function() {
    // Set up average auction participation to be 0%
    const commitments = utils.parseEther('10234');
    await mockAuction.mock.currentAuctionId.returns(1);
    await mockAuction.mock.getAuctionCommitments.withArgs(0).returns(0, commitments);

    // Set up peg delta to be 0% ie all below peg
    const price = utils.parseEther('0.3');
    for (let i = 0; i < auctionLookback; i++ ) {
      await skewContract.connect(stabilizerNode).addBelowPegObservation(price);
    }

    const excess = utils.parseEther('123235');

    const skew = await skewContract.consult(excess);
    expect(skew).to.equal(0);
  });

  it("Returns 2/3rds of excess when peg delta is 0 but average participation are 100%", async function() {
    // Set up average auction participation to be 0%
    const commitments = utils.parseEther('10234');
    await mockAuction.mock.currentAuctionId.returns(1);
    await mockAuction.mock.getAuctionCommitments.withArgs(0).returns(commitments, commitments);

    // Set up peg delta to be 0% ie all below peg
    const price = utils.parseEther('0.3');
    for (let i = 0; i < auctionLookback; i++ ) {
      await skewContract.connect(stabilizerNode).addBelowPegObservation(price);
    }

    const excess = utils.parseEther('123235');

    const skew = await skewContract.consult(excess);
    expect(skew).to.be.withinPercent(excess.mul(2).div(3));
  });

  it("Returns 1/3rd of excess when peg delta is 100% but average participation is 0%", async function() {
    // Set up average auction participation to be 0%
    const commitments = utils.parseEther('10234');
    await mockAuction.mock.currentAuctionId.returns(1);
    await mockAuction.mock.getAuctionCommitments.withArgs(0).returns(0, commitments);

    // Set up peg delta to be 100% ie all above peg
    const price = utils.parseEther('1.1');
    for (let i = 0; i < auctionLookback; i++ ) {
      await skewContract.connect(stabilizerNode).addAbovePegObservation(price);
    }

    const excess = utils.parseEther('123235');

    const skew = await skewContract.consult(excess);
    expect(skew).to.be.withinPercent(excess.div(3));
  });

  it("Returns full burn spend budget when peg delta and average participation are 100%", async function() {
    // Set up average auction participation to be 100%
    const commitments = utils.parseEther('10234');
    await mockAuction.mock.currentAuctionId.returns(1);
    await mockAuction.mock.getAuctionCommitments.withArgs(0).returns(commitments, commitments);

    // Set up peg delta to be 100% ie all above peg
    const price = utils.parseEther('1.1');
    for (let i = 0; i < auctionLookback; i++ ) {
      await skewContract.connect(stabilizerNode).addAbovePegObservation(price);
    }

    const maxBurnSpend = utils.parseEther('100235');
    const premiumExcess = utils.parseEther('23235');

    const burnBudget = await skewContract.getRealBurnBudget(maxBurnSpend, premiumExcess);
    expect(burnBudget).to.equal(maxBurnSpend);
  });

  it("Returns just premium excess when peg delta and average participation are 0%", async function() {
    // Set up average auction participation to be 0%
    const commitments = utils.parseEther('10234');
    await mockAuction.mock.currentAuctionId.returns(1);
    await mockAuction.mock.getAuctionCommitments.withArgs(0).returns(0, commitments);

    // Set up peg delta to be 0% ie all below peg
    const price = utils.parseEther('0.3');
    for (let i = 0; i < auctionLookback; i++ ) {
      await skewContract.connect(stabilizerNode).addBelowPegObservation(price);
    }

    const maxBurnSpend = utils.parseEther('100235');
    const premiumExcess = utils.parseEther('23235');

    const burnBudget = await skewContract.getRealBurnBudget(maxBurnSpend, premiumExcess);
    expect(burnBudget).to.equal(premiumExcess);
  });

  it("Returns correct burn budget when peg delta is 0 but average participation are 100%", async function() {
    // Set up average auction participation to be 0%
    const commitments = utils.parseEther('10234');
    await mockAuction.mock.currentAuctionId.returns(1);
    await mockAuction.mock.getAuctionCommitments.withArgs(0).returns(commitments, commitments);

    // Set up peg delta to be 0% ie all below peg
    const price = utils.parseEther('0.3');
    for (let i = 0; i < auctionLookback; i++ ) {
      await skewContract.connect(stabilizerNode).addBelowPegObservation(price);
    }

    const maxBurnSpend = utils.parseEther('100235');
    const premiumExcess = utils.parseEther('23235');
    const diff = maxBurnSpend.sub(premiumExcess);

    const burnBudget = await skewContract.getRealBurnBudget(maxBurnSpend, premiumExcess);
    expect(burnBudget).to.be.withinPercent(premiumExcess.add(diff.mul(2).div(3)));
  });

  it("Returns correct burn budget when peg delta is 100% but average participation is 0%", async function() {
    // Set up average auction participation to be 0%
    const commitments = utils.parseEther('10234');
    await mockAuction.mock.currentAuctionId.returns(1);
    await mockAuction.mock.getAuctionCommitments.withArgs(0).returns(0, commitments);

    // Set up peg delta to be 100% ie all above peg
    const price = utils.parseEther('1.1');
    for (let i = 0; i < auctionLookback; i++ ) {
      await skewContract.connect(stabilizerNode).addAbovePegObservation(price);
    }

    const maxBurnSpend = utils.parseEther('100235');
    const premiumExcess = utils.parseEther('23235');
    const diff = maxBurnSpend.sub(premiumExcess);

    const burnBudget = await skewContract.getRealBurnBudget(maxBurnSpend, premiumExcess);
    expect(burnBudget).to.be.withinPercent(premiumExcess.add(diff.div(3)));
  });

  it("It only allows admins to update auction lookback", async function() {
    expect(await skewContract.auctionAverageLookback()).to.equal(auctionLookback);

    const [user, user2] = accounts;

    const newLookback = 356;
    await expect(skewContract.connect(user).setAuctionAverageLookback(newLookback)).to.be.reverted;
    await expect(skewContract.connect(user2).setAuctionAverageLookback(newLookback)).to.be.reverted;

    await skewContract.connect(admin).setAuctionAverageLookback(newLookback);
    expect(await skewContract.auctionAverageLookback()).to.equal(newLookback);

    // Default signer has the Timelock role
    await skewContract.setAuctionAverageLookback(422);
    expect(await skewContract.auctionAverageLookback()).to.equal(422);
  });

  it("Only allows admin to set new stabilizer node", async function() {
    const [newContract, newContract2, user, user2] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(skewContract.connect(user).setNewStabilizerNode(newAddress)).to.be.reverted;
    await expect(skewContract.connect(user2).setNewStabilizerNode(newAddress)).to.be.reverted;

    await skewContract.connect(admin).setNewStabilizerNode(newAddress);
    expect(await skewContract.stabilizerNode()).to.equal(newAddress);

    await skewContract.setNewStabilizerNode(new2Address);
    expect(await skewContract.stabilizerNode()).to.equal(new2Address);
  });

  it("Only allows admin to set new auction", async function() {
    const [newContract, newContract2, user, user2] = accounts;
    const newAddress = await newContract.getAddress();
    const new2Address = await newContract2.getAddress();

    await expect(skewContract.connect(user).setNewAuction(newAddress)).to.be.reverted;
    await expect(skewContract.connect(user2).setNewAuction(newAddress)).to.be.reverted;

    await skewContract.connect(admin).setNewAuction(newAddress);
    expect(await skewContract.auction()).to.equal(newAddress);

    await skewContract.setNewAuction(new2Address);
    expect(await skewContract.auction()).to.equal(new2Address);
  });
});

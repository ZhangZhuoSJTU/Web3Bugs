const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const UNI_WEIGHT = '5000000000000000000';
const COMP_WEIGHT = '1000000000000000000';
const AAVE_WEIGHT = '1000000000000000000';

const fee = `${Math.pow(10,16)}`;
const tokenName = "UCA";
const tokenSymbol = "UCA";
const ONE_YEAR = 365.25 * 24 * 60 * 60;

let owner, addr1, addr2;
let factory, BasketImpl, UNI, COMP, AAVE, basket, AuctionImpl;
let mintTimestamp;

async function mineBlocks(blockNumber) {
    while (blockNumber > 0) {
      blockNumber--;
      await hre.network.provider.request({
        method: "evm_mine",
        params: [],
      });
    }
}

async function getTimestamp(tx) {
  let block = await ethers.provider.getBlock(tx.blockNumber);
  return block.timestamp;
}

describe("Basket", function () {
    beforeEach(async () => {
        [owner, addr1, addr2] = await ethers.getSigners();
    
        const Factory = await ethers.getContractFactory("Factory");
        AuctionImpl = await ethers.getContractFactory("Auction");
        const auctionImpl = await AuctionImpl.deploy();
        BasketImpl = await ethers.getContractFactory("Basket");
        const basketImpl = await BasketImpl.deploy();
        const TestToken = await ethers.getContractFactory("TestToken");
    
        factory = await Factory.deploy(auctionImpl.address, basketImpl.address);
        await factory.deployed();

        UNI = await TestToken.deploy('UNI', 'UNI');
        await UNI.deployed();
    
        COMP = await TestToken.deploy('COMP', 'COMP');
        await COMP.deployed();
    
        AAVE = await TestToken.deploy('AAVE', 'AAVE');
        await AAVE.deployed();

        await UNI.connect(addr1).mint(UNI_WEIGHT);
        await COMP.connect(addr1).mint(COMP_WEIGHT);
        await AAVE.connect(addr1).mint(AAVE_WEIGHT);

        await factory.connect(addr2).proposeBasketLicense(fee, 
            tokenName, 
            tokenSymbol, 
            [UNI.address, COMP.address, AAVE.address], 
            [UNI_WEIGHT, COMP_WEIGHT, AAVE_WEIGHT]);

        
        await UNI.connect(addr1).approve(factory.address, `${UNI_WEIGHT}`);
        await COMP.connect(addr1).approve(factory.address, `${COMP_WEIGHT}`);
        await AAVE.connect(addr1).approve(factory.address, `${AAVE_WEIGHT}`);

        let tx = await factory.connect(addr1).createBasket(0);
        mintTimestamp = await getTimestamp(tx);

        let proposal = await factory.proposal(0);
        basket = BasketImpl.attach(proposal.basket);
      });
      it("should allow minting if user has all needed balances and approvals", async () => {
        await expect(basket.connect(addr1).mint('1000000000000000000')).to.be.reverted;

        await UNI.connect(addr1).mint(`${UNI_WEIGHT * 3}`);
        await COMP.connect(addr1).mint(`${COMP_WEIGHT * 3}`);
        await AAVE.connect(addr1).mint(`${AAVE_WEIGHT * 3}`);

        await UNI.connect(addr1).approve(basket.address, `${UNI_WEIGHT * 3}`);
        await COMP.connect(addr1).approve(basket.address, `${COMP_WEIGHT * 3}`);
        await AAVE.connect(addr1).approve(basket.address, `${AAVE_WEIGHT * 3}`);

        await expect(basket.connect(addr1).mint('4000000000000000000')).to.be.reverted;
        await expect(basket.connect(addr1).mint('3000000000000000000')).to.be.ok;

        await expect(await basket.balanceOf(addr1.address)).to.equal('4000000000000000000')
      });
      it("should allow burning if user has basket tokens", async () => {
        await expect(basket.connect(addr1).burn('1000000000000000001')).to.be.reverted;

        await UNI.connect(addr1).mint(`${UNI_WEIGHT * 3}`);
        await COMP.connect(addr1).mint(`${COMP_WEIGHT * 3}`);
        await AAVE.connect(addr1).mint(`${AAVE_WEIGHT * 3}`);

        await UNI.connect(addr1).approve(basket.address, `${UNI_WEIGHT * 3}`);
        await COMP.connect(addr1).approve(basket.address, `${COMP_WEIGHT * 3}`);
        await AAVE.connect(addr1).approve(basket.address, `${AAVE_WEIGHT * 3}`);

        await expect(basket.connect(addr1).mint('3000000000000000000')).to.be.ok;

        await expect(basket.connect(addr1).burn('2000000000000000000')).to.be.ok;

        await expect(await basket.balanceOf(addr1.address)).to.equal('2000000000000000000');
        // await expect(await UNI.balanceOf(addr1.address)).to.equal(`${UNI_WEIGHT * 2}`);
        // await expect(await COMP.balanceOf(addr1.address)).to.equal(`${COMP_WEIGHT * 2}`);
        // await expect(await AAVE.balanceOf(addr1.address)).to.equal(`${AAVE_WEIGHT * 2}`);
      });
      it("Should allow changing the publisher after a timelock", async () => {
          await expect(basket.connect(addr1).changePublisher(addr1.address)).to.be.reverted;

          await expect(basket.connect(addr2).changePublisher(addr1.address)).to.be.ok;

          let publisher = await basket.publisher();
          expect(publisher).to.equal(addr2.address);

          await expect(basket.connect(addr2).changePublisher(addr2.address)).to.be.reverted;

          await mineBlocks(4 * 60 * 24 - 4);
          await expect(basket.connect(addr2).changePublisher(addr1.address)).to.be.reverted;
          await mineBlocks(1);
          await expect(basket.connect(addr2).changePublisher(addr1.address)).to.be.ok;

          publisher = await basket.publisher();
          expect(publisher).to.equal(addr1.address);
      });
      it("Should allow changing a valid license fee after a timelock", async () => {
        await expect(basket.connect(addr2).changeLicenseFee(`${9 * Math.pow(10,14)}`)).to.be.reverted;

        await expect(basket.connect(addr2).changeLicenseFee(`${2 * Math.pow(10,16)}`)).to.be.ok;

        let licenseFee = await basket.licenseFee();
        expect(licenseFee).to.equal(`${Math.pow(10,16)}`);

        await expect(basket.connect(addr2).changeLicenseFee(`${2 * Math.pow(10,16)}`)).to.be.reverted;

        await mineBlocks(4 * 60 * 24 - 4);
        await expect(basket.connect(addr2).changeLicenseFee(`${2 * Math.pow(10,16)}`)).to.be.reverted;
        await mineBlocks(1);
        await expect(basket.connect(addr2).changeLicenseFee(`${2 * Math.pow(10,16)}`)).to.be.ok;
        licenseFee = await basket.licenseFee();
        expect(licenseFee).to.equal(`${2 * Math.pow(10,16)}`);
    });
    it("Should allow setting new weights and start a rebalance auction after a timelock, if there is an existing auction that has not bonded, decommision existing auction", async () => {
        let NEW_UNI_WEIGHT = "2400000000000000000";
        let NEW_COMP_WEIGHT = "2000000000000000000";
        let NEW_AAVE_WEIGHT = "400000000000000000";
        await expect(basket.connect(addr1).publishNewIndex([UNI.address, COMP.address, AAVE.address], 
                                                             [NEW_UNI_WEIGHT, NEW_COMP_WEIGHT, NEW_AAVE_WEIGHT])).to.be.reverted;

        await expect(basket.connect(addr2).publishNewIndex([UNI.address, COMP.address, AAVE.address], 
                                                [NEW_UNI_WEIGHT, NEW_COMP_WEIGHT, NEW_AAVE_WEIGHT])).to.be.ok;

        let pendingWeights = await basket.pendingWeights();
        expect(pendingWeights.pending).to.equal(true);

        await expect(basket.connect(addr2).publishNewIndex([],[])).to.be.reverted;
        await mineBlocks(4 * 60 * 24 - 4);
        await expect(basket.connect(addr2).publishNewIndex([],[])).to.be.reverted;
        await mineBlocks(1);
        await expect(basket.connect(addr2).publishNewIndex([],[])).to.be.ok;
        let auctionAddr = await basket.auction();
        let auction = AuctionImpl.attach(auctionAddr);
        let auctionOngoing = await auction.auctionOngoing();
        expect(auctionOngoing).to.equal(true);

        await expect(basket.connect(addr2).publishNewIndex([UNI.address, COMP.address, AAVE.address], 
          [NEW_UNI_WEIGHT, NEW_COMP_WEIGHT, NEW_AAVE_WEIGHT])).to.be.ok;
        auctionOngoing = await auction.auctionOngoing();
        expect(auctionOngoing).to.equal(false);
        await expect(basket.connect(addr2).publishNewIndex([],[])).to.be.reverted;
        await mineBlocks(4 * 60 * 24 - 4);
        await expect(basket.connect(addr2).publishNewIndex([],[])).to.be.reverted;
        await mineBlocks(1);
        await expect(basket.connect(addr2).publishNewIndex([],[])).to.be.ok;
        auctionOngoing = await auction.auctionOngoing();
        expect(auctionOngoing).to.equal(true);
    });
    it("should collect streaming fees and split if ownerFee is set", async () => {
      await UNI.connect(addr1).mint(ethers.BigNumber.from(UNI_WEIGHT).mul(1000000));
      await COMP.connect(addr1).mint(ethers.BigNumber.from(COMP_WEIGHT).mul(1000000));
      await AAVE.connect(addr1).mint(ethers.BigNumber.from(AAVE_WEIGHT).mul(1000000));

      await UNI.connect(addr1).approve(basket.address, ethers.BigNumber.from(UNI_WEIGHT).mul(1000000));
      await COMP.connect(addr1).approve(basket.address, ethers.BigNumber.from(COMP_WEIGHT).mul(1000000));
      await AAVE.connect(addr1).approve(basket.address, ethers.BigNumber.from(AAVE_WEIGHT).mul(1000000));

      let tx = basket.connect(addr1).mint(ethers.BigNumber.from(COMP_WEIGHT).mul(99999))
      let secondTimestamp = await getTimestamp(tx);

      await expect(await basket.balanceOf(addr1.address)).to.equal(ethers.BigNumber.from(COMP_WEIGHT).mul(100000));
      
      let expectedBalance = ((secondTimestamp + 1 - mintTimestamp) / (ONE_YEAR) * 0.01) * Math.pow(10,18);

      let pubBalance = await basket.balanceOf(addr2.address);

      expect(expectedBalance / pubBalance.toNumber()).to.be.gt(0.9999); // todo: rounding

      await factory.connect(owner).setOwnerSplit('100000000000000000');

      tx = basket.connect(addr1).mint(ethers.BigNumber.from(COMP_WEIGHT).mul(100000))
      let thirdTimestamp = await getTimestamp(tx);

      await expect(await basket.balanceOf(addr1.address)).to.equal(ethers.BigNumber.from(COMP_WEIGHT).mul(200000));
      
      expectedBalance = ((thirdTimestamp - secondTimestamp) / (ONE_YEAR) * 0.009 * 100000) * Math.pow(10,18);

      expectedBalance = expectedBalance + Number(pubBalance);

      pubBalance = await basket.balanceOf(addr2.address);

      expect(expectedBalance / pubBalance.toNumber()).to.be.gt(0.9999);  // todo: rounding

      let expectedOwnerBalance = ((thirdTimestamp - secondTimestamp) / (ONE_YEAR) * 0.001 * 100000) * Math.pow(10,18);

      let ownerBalance = await basket.balanceOf(owner.address);

      expect(expectedOwnerBalance / ownerBalance.toNumber()).to.be.gt(0.9999);  // todo: rounding
    });
});
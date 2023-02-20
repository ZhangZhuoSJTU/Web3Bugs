const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const UNI_WEIGHT = '5000000000000000000';
const COMP_WEIGHT = '1000000000000000000';
const AAVE_WEIGHT = '1000000000000000000';

const fee = `${Math.pow(10,16)}`;
const tokenName = "UCA";
const tokenSymbol = "UCA";

let owner, addr1, addr2;
let factory, UNI, COMP, AAVE, basket, AuctionImpl, BasketImpl;

async function mineBlocks(blockNumber) {
    while (blockNumber > 0) {
      blockNumber--;
      await hre.network.provider.request({
        method: "evm_mine",
        params: [],
      });
    }
}

describe("Auction", function () {
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

        await UNI.mint(UNI_WEIGHT);
        await COMP.mint(COMP_WEIGHT);
        await AAVE.mint(AAVE_WEIGHT);

        await factory.proposeBasketLicense(fee, 
            tokenName, 
            tokenSymbol, 
            [UNI.address, COMP.address, AAVE.address], 
            [UNI_WEIGHT, COMP_WEIGHT, AAVE_WEIGHT]);

        
        await UNI.approve(factory.address, `${UNI_WEIGHT}`);
        await COMP.approve(factory.address, `${COMP_WEIGHT}`);
        await AAVE.approve(factory.address, `${AAVE_WEIGHT}`);

        await factory.createBasket(0);
        let proposal = await factory.proposal(0);
        basket = BasketImpl.attach(proposal.basket);
      });
      it("should allow bonding by one user when there is an auction ongoing", async () => {
        let NEW_UNI_WEIGHT = "2400000000000000000";
        let NEW_COMP_WEIGHT = "2000000000000000000";
        let NEW_AAVE_WEIGHT = "400000000000000000";

        await expect(basket.publishNewIndex([UNI.address, COMP.address, AAVE.address], 
            [NEW_UNI_WEIGHT, NEW_COMP_WEIGHT, NEW_AAVE_WEIGHT])).to.be.ok;
        await mineBlocks(4 * 60 * 24);
        await expect(basket.publishNewIndex([],[])).to.be.ok;

        let auctionAddr = await basket.auction();
        let auction = AuctionImpl.attach(auctionAddr);

        await basket.approve(auction.address, '5000000000000000');

        await expect(auction.bondForRebalance()).to.be.ok;

        let auctionBalance = await basket.balanceOf(auction.address);
        expect(auctionBalance).to.equal('2500000000000000');

        await expect(auction.bondForRebalance()).to.be.reverted;
      });
      it("should allow burning the bond if an auction hasn't been settled in 24 hours", async () => {
        let NEW_UNI_WEIGHT = "2400000000000000000";
        let NEW_COMP_WEIGHT = "2000000000000000000";
        let NEW_AAVE_WEIGHT = "400000000000000000";

        await expect(basket.publishNewIndex([UNI.address, COMP.address, AAVE.address], 
            [NEW_UNI_WEIGHT, NEW_COMP_WEIGHT, NEW_AAVE_WEIGHT])).to.be.ok;
        await mineBlocks(4 * 60 * 24);
        await expect(basket.publishNewIndex([],[])).to.be.ok;

        let auctionAddr = await basket.auction();
        let auction = AuctionImpl.attach(auctionAddr);

        await basket.approve(auction.address, '5000000000000000');

        await expect(auction.bondForRebalance()).to.be.ok;

        let auctionBalance = await basket.balanceOf(auction.address);
        expect(auctionBalance).to.equal('2500000000000000');

        await expect(auction.bondBurn()).to.be.reverted;

        await mineBlocks(4 * 60 * 24 - 4);
        await expect(auction.bondBurn()).to.be.reverted;        
        await mineBlocks(1);

        await expect(auction.bondBurn()).to.be.ok;      
      });
      it("should allow settling an auction by the auction bonder", async () => {
        let NEW_UNI_WEIGHT = "2400000000000000000";
        let NEW_COMP_WEIGHT = "2000000000000000000";
        let NEW_AAVE_WEIGHT = "400000000000000000";

        await expect(basket.publishNewIndex([UNI.address, COMP.address, AAVE.address], 
            [NEW_UNI_WEIGHT, NEW_COMP_WEIGHT, NEW_AAVE_WEIGHT])).to.be.ok;
        await mineBlocks(10030);
        await expect(basket.publishNewIndex([],[])).to.be.ok;

        let auctionAddr = await basket.auction();
        let auction = AuctionImpl.attach(auctionAddr);

        await basket.approve(auction.address, '5000000000000000');

        await expect(auction.bondForRebalance()).to.be.ok;

        await mineBlocks(5000);

        await UNI.mint("100000000000000000000");
        await COMP.mint("100000000000000000000");
        await AAVE.mint("100000000000000000000");

        await UNI.approve(auction.address, `100000000000000000000`);
        await COMP.approve(auction.address, `100000000000000000000`);
        await AAVE.approve(auction.address, `100000000000000000000`);

        await expect(auction.settleAuction([], [COMP.address], ["2999400000000000000"], [UNI.address, AAVE.address], ["200720000000000000", "200120000000000000"])).to.be.ok;
      });
});
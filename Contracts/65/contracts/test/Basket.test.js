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
const max = `10000000000000000000000`

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
            [UNI_WEIGHT, COMP_WEIGHT, AAVE_WEIGHT],
            max);

        
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
});
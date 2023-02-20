const { expect } = require("chai");
const { ethers } = require("hardhat");

const UNI = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984';
const COMP = '0xc00e94Cb662C3520282E6f5717214004A7f26888';
const AAVE = '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const UNI_WEIGHT = '5000000000000000000';
const COMP_WEIGHT = '1000000000000000000';
const AAVE_WEIGHT = '1000000000000000000';

const fee = `${Math.pow(10,16)}`;
const tokenName = "UCA";
const tokenSymbol = "UCA";

let owner, addr1;
let factory, BasketImpl;
describe("Factory", function () {
  beforeEach(async () => {
    [owner, addr1] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("Factory");
    const AuctionImpl = await ethers.getContractFactory("Auction");
    const auctionImpl = await AuctionImpl.deploy();
    BasketImpl = await ethers.getContractFactory("Basket");
    const basketImpl = await BasketImpl.deploy();

    factory = await Factory.deploy(auctionImpl.address, basketImpl.address);
    await factory.deployed();
  })
  it("Should add a valid proposal", async () =>  {
    await factory.proposeBasketLicense(
      fee,
      tokenName,
      tokenSymbol,
      [UNI, COMP, AAVE],
      [UNI_WEIGHT, COMP_WEIGHT, AAVE_WEIGHT]
    );

    let proposal = await factory.getProposalWeights(0);
    expect(proposal[0][0]).to.equal(UNI);
    expect(proposal[0][1]).to.equal(COMP);
    expect(proposal[0][2]).to.equal(AAVE);

    expect(proposal[1][0].toString()).to.equal(UNI_WEIGHT);
    expect(proposal[1][1].toString()).to.equal(COMP_WEIGHT);
    expect(proposal[1][2].toString()).to.equal(AAVE_WEIGHT);
  });
  it("Should Revert on Duplicate Tokens", async () => {
    await expect(factory.proposeBasketLicense(fee, 
      tokenName, 
      tokenSymbol, 
      [UNI, UNI, AAVE], 
      [UNI_WEIGHT, COMP_WEIGHT, AAVE_WEIGHT])).to.be.reverted
  });
  it("Should Revert on < minLicenseFee", async () => {
    await expect(factory.proposeBasketLicense('0', 
      tokenName, 
      tokenSymbol, 
      [UNI, COMP, AAVE], 
      [UNI_WEIGHT, COMP_WEIGHT, AAVE_WEIGHT])).to.be.reverted
  });
  it("Should Revert on zero values", async () => {
    await expect(factory.proposeBasketLicense(fee, 
      tokenName, 
      tokenSymbol, 
      [ZERO_ADDRESS, COMP, AAVE], 
      [UNI_WEIGHT, COMP_WEIGHT, AAVE_WEIGHT])).to.be.reverted
    await expect(factory.proposeBasketLicense(fee, 
      tokenName, 
      tokenSymbol, 
      [UNI, COMP, AAVE], 
      ['0', COMP_WEIGHT, AAVE_WEIGHT])).to.be.reverted
  });
  it("Should Revert on mismatched Arrays", async () => {
    await expect(factory.proposeBasketLicense(fee, 
      tokenName, 
      tokenSymbol, 
      [UNI, COMP, AAVE], 
      [UNI_WEIGHT, COMP_WEIGHT])).to.be.reverted
  });
  it("Should create a valid basket and mint 1 Basket token to sender", async () => {
    const TestToken = await ethers.getContractFactory("TestToken");
    testToken1 = await TestToken.deploy('TEST', 'TEST');
    await testToken1.deployed();

    testToken2 = await TestToken.deploy('TEST2', 'TEST2');
    await testToken2.deployed();

    testToken3 = await TestToken.deploy('TEST3', 'TEST3');
    await testToken3.deployed();

    await testToken1.mint(`${10**20}`);
    await testToken2.mint(`${10**20}`);
    await testToken3.mint(`${10**20}`);

    await factory.proposeBasketLicense(fee, 
      tokenName, 
      tokenSymbol, 
      [testToken1.address, testToken2.address, testToken3.address], 
      [UNI_WEIGHT, COMP_WEIGHT, AAVE_WEIGHT])

    await testToken1.approve(factory.address, `${10**19}`);
    await testToken2.approve(factory.address, `${10**19}`);
    await testToken3.approve(factory.address, `${10**19}`);

    let proposal = await factory.proposal(0);
    expect(proposal.basket).to.equal(ZERO_ADDRESS);

    await factory.createBasket(0);
    
    proposal = await factory.proposal(0);
    expect(proposal.basket).to.not.equal(ZERO_ADDRESS);

    await expect(factory.createBasket(0)).to.be.reverted

    let token1Balance = await testToken1.balanceOf(owner.address);
    let token2Balance = await testToken2.balanceOf(owner.address);
    let token3Balance = await testToken3.balanceOf(owner.address);

    expect(token1Balance.toString()).to.equal("95000000000000000000")
    expect(token2Balance.toString()).to.equal("99000000000000000000")
    expect(token3Balance.toString()).to.equal("99000000000000000000")

    const auctionImpl = await factory.auctionImpl();
    const basketImpl = await factory.basketImpl();

    token1Balance = await testToken1.balanceOf(proposal.basket);
    token2Balance = await testToken2.balanceOf(proposal.basket);
    token3Balance = await testToken3.balanceOf(proposal.basket);

    expect(token1Balance.toString()).to.equal("5000000000000000000")
    expect(token2Balance.toString()).to.equal("1000000000000000000")
    expect(token3Balance.toString()).to.equal("1000000000000000000")

    let basket = BasketImpl.attach(proposal.basket);
    basketBalance = await basket.balanceOf(owner.address);
    expect(basketBalance).to.equal("1000000000000000000");
  });
  it("Should fail basket creation if creator doesn't have enough tokens or not approved", async () => {
    const TestToken = await ethers.getContractFactory("TestToken");
    testToken1 = await TestToken.deploy('TEST', 'TEST');
    await testToken1.deployed();

    testToken2 = await TestToken.deploy('TEST2', 'TEST2');
    await testToken2.deployed();

    testToken3 = await TestToken.deploy('TEST3', 'TEST3');
    await testToken3.deployed();

    await testToken1.mint(`${10**20}`);
    await testToken2.mint(`${10**20}`);

    await testToken1.approve(factory.address, `${10**19}`);
    await testToken2.approve(factory.address, `${10**19}`);

    await factory.proposeBasketLicense(fee, 
      tokenName, 
      tokenSymbol, 
      [testToken1.address, testToken2.address, testToken3.address], 
      [UNI_WEIGHT, COMP_WEIGHT, AAVE_WEIGHT])

    await expect(factory.createBasket(0)).to.be.reverted

    await testToken3.mint(`${10**20}`);

    await expect(factory.createBasket(0)).to.be.reverted

    await testToken3.approve(factory.address, `${10**19}`);

    await expect(factory.createBasket(0)).to.be.ok;

  });
});
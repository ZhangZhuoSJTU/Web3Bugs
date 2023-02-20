const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");

describe("ExchangeFactory", () => {
  let exchangeFactory;
  let baseToken;
  let quoteToken;
  let accounts;
  let deployer;

  const name = "Quote Base Pair";
  const symbol = "QvB";

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    [, , , , deployer] = accounts;
    await deployments.fixture();
    const ExchangeFactory = await deployments.get("ExchangeFactory");
    exchangeFactory = new ethers.Contract(
      ExchangeFactory.address,
      ExchangeFactory.abi,
      accounts[0]
    );

    const BaseToken = await deployments.get("BaseToken");
    baseToken = new ethers.Contract(
      BaseToken.address,
      BaseToken.abi,
      accounts[0]
    );

    const QuoteToken = await deployments.get("QuoteToken");
    quoteToken = new ethers.Contract(
      QuoteToken.address,
      QuoteToken.abi,
      accounts[0]
    );
  });

  describe("constructor", () => {
    it("Should set the fee address when deployed", async () => {
      expect(await exchangeFactory.feeAddress()).to.equal(accounts[5].address);
    });

    it("Should revert when the fee address is the zero address", async () => {
      const mathLib = await deployments.get("MathLib");
      await expect(
        deployments.deploy("ExchangeFactory", {
          from: accounts[0].address,
          args: [ethers.constants.AddressZero],
          libraries: {
            MathLib: mathLib.address,
          },
        })
      ).to.be.revertedWith("ExchangeFactory: INVALID_ADDRESS");
    });
  });

  describe("createNewExchange", () => {
    it("Should deploy a new exchange and add to mappings", async () => {
      await exchangeFactory
        .connect(deployer)
        .createNewExchange(name, symbol, baseToken.address, quoteToken.address);
      const exchangeAddress =
        await exchangeFactory.exchangeAddressByTokenAddress(
          baseToken.address,
          quoteToken.address
        );
      expect(
        await exchangeFactory.isValidExchangeAddress(exchangeAddress)
      ).to.equal(true);
    });

    it("Should deploy a new exchange with correct name, symbol and addresses", async () => {
      await exchangeFactory
        .connect(deployer)
        .createNewExchange(name, symbol, baseToken.address, quoteToken.address);
      const exchangeAddress =
        await exchangeFactory.exchangeAddressByTokenAddress(
          baseToken.address,
          quoteToken.address
        );

      const Exchange = await deployments.get("EGT Exchange");
      const exchange = new ethers.Contract(
        exchangeAddress,
        Exchange.abi,
        deployer
      );

      expect(await exchange.name()).to.equal(name);
      expect(await exchange.symbol()).to.equal(symbol);
      expect(await exchange.quoteToken()).to.equal(quoteToken.address);
      expect(await exchange.baseToken()).to.equal(baseToken.address);
    });

    it("Should deploy a new exchange and emit the correct ExchangeAdded event", async () => {
      expect(
        await exchangeFactory
          .connect(deployer)
          .createNewExchange(
            name,
            symbol,
            baseToken.address,
            quoteToken.address
          )
      ).to.emit(exchangeFactory, "NewExchange");
    });

    it("Should revert when the same token pair is attempted to be added twice", async () => {
      await exchangeFactory
        .connect(deployer)
        .createNewExchange(name, symbol, baseToken.address, quoteToken.address);
      await expect(
        exchangeFactory
          .connect(deployer)
          .createNewExchange(
            name,
            symbol,
            baseToken.address,
            quoteToken.address
          )
      ).to.be.revertedWith("ExchangeFactory: DUPLICATE_EXCHANGE");
    });

    it("Should revert when the same token is attempted to be used for both quote and base", async () => {
      await expect(
        exchangeFactory
          .connect(deployer)
          .createNewExchange(name, symbol, baseToken.address, baseToken.address)
      ).to.be.revertedWith("ExchangeFactory: IDENTICAL_TOKENS");
    });

    it("Should revert when either token address is a null address", async () => {
      await expect(
        exchangeFactory
          .connect(deployer)
          .createNewExchange(
            name,
            symbol,
            baseToken.address,
            ethers.constants.AddressZero
          )
      ).to.be.revertedWith("ExchangeFactory: INVALID_TOKEN_ADDRESS");

      await expect(
        exchangeFactory
          .connect(deployer)
          .createNewExchange(
            name,
            symbol,
            ethers.constants.AddressZero,
            quoteToken.address
          )
      ).to.be.revertedWith("ExchangeFactory: INVALID_TOKEN_ADDRESS");
    });

    it("Should revert when a non owner attempts to change the fee address", async () => {
      const newFeeAddress = accounts[8].address;
      await expect(
        exchangeFactory.connect(accounts[1]).setFeeAddress(newFeeAddress)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("setFeeAddress", () => {
    it("Should allow the fee address to be changed by the owner", async () => {
      const newFeeAddress = accounts[8].address;
      await exchangeFactory.setFeeAddress(newFeeAddress);
      expect(await exchangeFactory.feeAddress()).to.equal(newFeeAddress);
    });

    it("Should emit SetFeeAddress", async () => {
      const newFeeAddress = accounts[8].address;
      await expect(exchangeFactory.setFeeAddress(newFeeAddress))
        .to.emit(exchangeFactory, "SetFeeAddress")
        .withArgs(newFeeAddress);
    });

    it("Should revert when the fee a owner attempts to change the fee address", async () => {
      const newFeeAddress = accounts[8].address;
      await expect(
        exchangeFactory.connect(accounts[1]).setFeeAddress(newFeeAddress)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert when the owner attempts to change the fee address to the zero address", async () => {
      await expect(
        exchangeFactory.setFeeAddress(ethers.constants.AddressZero)
      ).to.be.revertedWith("ExchangeFactory: INVAlID_FEE_ADDRESS");
    });

    it("Should revert when the owner attempts to change the fee address to the same address", async () => {
      await expect(
        exchangeFactory.setFeeAddress(await exchangeFactory.feeAddress())
      ).to.be.revertedWith("ExchangeFactory: INVAlID_FEE_ADDRESS");
    });
  });
});

// @ts-nocheck
import { ethers } from "hardhat";
import { getBigNumber } from "./utilities";
import { expect } from "chai";
import { ERC20Mock } from "../typechain/ERC20Mock";
import { BentoBoxV1 } from "../typechain/BentoBoxV1";
import { ConcentratedLiquidityPool } from "../typechain/ConcentratedLiquidityPool";
import { ConcentratedLiquidityPoolFactory } from "../typechain/ConcentratedLiquidityPoolFactory";
import { ConcentratedLiquidityPoolHelper } from "../typechain/ConcentratedLiquidityPoolHelper";
import { BigNumber } from "ethers";

// wip - will be refactored away

describe.skip("Concentrated liquidity pool", function () {
  let alice: ethers.Signer,
    feeTo: ethers.Signer,
    weth: ERC20Mock,
    dai: ERC20Mock,
    usd: ERC20Mock,
    tridentPoolFactory: ConcentratedLiquidityPoolFactory,
    pool0: ConcentratedLiquidityPool,
    pool1: ConcentratedLiquidityPool,
    tickMath: TickMathTest,
    bento: BentoBoxV1,
    poolHelper: ConcentratedLiquidityPoolHelper;

  const totalSupply = getBigNumber("100000000");
  const priceMultiplier = BigNumber.from("0x1000000000000000000000000");

  before(async function () {
    [alice, feeTo] = await ethers.getSigners();

    const ERC20 = await ethers.getContractFactory("ERC20Mock");
    const Pool = await ethers.getContractFactory("ConcentratedLiquidityPool");
    const PoolHelper = await ethers.getContractFactory("ConcentratedLiquidityPoolHelper");
    const Bento = await ethers.getContractFactory("BentoBoxV1");
    const MasterDeployer = await ethers.getContractFactory("MasterDeployer");
    const PoolFactory = await ethers.getContractFactory("ConcentratedLiquidityPoolFactory");
    const TickMathTest = await ethers.getContractFactory("TickMathTest");
    weth = await ERC20.deploy("", "", totalSupply);
    dai = await ERC20.deploy("", "", totalSupply);
    usd = await ERC20.deploy("", "", totalSupply);
    if (dai.address.toUpperCase() > weth.address.toUpperCase()) {
      let tmp = { ...weth };
      weth = { ...dai };
      dai = tmp;
    }
    if (weth.address.toUpperCase() > usd.address.toUpperCase()) {
      let tmp = { ...weth };
      weth = { ...usd };
      usd = tmp;
    }
    if (dai.address.toUpperCase() > weth.address.toUpperCase()) {
      let tmp = { ...weth };
      weth = { ...dai };
      dai = tmp;
    }
    // lets require dai < weth to match what is on chain
    // and weth < usd so the prices make sense (token0/token1)
    tickMath = await TickMathTest.deploy();
    bento = await Bento.deploy(weth.address);
    poolHelper = await PoolHelper.deploy();
    await weth.approve(bento.address, totalSupply);
    await dai.approve(bento.address, totalSupply);
    await usd.approve(bento.address, totalSupply);
    const masterDeployer = await MasterDeployer.deploy(
      5, // 5 bps
      feeTo.address,
      bento.address
    );

    tridentPoolFactory = await PoolFactory.deploy(masterDeployer.address);
    await tridentPoolFactory.deployed();

    await bento.deposit(weth.address, alice.address, alice.address, totalSupply, 0);

    await bento.deposit(usd.address, alice.address, alice.address, totalSupply, 0);

    await bento.deposit(dai.address, alice.address, alice.address, totalSupply, 0);

    // whitelist pool factory in master deployer
    await masterDeployer.addToWhitelist(tridentPoolFactory.address);

    // divided by 2**96 equals 0.02280974803
    // squared and inverted this is 1922.02 (price of eth in dai)
    // corresponds to tick -75616
    let sqrtPrice = BigNumber.from("1807174424252647735792984898");

    let deployData0 = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint24", "uint160", "uint24"],
      [dai.address, weth.address, 1000, sqrtPrice, 10]
    );

    // deploy pool0
    pool0 = await Pool.attach((await (await masterDeployer.deployPool(tridentPoolFactory.address, deployData0)).wait()).events[0].args[1]);

    // current eth price is $2500
    sqrtPrice = BigNumber.from("50").mul("0x1000000000000000000000000");

    let deployData1 = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint24", "uint160", "int24"],
      [weth.address, usd.address, 1000, sqrtPrice, 10]
    );

    // deploy pool1
    pool1 = await Pool.attach((await (await masterDeployer.deployPool(tridentPoolFactory.address, deployData1)).wait()).events[0].args[1]);

    // Current price is 2500, we are gonna mint liquidity on intervals ~ [1600, 3600] and ~ [2600, 3000]
    const lowerTick1 = 73780; // price 1599
    const lowerTick1Price = await tickMath.getSqrtRatioAtTick(lowerTick1);
    const upperTick1 = 81891; // price 3600
    const upperTick1Price = await tickMath.getSqrtRatioAtTick(upperTick1);
    const currentTick = 78244; // price 2500
    const currentTickPrice = await pool1.price();
    const lowerTick2 = 78640; // price 2601
    const lowerTick2Price = await tickMath.getSqrtRatioAtTick(lowerTick2);
    const upperTick2 = 80149; // price ~3025
    const upperTick2Price = await tickMath.getSqrtRatioAtTick(upperTick2);

    // mint liquidity with 4k usd and x amount of eth
    // liquidity amount can be arbitrary for this test
    const liquidity = getBigNumber("4000").mul(priceMultiplier).div(currentTickPrice.sub(lowerTick1Price));

    await bento.transfer(weth.address, alice.address, pool1.address, getDx(liquidity, currentTickPrice, upperTick1Price));

    await bento.transfer(usd.address, alice.address, pool1.address, getDy(liquidity, lowerTick1Price, currentTickPrice));

    let mintData = ethers.utils.defaultAbiCoder.encode(
      ["int24", "int24", "int24", "int24", "uint128", "address"],
      [-887272, lowerTick1, lowerTick1, upperTick1, liquidity, alice.address]
    );

    await pool1.mint(mintData);

    await bento.transfer(weth.address, alice.address, pool1.address, getDx(liquidity, lowerTick2Price, upperTick2Price));

    mintData = ethers.utils.defaultAbiCoder.encode(
      ["int24", "int24", "int24", "int24", "uint128", "address"],
      [lowerTick1, lowerTick2, lowerTick2, upperTick2, liquidity, alice.address]
    );

    await pool1.mint(mintData);
  });

  describe("pool #0", async () => {
    it("should initialize correctly", async () => {
      const min = -887272;
      const max = -min - 1;

      const minTick = await pool0.ticks(min);
      const maxTick = await pool0.ticks(max);

      expect(minTick.previousTick).to.be.eq(min);
      expect(minTick.nextTick).to.be.eq(max);
      expect(maxTick.previousTick).to.be.eq(min);
      expect(maxTick.nextTick).to.be.eq(max);
      expect(await pool0.token0()).to.be.eq(dai.address);
      expect(await pool0.liquidity()).to.be.eq(0);
    });

    it("should add liquidity inside price range", async () => {
      // current price is 1920 dai per eth ... mint liquidity from ~1000 to ~3000
      const lower = -80068; // 0.000333 dai per eth
      const upper = -69081; // 0.001 dai per eth
      const priceLower = await tickMath.getSqrtRatioAtTick(lower);
      const priceUpper = await tickMath.getSqrtRatioAtTick(upper);
      const currentPrice = await pool0.price();
      const startingLiquidity = await pool0.liquidity();

      const dP = currentPrice.sub(priceLower);

      const dy = getBigNumber(1);

      // calculate the amount of liq we mint based on dy and ticks
      const liquidity = dy.mul("0x1000000000000000000000000").div(dP);

      const dx = getDx(liquidity, currentPrice, priceUpper);

      await bento.transfer(dai.address, alice.address, pool0.address, dx);

      await bento.transfer(weth.address, alice.address, pool0.address, dy);

      let mintData = ethers.utils.defaultAbiCoder.encode(
        ["int24", "int24", "int24", "int24", "uint128", "address"],
        [-887272, lower, lower, upper, liquidity, alice.address]
      );

      await pool0.mint(mintData);

      expect((await pool0.liquidity()).toString()).to.be.eq(
        liquidity.add(startingLiquidity).toString(),
        "Didn't add right amount of liquidity"
      );
      expect((await bento.balanceOf(dai.address, pool0.address)).toString()).to.be.eq(
        "2683758334569795392629",
        "Didn't calculate token0 (dx) amount correctly"
      );
      expect(await pool0.reserve0()).to.be.eq(dx);
      expect(await pool0.reserve1()).to.be.eq(dy);
      expect((await bento.balanceOf(weth.address, pool0.address)).toString()).to.be.eq(
        dy.toString(),
        "Didn't calculate token1 (dy) amount correctly"
      );
      // console.log(await poolHelper.getTickState(pool0.address, 10));
    });

    it("shouldn't allow adding lower odd ticks", async () => {
      const lower = -80068 + 1;
      const upper = -69081;
      const priceLower = await tickMath.getSqrtRatioAtTick(lower);
      const priceUpper = await tickMath.getSqrtRatioAtTick(upper);
      const currentPrice = await pool0.price();
      const startingLiquidity = await pool0.liquidity();

      const dP = currentPrice.sub(priceLower);

      const dy = getBigNumber(1);
      // calculate the amount of liq we mint based on dy and ticks
      const liquidity = dy.mul("0x1000000000000000000000000").div(dP);

      const dx = getDx(liquidity, currentPrice, priceUpper);

      await bento.transfer(dai.address, alice.address, pool0.address, dx);

      await bento.transfer(weth.address, alice.address, pool0.address, dy);

      let mintData = ethers.utils.defaultAbiCoder.encode(
        ["int24", "int24", "int24", "int24", "uint128", "address"],
        [-887272, lower, lower, upper, liquidity, alice.address]
      );

      await expect(pool0.mint(mintData)).to.be.revertedWith("LOWER_EVEN");
    });

    it("shouldn't allow adding upper even ticks", async () => {
      const lower = -80068;
      const upper = -69081 - 1;
      const priceLower = await tickMath.getSqrtRatioAtTick(lower);
      const priceUpper = await tickMath.getSqrtRatioAtTick(upper);
      const currentPrice = await pool0.price();
      const startingLiquidity = await pool0.liquidity();

      const dP = currentPrice.sub(priceLower);

      const dy = getBigNumber(1);
      // calculate the amount of liq we mint based on dy and ticks
      const liquidity = dy.mul("0x1000000000000000000000000").div(dP);

      const dx = getDx(liquidity, currentPrice, priceUpper);

      await bento.transfer(dai.address, alice.address, pool0.address, dx);

      await bento.transfer(weth.address, alice.address, pool0.address, dy);

      let mintData = ethers.utils.defaultAbiCoder.encode(
        ["int24", "int24", "int24", "int24", "uint128", "address"],
        [-887272, lower, lower, upper, liquidity, alice.address]
      );

      await expect(pool0.mint(mintData)).to.be.revertedWith("UPPER_ODD");
    });

    it("shouldn't allow adding ticks outside of min bounds", async () => {
      const lower = -887272 - 1; // exceed MIN_TICK
      const upper = -lower - 1;

      let mintData = ethers.utils.defaultAbiCoder.encode(
        ["int24", "int24", "int24", "int24", "uint128", "address"],
        [-887272, lower, lower, upper, getBigNumber(10), alice.address]
      );

      await expect(pool0.mint(mintData)).to.be.revertedWith("T");
    });

    it("shouldn't allow adding ticks outside of max bounds", async () => {
      const lower = -887272;
      const upper = -lower; // exceed MAX_TICK

      let mintData = ethers.utils.defaultAbiCoder.encode(
        ["int24", "int24", "int24", "int24", "uint128", "address"],
        [-887272, lower, lower, upper, getBigNumber(10), alice.address]
      );

      await expect(pool0.mint(mintData)).to.be.revertedWith("T");
    });

    // iterate through the tichs and double check that liquidity is correct
    it("Minted liquidity ticks in the right order");

    // check that the existing ticks & liquidity make sense
    it("Should swap and accredit the fee to the (sole) LP", async () => {
      const dx = getBigNumber(50);
      await bento.transfer(dai.address, alice.address, pool0.address, dx);
      const swapData = ethers.utils.defaultAbiCoder.encode(
        ["bool", "uint256", "address", "bool"],
        [true, getBigNumber(50), alice.address, false]
      );

      const output = await (await pool0.swap(swapData)).wait();
      const data = output.logs[1].data;
      const _in = BigNumber.from(data.substring(0, 66));
      // const _out = BigNumber.from("0x" + data.substring(66, 130));
      expect(_in).to.be.eq(dx);
      const lower = -80068;
      const upper = -69081;
      const burnData = ethers.utils.defaultAbiCoder.encode(
        ["int24", "int24", "uint128", "address", "bool"],
        [lower, upper, "0", alice.address, false]
      );
      const oldBalance = await bento.balanceOf(weth.address, alice.address);
      await pool0.burn(burnData);
      const newBalance = await bento.balanceOf(weth.address, alice.address);
      await pool0.burn(burnData);
      const newerBalance = await bento.balanceOf(weth.address, alice.address);
      expect(newBalance.sub(oldBalance).gt(0));
      expect(newBalance.eq(newerBalance));
    });
  });

  describe("pool #1", async () => {
    it("should swap with 0 input and make no state changes", async () => {
      const oldLiq = await pool1.liquidity();
      const oldTick = await pool1.nearestTick();
      const oldEthBalance = await bento.balanceOf(weth.address, alice.address);
      const oldUSDBalance = await bento.balanceOf(usd.address, alice.address);

      expect(oldLiq.gt(0)).to.be.true;

      const oldPrice = await pool1.price();

      let swapData = ethers.utils.defaultAbiCoder.encode(["bool", "uint256", "address", "bool"], [false, 0, alice.address, false]);

      await pool1.swap(swapData);

      const newPrice = await pool1.price();
      const newLiq = await pool1.liquidity();
      const newTick = await pool1.nearestTick();
      const ethReceived = (await bento.balanceOf(weth.address, alice.address)).sub(oldEthBalance);
      const usdPaid = oldUSDBalance.sub(await bento.balanceOf(usd.address, alice.address));

      expect(oldLiq).to.be.eq(newLiq, "Liquidity changed from 0 input");
      expect(oldTick).to.be.eq(newTick, "Tick changed from 0 input");
      expect(usdPaid).to.be.eq(0, "Token paid changed from 0 input");
      expect(ethReceived).to.be.eq(0, "Token paid changed from 0 input");
      expect(oldPrice).to.be.eq(newPrice, "Price changed from 0 input");
    });

    it("Should execute trade within current tick - one for zero", async () => {
      const oldLiq = await pool1.liquidity();
      const oldTick = await pool1.nearestTick();
      const oldEthBalance = await bento.balanceOf(weth.address, alice.address);
      const oldUSDBalance = await bento.balanceOf(usd.address, alice.address);

      expect(oldLiq.gt(0)).to.be.true;

      const oldPrice = await pool1.price();

      // buy eth with 50 usd (one for zero, one is USD)
      await bento.transfer(usd.address, alice.address, pool1.address, getBigNumber(50));
      let swapData = ethers.utils.defaultAbiCoder.encode(
        ["bool", "uint256", "address", "bool"],
        [false, getBigNumber(50), alice.address, false]
      );

      await pool1.swap(swapData);

      const newPrice = await pool1.price();
      const newTick = await pool1.nearestTick();
      const ethReceived = (await bento.balanceOf(weth.address, alice.address)).sub(oldEthBalance);
      const usdPaid = oldUSDBalance.sub(await bento.balanceOf(usd.address, alice.address));
      const tradePrice = parseInt(usdPaid.mul(100000).div(ethReceived)) / 100000;
      const tradePriceSqrtX96 = getSqrtX96Price(tradePrice);

      expect(usdPaid.toString()).to.be.eq(getBigNumber(50).toString(), "Didn't take the right usd amount");
      expect(ethReceived.gt(0)).to.be.eq(true, "We didn't receive an eth");
      expect(oldPrice.lt(tradePriceSqrtX96)).to.be.eq(true, "Trade price isn't higher than starting price");
      expect(newPrice.gt(tradePriceSqrtX96)).to.be.eq(true, "Trade price isn't lower than new price");
      expect(oldPrice.lt(newPrice)).to.be.eq(true, "Price didn't increase");
      expect(oldTick).to.be.eq(newTick, "We crossed by mistake");
    });

    it("should execute trade within current tick - zero for one", async () => {
      const oldLiq = await pool1.liquidity();
      const oldTick = await pool1.nearestTick();
      const oldEthBalance = await bento.balanceOf(weth.address, alice.address);
      const oldUSDBalance = await bento.balanceOf(usd.address, alice.address);

      expect(oldLiq.gt(0)).to.be.true;

      const oldPrice = await pool1.price();

      // buy usd with 0.1 eth
      await bento.transfer(weth.address, alice.address, pool1.address, getBigNumber(1, 17));
      let swapData = ethers.utils.defaultAbiCoder.encode(
        ["bool", "uint256", "address", "bool"],
        [true, getBigNumber(1, 17), alice.address, false]
      );
      await pool1.swap(swapData);

      const newPrice = await pool1.price();
      const newTick = await pool1.nearestTick();
      const usdReceived = (await bento.balanceOf(usd.address, alice.address)).sub(oldUSDBalance);
      const ethPaid = oldEthBalance.sub(await bento.balanceOf(weth.address, alice.address));
      const tradePrice = parseInt(usdReceived.mul(100000).div(ethPaid)) / 100000;
      const tradePriceSqrtX96 = getSqrtX96Price(tradePrice);

      expect(ethPaid.eq(getBigNumber(1).div(10))).to.be.true;
      expect(usdReceived.gt(0)).to.be.true;
      expect(oldPrice.gt(tradePriceSqrtX96)).to.be.true;
      expect(newPrice.lt(tradePriceSqrtX96)).to.be.true;
      expect(oldTick).to.be.eq(newTick, "We crossed by mistake");
      expect(oldPrice.gt(newPrice)).to.be.true;
    });

    it("should execute trade and cross one tick - one for zero", async () => {
      const oldLiq = await pool1.liquidity();
      const oldTick = await pool1.nearestTick();
      const nextTick = (await pool1.ticks(oldTick)).nextTick;
      const oldEthBalance = await bento.balanceOf(weth.address, alice.address);
      const oldUSDBalance = await bento.balanceOf(usd.address, alice.address);

      expect(oldLiq.gt(0)).to.be.true;

      const oldPrice = await pool1.price();

      // buy eth with 1000 usd (one for zero, one is USD)
      await bento.transfer(usd.address, alice.address, pool1.address, getBigNumber(1000));
      let swapData = ethers.utils.defaultAbiCoder.encode(
        ["bool", "uint256", "address", "bool"],
        [false, getBigNumber(1000), alice.address, false]
      );
      await pool1.swap(swapData);

      const newLiq = await pool1.liquidity();
      const newPrice = await pool1.price();
      const newTick = await pool1.nearestTick();
      const ethReceived = (await bento.balanceOf(weth.address, alice.address)).sub(oldEthBalance);
      const usdPaid = oldUSDBalance.sub(await bento.balanceOf(usd.address, alice.address));
      const tradePrice = parseInt(usdPaid.mul(100000).div(ethReceived)) / 100000;
      const tradePriceSqrtX96 = getSqrtX96Price(tradePrice);

      expect(usdPaid.toString()).to.be.eq(getBigNumber(1000).toString(), "Didn't take the right usd amount");
      expect(ethReceived.gt(0)).to.be.eq(true, "Didn't receive any eth");
      expect(oldLiq.lt(newLiq)).to.be.eq(true, "We didn't cross into a more liquid range");
      expect(oldPrice.lt(tradePriceSqrtX96)).to.be.eq(true, "Trade price isn't higher than starting price");
      expect(newPrice.gt(tradePriceSqrtX96)).to.be.eq(true, "Trade price isn't lower than new price");
      expect(oldPrice.lt(newPrice)).to.be.eq(true, "Price didn't increase");
      expect(newTick).to.be.eq(nextTick, "We didn't cross to the next tick");
    });

    it("should execute trade and cross one tick - zero for one", async () => {
      // first push price into a range with 2 lp positions
      await bento.transfer(usd.address, alice.address, pool1.address, getBigNumber(1000));
      let swapData = ethers.utils.defaultAbiCoder.encode(
        ["bool", "uint256", "address", "bool"],
        [false, getBigNumber(1000), alice.address, false]
      );
      await pool1.swap(swapData);

      const oldLiq = await pool1.liquidity();
      const oldTick = await pool1.nearestTick();
      const nextTick = (await pool1.ticks(oldTick)).nextTick;
      const oldEthBalance = await bento.balanceOf(weth.address, alice.address);
      const oldUSDBalance = await bento.balanceOf(usd.address, alice.address);
      const oldPrice = await pool1.price();

      await bento.transfer(weth.address, alice.address, pool1.address, getBigNumber(1));
      swapData = ethers.utils.defaultAbiCoder.encode(
        ["bool", "uint256", "address", "bool"],
        [true, getBigNumber(1), alice.address, false] // sell 1 weth
      );
      await pool1.swap(swapData);

      const newLiq = await pool1.liquidity();
      const newPrice = await pool1.price();
      const newTick = await pool1.nearestTick();
      const usdReceived = (await bento.balanceOf(usd.address, alice.address)).sub(oldUSDBalance);
      const ethPaid = oldEthBalance.sub(await bento.balanceOf(weth.address, alice.address));
      const tradePrice = parseInt(usdReceived.mul(100000).div(ethPaid)) / 100000;
      const tradePriceSqrtX96 = getSqrtX96Price(tradePrice);

      expect(ethPaid.eq(getBigNumber(1))).to.be.eq(true, "Didn't sell one eth");
      expect(usdReceived.gt(0)).to.be.eq(true, "Didn't get any usd");
      expect(oldPrice.gt(tradePriceSqrtX96)).to.be.eq(true, "Trade price isnt't lower than starting price");
      expect(newPrice.lt(tradePriceSqrtX96)).to.be.eq(true, "New price isn't lower than trade prie");
      expect(newTick < oldTick).to.be.eq(true, "We didn't drop down a tick");
      expect(oldPrice.gt(newPrice)).to.be.eq(true, "Price didn't increase");
      expect(oldLiq.gt(newLiq)).to.be.eq(true, "We didn't cross out of one position");
    });

    // TO DO
    it("shouldn't swap outside ticks where liquidity is 0");

    it("Swap output should be > 0 and < input/price", async () => {
      const oldEthBalance = await bento.balanceOf(weth.address, alice.address);
      const priceSqrt = parseInt((await pool1.price()).toString()) / Math.pow(2, 96);
      const price = priceSqrt * priceSqrt;

      await bento.transfer(usd.address, alice.address, pool1.address, BigNumber.from(1000000));
      const swapData = ethers.utils.defaultAbiCoder.encode(
        ["bool", "uint256", "address", "bool"],
        [false, BigNumber.from(1000000), alice.address, false]
      );
      await pool1.swap(swapData);
      const ethReceived = (await bento.balanceOf(weth.address, alice.address)).sub(oldEthBalance);

      expect(ethReceived.toNumber()).gt(0);
      expect(ethReceived.toNumber()).lt(1000000 / price);
    });

    it("should collect protocol fee", async () => {
      const token0ProtocolFeeOld = await pool1.token0ProtocolFee();
      const token1ProtocolFeeOld = await pool1.token1ProtocolFee();
      await pool1.collectProtocolFee();
      const token0ProtocolFee = await pool1.token0ProtocolFee();
      const token1ProtocolFee = await pool1.token1ProtocolFee();

      expect(token0ProtocolFee.eq(1)).to.be.eq(true, "token0 - Protocol Fee reset to 1");
      expect(token1ProtocolFee.eq(1)).to.be.eq(true, "token1 - Protocol Fee reset to 1");
    });
  });
});

function getDx(liquidity, priceLower, priceUpper, roundUp = true) {
  const increment = roundUp ? 1 : 0;
  return liquidity.mul("0x1000000000000000000000000").mul(priceUpper.sub(priceLower)).div(priceUpper).div(priceLower).add(increment);
}

function getDy(liquidity, priceLower, priceUpper, roundUp = true) {
  const increment = roundUp ? 1 : 0;
  return liquidity.mul(priceUpper.sub(priceLower)).div("0x1000000000000000000000000").add(increment);
}

// used only in testing for rough estimates
function getSqrtX96Price(price: number): BigNumber {
  return BigNumber.from(Math.floor(price ** 0.5 * 16777216)).mul("0x1000000000000000000");
}

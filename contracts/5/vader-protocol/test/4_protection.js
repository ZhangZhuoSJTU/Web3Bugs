const { expect } = require("chai");
var Utils = artifacts.require('./Utils')
var Vether = artifacts.require('./Vether')
var Vader = artifacts.require('./Vader')
var USDV = artifacts.require('./USDV')
var VAULT = artifacts.require('./Vault')
var Pools = artifacts.require('./Pools')
var Router = artifacts.require('./Router')
var Factory = artifacts.require('./Factory')
var Asset = artifacts.require('./Token1')
var Anchor = artifacts.require('./Token2')

const BigNumber = require('bignumber.js')
const truffleAssert = require('truffle-assertions');
const { VoidSigner } = require("@ethersproject/abstract-signer");

function BN2Str(BN) { return ((new BigNumber(BN)).toFixed()) }
function getBN(BN) { return (new BigNumber(BN)) }

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

var utils; var vader; var vether; var usdv; var vault; var pools; var anchor; var asset; var router; var factory;
var anchor0; var anchor1; var anchor2; var anchor3; var anchor4;  var anchor5; 
var acc0; var acc1; var acc2; var acc3; var acc0; var acc5;
const one = 10**18

before(async function() {
  accounts = await ethers.getSigners();
  acc0 = await accounts[0].getAddress()
  acc1 = await accounts[1].getAddress()
  acc2 = await accounts[2].getAddress()
  acc3 = await accounts[3].getAddress()

  utils = await Utils.new();
  vether = await Vether.new();
  vader = await Vader.new();
  usdv = await USDV.new();
  vault = await VAULT.new();
  router = await Router.new();
  pools = await Pools.new();
  factory = await Factory.new();
  
})
// acc  | VTH | VADER  | USDV | Anr  |  Ass |
// pool|   0 | 2000 | 2000 | 1000 | 1000 |
// acc1 |   0 | 1000 | 1000 | 1000 | 1000 |

describe("Deploy Protection", function() {
  it("Should have right reserves", async function() {
    await vader.flipEmissions()

    await utils.init(vader.address, usdv.address, router.address, pools.address, factory.address)
    await vader.init(vether.address, usdv.address, utils.address)
    await usdv.init(vader.address, vault.address, router.address)
    await vault.init(vader.address, usdv.address, router.address, factory.address, pools.address)
    await router.init(vader.address, usdv.address, pools.address);
    await pools.init(vader.address, usdv.address, router.address, factory.address);
    await factory.init(pools.address);

    anchor = await Anchor.new();
    asset = await Asset.new();

    await vether.transfer(acc1, BN2Str(7407)) 
    await anchor.transfer(acc1, BN2Str(2000))
    await anchor.approve(router.address, BN2Str(one), {from:acc1})
    await vether.approve(vader.address, '7400', {from:acc1})
    await vader.upgrade(BN2Str(7400), {from:acc1}) 
    await router.addLiquidity(vader.address, '1000', anchor.address, '1000', {from:acc1})

    await vader.flipMinting()
    await usdv.convert('2000', {from:acc1})

    await asset.transfer(acc1, '2000')
    await asset.approve(router.address, BN2Str(one), {from:acc1})
    await router.addLiquidity(usdv.address, '1000', asset.address, '1000', {from:acc1})

    await vader.transfer(acc0, '100', {from:acc1})
    await usdv.transfer(acc0, '100', {from:acc1})

    // console.log(BN2Str(await vader.getDailyEmission()))

    expect(Number(await vader.getDailyEmission())).to.be.greaterThan(0);
    expect(Number(await vault.reserveUSDV())).to.be.greaterThan(0);
    expect(Number(await router.reserveUSDV())).to.be.greaterThan(0);
    expect(Number(await router.reserveVADER())).to.be.greaterThan(0);
    await vader.flipEmissions()
  });
});

describe("Should do IL Protection", function() {
  it("Core math", async function() {
    expect(BN2Str(await utils.calcCoverage('1000', '1000', '1100', '918'))).to.equal('0');
    expect(BN2Str(await utils.calcCoverage('1000', '1000', '1200', '820'))).to.equal('63');

    expect(BN2Str(await utils.calcCoverage('100', '1000', '75', '2000'))).to.equal('0');
    expect(BN2Str(await utils.calcCoverage('100', '1000', '20', '2000'))).to.equal('70');
  });
  it("Small swap, need protection", async function() {
    await router.curatePool(anchor.address)
    expect(BN2Str(await anchor.balanceOf(acc1))).to.equal('1000');
    expect(BN2Str(await pools.getBaseAmount(anchor.address))).to.equal('1000');
    expect(BN2Str(await pools.getTokenAmount(anchor.address))).to.equal('1000');
    expect(BN2Str(await vader.balanceOf(acc1))).to.equal('4300');

    for(let i = 0; i<9; i++){
      await router.swap('100', anchor.address, vader.address, {from:acc1})
    }
    expect(BN2Str(await anchor.balanceOf(acc1))).to.equal('100');
    expect(BN2Str(await pools.getTokenAmount(anchor.address))).to.equal('1900');
    expect(BN2Str(await pools.getBaseAmount(anchor.address))).to.equal('554');
    expect(BN2Str(await vader.balanceOf(acc1))).to.equal('4746');

    expect(BN2Str(await router.mapMemberToken_depositBase(acc1, anchor.address))).to.equal('1000');
    expect(BN2Str(await router.mapMemberToken_depositToken(acc1, anchor.address))).to.equal('1000');
    let coverage = await utils.getCoverage(acc1, anchor.address)
    expect(BN2Str(coverage)).to.equal('183');
    expect(BN2Str(await utils.getProtection(acc1, anchor.address, "10000", '1'))).to.equal('183');
    let reserveVADER = BN2Str(await router.reserveVADER())
    expect(BN2Str(await router.getILProtection(acc1, vader.address, anchor.address, '10000'))).to.equal(reserveVADER);


  });

  it("Small swap, need protection on Asset", async function() {
    await router.setParams('1', '1', '2')
    expect(await pools.isAsset(asset.address)).to.equal(true);
    await router.curatePool(asset.address)
    expect(await router.isCurated(asset.address)).to.equal(true);
    expect(BN2Str(await usdv.balanceOf(acc1))).to.equal('900');
    for(let i = 0; i<9; i++){
      await router.swap('100', asset.address, usdv.address, {from:acc1})
    }

    expect(BN2Str(await router.mapMemberToken_depositBase(acc1, asset.address))).to.equal('1000');
    expect(BN2Str(await router.mapMemberToken_depositToken(acc1, asset.address))).to.equal('1000');
    let coverage = await utils.getCoverage(acc1, asset.address)
    expect(BN2Str(coverage)).to.equal('183');
    expect(BN2Str(await utils.getProtection(acc1, asset.address, "10000", '1'))).to.equal('183');
    expect(Number(await router.getILProtection(acc1, usdv.address, asset.address, '10000'))).to.be.lessThanOrEqual(Number(await router.reserveVADER()));
  });

});


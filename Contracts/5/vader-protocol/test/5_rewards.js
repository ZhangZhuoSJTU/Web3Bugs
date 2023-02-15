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

describe("Deploy Rewards", function() {
  it("Should have right reserves", async function() {
    await utils.init(vader.address, usdv.address, router.address, pools.address, factory.address)
    await vader.init(vether.address, usdv.address, utils.address)
    await usdv.init(vader.address, vault.address, router.address)
    await vault.init(vader.address, usdv.address, router.address, factory.address, pools.address)
    await router.init(vader.address, usdv.address, pools.address);
    await pools.init(vader.address, usdv.address, router.address, factory.address);
    await factory.init(pools.address);

    await vader.flipEmissions()

    anchor = await Anchor.new();
    asset = await Asset.new();

    await vether.transfer(acc1, BN2Str(7407)) 
    await anchor.transfer(acc1, BN2Str(3000))
    await anchor.approve(router.address, BN2Str(one), {from:acc1})

    await vether.approve(vader.address, '7400', {from:acc1})
    await vader.upgrade(BN2Str(7400), {from:acc1}) 

    await vader.flipMinting()
    await usdv.convert(BN2Str(1100), {from:acc1})
    // await usdv.withdrawToUSDV('10000', {from:acc1})
    await asset.transfer(acc1, BN2Str(2000))
    await asset.approve(router.address, BN2Str(one), {from:acc1})

    await router.addLiquidity(vader.address, '1000', anchor.address, '1000', {from:acc1})
    await router.addLiquidity(usdv.address, '1000', asset.address, '1000', {from:acc1})
    
    expect(Number(await vader.getDailyEmission())).to.be.greaterThan(0);
    expect(Number(await vault.reserveUSDV())).to.be.greaterThan(0);
    expect(Number(await router.reserveUSDV())).to.be.greaterThan(0);
    expect(Number(await router.reserveVADER())).to.be.greaterThan(0);
    // await vader.flipEmissions()
  });
});

describe("Should do pool rewards", function() {

  it("Swap anchor, get rewards", async function() {
    let r = '4';
    await router.curatePool(anchor.address)
    expect(Number(await router.reserveVADER())).to.be.greaterThan(0);
    expect(await router.emitting()).to.equal(true);
    expect(BN2Str(await vader.balanceOf(router.address))).to.equal(r);
    expect(BN2Str(await utils.getRewardShare(anchor.address, '1'))).to.equal(r);
    expect(BN2Str(await utils.getReducedShare(r, '1'))).to.equal(r);
    expect(BN2Str(await pools.getBaseAmount(anchor.address))).to.equal('1000');
    let tx = await router.swap('100', vader.address, anchor.address, {from:acc1})
    expect(BN2Str(tx.logs[0].args.amount)).to.equal(r);
    expect(BN2Str(await pools.getBaseAmount(anchor.address))).to.equal('1104');
    expect(BN2Str(await router.reserveVADER())).to.equal('0');
    expect(BN2Str(await utils.getRewardShare(anchor.address, '1'))).to.equal('0');
    expect(BN2Str(await utils.getReducedShare('0', '1'))).to.equal('0');
  });

  it("Swap asset, get rewards", async function() {
    let r = '3';
    await router.setParams('1', '1', '2')
    await router.curatePool(asset.address, {from:acc1})
    expect(BN2Str(await router.reserveUSDV())).to.equal(r);
    expect(await router.emitting()).to.equal(true);
    expect(BN2Str(await usdv.balanceOf(router.address))).to.equal(r);
    expect(BN2Str(await utils.getRewardShare(asset.address, '1'))).to.equal(r);
    expect(BN2Str(await utils.getReducedShare(r, '1'))).to.equal(r);
    expect(BN2Str(await pools.getBaseAmount(asset.address))).to.equal('1000');
    let tx = await router.swap('100', usdv.address, asset.address, {from:acc1})
    expect(BN2Str(tx.logs[0].args.amount)).to.equal('4');
    expect(BN2Str(await pools.getBaseAmount(asset.address))).to.equal(BN2Str(1100 + 4));
    expect(BN2Str(await router.reserveUSDV())).to.equal('0');
    expect(BN2Str(await utils.getRewardShare(asset.address, '1'))).to.equal('0');
    expect(BN2Str(await utils.getReducedShare('0', '1'))).to.equal('0');
  });
});


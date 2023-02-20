const { expect } = require("chai");
var Utils = artifacts.require('./Utils')
var Vether = artifacts.require('./Vether')
var Vader = artifacts.require('./Vader')
var USDV = artifacts.require('./USDV')
var VAULT = artifacts.require('./Vault')
var Pools = artifacts.require('./Pools')
var Router = artifacts.require('./Router')
var Factory = artifacts.require('./Factory')
var Synth = artifacts.require('./Synth')

var Asset = artifacts.require('./Token1')
var Anchor = artifacts.require('./Token2')

const BigNumber = require('bignumber.js')
const truffleAssert = require('truffle-assertions')

function BN2Str(BN) { return ((new BigNumber(BN)).toFixed()) }
function getBN(BN) { return (new BigNumber(BN)) }

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

var utils; var vader; var vether; var usdv; var vault; var pools; var anchor; var asset; var factory; var router;
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


describe("Deploy Router", function() {
  it("Should deploy", async function() {
    await utils.init(vader.address, usdv.address, router.address, pools.address, factory.address)
    await vader.init(vether.address, usdv.address, utils.address)
    await usdv.init(vader.address, vault.address, router.address)
    await vault.init(vader.address, usdv.address, router.address, factory.address, pools.address)
    await router.init(vader.address, usdv.address, pools.address);
    await pools.init(vader.address, usdv.address, router.address, factory.address);
    await factory.init(pools.address);

    asset = await Asset.new();
    anchor = await Anchor.new();

    await vether.transfer(acc1, '9409') 
    await anchor.transfer(acc1, '2000')
    await anchor.approve(router.address, BN2Str(one), {from:acc1})

    await vether.approve(vader.address, '9400', {from:acc1})
    await vader.upgrade('9400', {from:acc1}) 
    await vader.flipEmissions()
    await vader.flipMinting()
    await usdv.convert('5000', {from:acc1})

    await asset.transfer(acc1, '2000')
    await asset.approve(router.address, BN2Str(one), {from:acc1})

    await vader.transfer(router.address, '1000', {from:acc1})
    await usdv.transfer(router.address, '1000', {from:acc1})

  });
});


describe("Add liquidity", function() {
  it("Should add anchor", async function() {
    await router.addLiquidity(vader.address, '1000', anchor.address, '1000', {from:acc1})
    await router.addLiquidity(usdv.address, '1000', asset.address, '1000', {from:acc1})
  });
});

describe("Should Borrow Debt", function() {
  it("Borrow", async function() {
    await router.borrow('100', vader.address, anchor.address, {from:acc1})
    await router.borrow('100', usdv.address, asset.address, {from:acc1})
    await pools.deploySynth(anchor.address)
    await router.swapWithSynths('250', vader.address, false, anchor.address, true, {from:acc1})
    let synth = await Synth.at(await factory.getSynth(anchor.address));
    await router.borrow('144', synth.address, anchor.address, {from:acc1})
    await pools.deploySynth(asset.address)
    await router.swapWithSynths('250', usdv.address, false, asset.address, true, {from:acc1})
    let synth2 = await Synth.at(await factory.getSynth(asset.address));
    await router.borrow('144', synth2.address, asset.address, {from:acc1})
  });
  
});

describe("Should pay interest", function() {
    it("Pay VADER-ANCHOR interest", async function() {
      expect(BN2Str(await utils.getDebtLoading(vader.address, anchor.address))).to.equal('662');
      expect(BN2Str(await utils.getInterestPayment(vader.address, anchor.address))).to.equal('3');
      expect(BN2Str(await utils.calcValueInBase(anchor.address, '3'))).to.equal('4');
      expect(BN2Str(await utils.getInterestOwed(vader.address, anchor.address, '31536000'))).to.equal('4');

      expect(BN2Str(await router.getSystemInterestPaid(vader.address, anchor.address))).to.equal('3');
      expect(BN2Str(await pools.getBaseAmount(anchor.address))).to.equal('1428');
    });

});


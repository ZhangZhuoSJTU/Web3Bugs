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
    await vader.flipMinting()
    await usdv.convert('5000', {from:acc1})

    await asset.transfer(acc1, '2000')
    await asset.approve(router.address, BN2Str(one), {from:acc1})

    await vader.transfer(router.address, '1000', {from:acc1})
    await usdv.transfer(router.address, '1000', {from:acc1})

    expect(await router.DAO()).to.equal(acc0);
    expect(await router.UTILS()).to.equal(utils.address);
    expect(await router.VADER()).to.equal(vader.address);
    expect(await router.USDV()).to.equal(usdv.address);
  });
});


describe("Add liquidity", function() {
  it("Should add anchor", async function() {
    await router.addLiquidity(vader.address, '1000', anchor.address, '1000', {from:acc1})
    expect(BN2Str(await pools.getUnits(anchor.address))).to.equal('1000');
    expect(BN2Str(await pools.getBaseAmount(anchor.address))).to.equal(BN2Str(1000));
    expect(BN2Str(await pools.getTokenAmount(anchor.address))).to.equal('1000');
    expect(BN2Str(await pools.getMemberUnits(anchor.address, acc1))).to.equal('1000');
  });
  it("Should add asset", async function() {
    let tx = await router.addLiquidity(usdv.address, '1000', asset.address, '1000', {from:acc1})
    expect(BN2Str(await pools.mapToken_Units(asset.address))).to.equal('1000');
    expect(BN2Str(await pools.mapToken_baseAmount(asset.address))).to.equal(BN2Str(1000));
    expect(BN2Str(await pools.mapToken_tokenAmount(asset.address))).to.equal('1000');
    expect(BN2Str(await pools.mapTokenMember_Units(asset.address, acc1))).to.equal('1000');
  });
});

describe("Should Borrow Debt", function() {
  it("Borrow ANCHOR with VADER", async function() {
    expect(BN2Str(await vader.balanceOf(acc1))).to.equal('2400');
    expect(BN2Str(await anchor.balanceOf(acc1))).to.equal('1000');
    await router.borrow('100', vader.address, anchor.address, {from:acc1})
    expect(BN2Str(await vader.balanceOf(acc1))).to.equal('2300');
    expect(BN2Str(await anchor.balanceOf(acc1))).to.equal('1058');
    expect(BN2Str(await router.getSystemCollateral(vader.address, anchor.address))).to.equal('100');
    expect(BN2Str(await router.getSystemDebt(vader.address, anchor.address))).to.equal('58');
    expect(BN2Str(await router.getMemberCollateral(acc1, vader.address, anchor.address))).to.equal('100');
    expect(BN2Str(await router.getMemberDebt(acc1, vader.address, anchor.address))).to.equal('58');
  });
  it("Borrow ASSET with USDV", async function() {
    expect(BN2Str(await usdv.balanceOf(acc1))).to.equal('3000');
    expect(BN2Str(await asset.balanceOf(acc1))).to.equal('1000');
    await router.borrow('100', usdv.address, asset.address, {from:acc1})
    expect(BN2Str(await usdv.balanceOf(acc1))).to.equal('2900');
    expect(BN2Str(await asset.balanceOf(acc1))).to.equal('1058');
    expect(BN2Str(await router.getSystemCollateral(usdv.address, asset.address))).to.equal('100');
    expect(BN2Str(await router.getSystemDebt(usdv.address, asset.address))).to.equal('58');
    expect(BN2Str(await router.getMemberCollateral(acc1, usdv.address, asset.address))).to.equal('100');
    expect(BN2Str(await router.getMemberDebt(acc1, usdv.address, asset.address))).to.equal('58');
  });
  it("Borrow ANCHOR with SYNTH-ANCHOR", async function() {
    await pools.deploySynth(anchor.address)
    await router.swapWithSynths('250', vader.address, false, anchor.address, true, {from:acc1})
    let synth = await Synth.at(await factory.getSynth(anchor.address));
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal('144');
    expect(BN2Str(await anchor.balanceOf(acc1))).to.equal('1058');
    await router.borrow('144', synth.address, anchor.address, {from:acc1})
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal('0');
    expect(BN2Str(await anchor.balanceOf(acc1))).to.equal('1124');
  });
  it("Borrow ASSET with SYNTH-ASSET", async function() {
    await pools.deploySynth(asset.address)
    await router.swapWithSynths('250', usdv.address, false, asset.address, true, {from:acc1})
    let synth = await Synth.at(await factory.getSynth(asset.address));
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal('144');
    expect(BN2Str(await asset.balanceOf(acc1))).to.equal('1058');
    await router.borrow('144', synth.address, asset.address, {from:acc1})
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal('0');
    expect(BN2Str(await asset.balanceOf(acc1))).to.equal('1124');
  });
  it("Fail bad combos", async function() {
    await truffleAssert.reverts(router.borrow('1', vader.address, asset.address, {from:acc1}))
    await truffleAssert.reverts(router.borrow('1', usdv.address, anchor.address, {from:acc1}))
    let synth = await Synth.at(await factory.getSynth(asset.address));
    await truffleAssert.reverts(router.borrow('1', synth.address, anchor.address, {from:acc1}))
    synth = await Synth.at(await factory.getSynth(anchor.address));
    await truffleAssert.reverts(router.borrow('1', synth.address, asset.address, {from:acc1}))
  });
});

describe("Should Repay Debt", function() {
    it("Repay VADER with ANCHOR", async function() {
      expect(BN2Str(await vader.balanceOf(acc1))).to.equal('2050');
      expect(BN2Str(await anchor.balanceOf(acc1))).to.equal('1124');
    //   expect(BN2Str(await router.getMemberDebt(acc1, vader.address, anchor.address))).to.equal('58');
      await router.repay('10000', vader.address, anchor.address, {from:acc1})
      expect(BN2Str(await vader.balanceOf(acc1))).to.equal('2150');
      expect(BN2Str(await anchor.balanceOf(acc1))).to.equal('1066');
      expect(BN2Str(await router.getSystemCollateral(vader.address, anchor.address))).to.equal('0');
      expect(BN2Str(await router.getSystemDebt(vader.address, anchor.address))).to.equal('0');
      expect(BN2Str(await router.getMemberCollateral(acc1, vader.address, anchor.address))).to.equal('0');
      expect(BN2Str(await router.getMemberDebt(acc1, vader.address, anchor.address))).to.equal('0');
    });
    it("Repay USDV with ASSET", async function() {
        expect(BN2Str(await usdv.balanceOf(acc1))).to.equal('2650');
        expect(BN2Str(await asset.balanceOf(acc1))).to.equal('1124');
        // expect(BN2Str(await router.getMemberDebt(acc1, usdv.address, asset.address))).to.equal('58');
        await router.repay('10000', usdv.address, asset.address, {from:acc1})
        expect(BN2Str(await usdv.balanceOf(acc1))).to.equal('2750');
        expect(BN2Str(await asset.balanceOf(acc1))).to.equal('1066');
        expect(BN2Str(await router.getSystemCollateral(usdv.address, asset.address))).to.equal('0');
        expect(BN2Str(await router.getSystemDebt(usdv.address, asset.address))).to.equal('0');
        expect(BN2Str(await router.getMemberCollateral(acc1, usdv.address, asset.address))).to.equal('0');
        expect(BN2Str(await router.getMemberDebt(acc1, usdv.address, asset.address))).to.equal('0');
      });

      it("Repay SYNTH-ANCHOR with ANCHOR", async function() {
        let synth = await Synth.at(await factory.getSynth(anchor.address));
        expect(BN2Str(await synth.balanceOf(acc1))).to.equal('0');
        expect(BN2Str(await anchor.balanceOf(acc1))).to.equal('1066');
        // expect(BN2Str(await router.getMemberDebt(acc1, synth.address, anchor.address))).to.equal('66');
        await router.repay('10000', synth.address, anchor.address, {from:acc1})
        expect(BN2Str(await synth.balanceOf(acc1))).to.equal('144');
        expect(BN2Str(await anchor.balanceOf(acc1))).to.equal('1000');
        expect(BN2Str(await router.getSystemCollateral(synth.address, anchor.address))).to.equal('0');
        expect(BN2Str(await router.getSystemDebt(synth.address, anchor.address))).to.equal('0');
        expect(BN2Str(await router.getMemberCollateral(acc1, synth.address, anchor.address))).to.equal('0');
        expect(BN2Str(await router.getMemberDebt(acc1, synth.address, anchor.address))).to.equal('0');
      });
      it("Repay SYNTH-ASSET with ASSET", async function() {
        let synth = await Synth.at(await factory.getSynth(asset.address));
        expect(BN2Str(await synth.balanceOf(acc1))).to.equal('0');
        expect(BN2Str(await asset.balanceOf(acc1))).to.equal('1066');
        // expect(BN2Str(await router.getMemberDebt(acc1, synth.address, asset.address))).to.equal('66');
        await router.repay('10000', synth.address, asset.address, {from:acc1})
        expect(BN2Str(await synth.balanceOf(acc1))).to.equal('144');
        expect(BN2Str(await asset.balanceOf(acc1))).to.equal('1000');
        expect(BN2Str(await router.getSystemCollateral(synth.address, asset.address))).to.equal('0');
        expect(BN2Str(await router.getSystemDebt(synth.address, asset.address))).to.equal('0');
        expect(BN2Str(await router.getMemberCollateral(acc1, synth.address, asset.address))).to.equal('0');
        expect(BN2Str(await router.getMemberDebt(acc1, synth.address, asset.address))).to.equal('0');
      });
});


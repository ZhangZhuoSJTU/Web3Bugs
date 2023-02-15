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

    await vether.transfer(acc1, BN2Str(7407)) 
    await anchor.transfer(acc1, BN2Str(2000))
    await anchor.approve(router.address, BN2Str(one), {from:acc1})

    await vether.approve(vader.address, '7400', {from:acc1})
    await vader.upgrade(BN2Str(7400), {from:acc1}) 
    await asset.transfer(acc1, BN2Str(2000))
    await asset.approve(router.address, BN2Str(one), {from:acc1})

    await vader.flipMinting()
    await usdv.convert(BN2Str(3000), {from:acc1})

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

describe("Should Swap Synths", function() {
  it("Swap from Base to Synth", async function() {
    await pools.deploySynth(anchor.address)
    await router.swapWithSynths('250', vader.address, false, anchor.address, true, {from:acc1})
    expect(BN2Str(await pools.getBaseAmount(anchor.address))).to.equal('1250');
    expect(BN2Str(await pools.getTokenAmount(anchor.address))).to.equal('1000');
    expect(BN2Str(await utils.calcSynthUnits('250', '1000', '1000'))).to.equal('100');
    expect(BN2Str(await pools.mapTokenMember_Units(anchor.address, pools.address))).to.equal('100');
    expect(BN2Str(await pools.mapToken_Units(anchor.address))).to.equal('1100');

    expect(BN2Str(await utils.calcSwapOutput('250', '1000', '1000'))).to.equal('160');
    let synthAddress = await factory.getSynth(anchor.address)
    let synth = await Synth.at(synthAddress);
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal('160');
    expect(await synth.name()).to.equal('Token2 - vSynth');
    expect(await synth.symbol()).to.equal('TKN2.v');
    expect(BN2Str(await synth.totalSupply())).to.equal('160');
  });
  it("Swap from Synth to Base", async function() {
    let synthAddress = await factory.getSynth(anchor.address)
    let synth = await Synth.at(synthAddress);
    await router.swapWithSynths('80', anchor.address, true, vader.address, false, {from:acc1})
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal('80');
    expect(BN2Str(await pools.getBaseAmount(anchor.address))).to.equal('1165');
    expect(BN2Str(await pools.getTokenAmount(anchor.address))).to.equal('1000');
    expect(BN2Str(await utils.calcShare('80', '160', '100'))).to.equal('50');
    expect(BN2Str(await pools.mapTokenMember_Units(anchor.address, pools.address))).to.equal('50');
    expect(BN2Str(await pools.mapToken_Units(anchor.address))).to.equal('1050');
  });

  it("Swap from Synth to Synth", async function() {
    await pools.deploySynth(asset.address)
    let synthAddress = await factory.getSynth(anchor.address)
    let synth = await Synth.at(synthAddress);
    await router.swapWithSynths('80', anchor.address, true, asset.address, true, {from:acc1})
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal('0');
    expect(BN2Str(await pools.getBaseAmount(anchor.address))).to.equal('1086');
    expect(BN2Str(await pools.getTokenAmount(anchor.address))).to.equal('1000');
    expect(BN2Str(await utils.calcShare('80', '160', '100'))).to.equal('50');
    expect(BN2Str(await pools.mapTokenMember_Units(anchor.address, pools.address))).to.equal('0');
    expect(BN2Str(await pools.mapToken_Units(anchor.address))).to.equal('1000');
    
    expect(BN2Str(await utils.calcSwapOutput('250', '1000', '1000'))).to.equal('160');
    let synthAddress2 = await factory.getSynth(asset.address)
    let synth2 = await Synth.at(synthAddress2);
    expect(BN2Str(await synth2.balanceOf(acc1))).to.equal('67');
    expect(await synth2.name()).to.equal('Token1 - vSynth');
    expect(await synth2.symbol()).to.equal('TKN1.v');
    expect(BN2Str(await synth2.totalSupply())).to.equal('67');
  });

  it("Swap from token to Synth", async function() {
    let synth = await Synth.at(await factory.getSynth(asset.address));
    expect(BN2Str(await anchor.balanceOf(acc1))).to.equal('1000');
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal('67');

    await router.swapWithSynths('80', anchor.address, false, asset.address, true, {from:acc1})

    expect(BN2Str(await anchor.balanceOf(acc1))).to.equal('920');
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal('127');
  });
  it("Swap from Synth to token", async function() {
    let synth = await Synth.at(await factory.getSynth(asset.address));
    
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal('127');
    expect(BN2Str(await anchor.balanceOf(acc1))).to.equal('920');

    await router.swapWithSynths('50', asset.address, true, anchor.address, false, {from:acc1})

    expect(BN2Str(await synth.balanceOf(acc1))).to.equal('77');
    expect(BN2Str(await anchor.balanceOf(acc1))).to.equal('970');
    
  });
  it("Swap from Token to its own Synth", async function() {
    let synth = await Synth.at(await factory.getSynth(asset.address));
    expect(BN2Str(await asset.balanceOf(acc1))).to.equal('1000');
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal('77');

    await router.swapWithSynths('10', asset.address, false, asset.address, true, {from:acc1})

    expect(BN2Str(await asset.balanceOf(acc1))).to.equal('990');
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal('86');
  });

});

describe("Member should deposit Synths for rewards", function() {
  it("Should deposit", async function() {
    let synth = await Synth.at(await factory.getSynth(asset.address));

    await vault.deposit(synth.address, '20', {from:acc1})
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal(('66'));
    expect(BN2Str(await synth.balanceOf(vault.address))).to.equal(('20'));
    expect(BN2Str(await vault.getMemberDeposit(synth.address, acc1))).to.equal(('20'));
    expect(BN2Str(await vault.getMemberWeight(acc1))).to.equal(('21'));
    expect(BN2Str(await vault.totalWeight())).to.equal(('21'));
  });

  it("Should calc rewards", async function() {
    await vader.flipEmissions()
    await vader.setParams('1', '2')
    let synth = await Synth.at(await factory.getSynth(asset.address));
    
    let balanceStart = await vader.balanceOf(vault.address)
    expect(BN2Str(balanceStart)).to.equal(('0'));
    expect(BN2Str(await vader.getDailyEmission())).to.equal(('2200'));
    await vader.transfer(acc0, ('100'), {from:acc1})
    await usdv.transfer(acc0, ('100'), {from:acc1})
    expect(BN2Str(await vader.currentEra())).to.equal(('3'));
    expect(BN2Str(await vader.getDailyEmission())).to.equal(('4125'));
    expect(BN2Str(await vader.balanceOf(vault.address))).to.equal(('3300'));
    await usdv.transfer(acc0, ('100'), {from:acc1})
    expect(Number(await vault.reserveUSDV())).to.be.greaterThan((0));
    expect(BN2Str(await synth.balanceOf(vault.address))).to.equal(('20'));
    expect(BN2Str(await vault.calcReward(synth.address, acc1))).to.equal(('38')); // 666/100
    expect(BN2Str(await vault.calcCurrentReward(synth.address, acc1))).to.equal(('190')); // * by seconds
  });
  it("Should harvest", async function() {
    let synth = await Synth.at(await factory.getSynth(asset.address));
    expect(BN2Str(await vault.getMemberWeight(acc1))).to.equal(('21'));
    expect(BN2Str(await vault.totalWeight())).to.equal(('21'));
    await vault.harvest(synth.address, {from:acc1})
    expect(BN2Str(await vault.getMemberWeight(acc1))).to.equal(('209'));
    expect(BN2Str(await vault.totalWeight())).to.equal(('209'));
  });
  it("Should withdraw", async function() {
    let synth = await Synth.at(await factory.getSynth(asset.address));
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal('66');
    expect(BN2Str(await synth.balanceOf(vault.address))).to.equal('163');
    expect(BN2Str(await usdv.balanceOf(vault.address))).to.equal('322');
    expect(BN2Str(await vault.getMemberDeposit(synth.address, acc1))).to.equal('163');
    expect(BN2Str(await vault.getMemberWeight(acc1))).to.equal('209');
    await vader.flipEmissions()
    let tx = await vault.withdraw(synth.address, "10000",{from:acc1})
    expect(BN2Str(await vault.getMemberDeposit(synth.address, acc1))).to.equal('0');
    expect(BN2Str(await vault.getMemberWeight(acc1))).to.equal('0');
    expect(BN2Str(await vault.totalWeight())).to.equal('0');
    expect(BN2Str(await synth.balanceOf(vault.address))).to.equal('0');
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal('229');
  });
  it("Should deposit Anchor", async function() {
    expect(BN2Str(await vault.totalWeight())).to.equal(('0'));
    await router.swapWithSynths('30', anchor.address, false, anchor.address, true, {from:acc1})
    let synth = await Synth.at(await factory.getSynth(anchor.address));
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal('28');
    await vault.deposit(synth.address, '20', {from:acc1})
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal(('8'));
    expect(BN2Str(await synth.balanceOf(vault.address))).to.equal(('20'));
    expect(BN2Str(await vault.getMemberDeposit(synth.address, acc1))).to.equal(('20'));
    expect(BN2Str(await vault.getMemberWeight(acc1))).to.equal(('20'));
    expect(BN2Str(await vault.totalWeight())).to.equal(('20'));
    await vault.withdraw(synth.address, "5000",{from:acc1})
    expect(BN2Str(await synth.balanceOf(acc1))).to.equal(('18'));
    expect(BN2Str(await synth.balanceOf(vault.address))).to.equal(('10'));
    expect(BN2Str(await vault.getMemberDeposit(synth.address, acc1))).to.equal(('10'));
    expect(BN2Str(await vault.getMemberWeight(acc1))).to.equal(('10'));
    expect(BN2Str(await vault.totalWeight())).to.equal(('10'));
  });
});

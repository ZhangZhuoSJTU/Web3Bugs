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
var DAO = artifacts.require('./DAO')
var Synth = artifacts.require('./Synth')

const BigNumber = require('bignumber.js')
const truffleAssert = require('truffle-assertions')

function BN2Str(BN) { return ((new BigNumber(BN)).toFixed()) }
function getBN(BN) { return (new BigNumber(BN)) }

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

var utils; var vader; var vether; var usdv; var vault; var pools; var anchor; var asset; var router; var factory;
var dao;
var anchor; var anchor1; var anchor2; var anchor3; var anchor4;  var anchor5; 
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
  dao = await DAO.new();

  asset = await Asset.new();
  anchor = await Anchor.new();

})

describe("Deploy DAO", function() {
  it("Should deploy right", async function() {
    await utils.init(vader.address, usdv.address, router.address, pools.address, factory.address)
    await vader.init(vether.address, usdv.address, utils.address)
    await usdv.init(vader.address, vault.address, router.address)
    await vault.init(vader.address, usdv.address, router.address, factory.address, pools.address)
    await router.init(vader.address, usdv.address, pools.address);
    await pools.init(vader.address, usdv.address, router.address, factory.address);
    await factory.init(pools.address);
    await dao.init(vader.address, usdv.address, vault.address);
    
    await vether.approve(vader.address, '6000', {from:acc0})
    await vader.upgrade('3000', {from:acc0}) 

    await vader.transfer(acc1, '2000') 
    await anchor.transfer(acc1, '1110') 

    await vader.flipMinting()
    await usdv.convert(200, {from:acc1})

    await anchor.approve(router.address, BN2Str(one), {from:acc1})
    await router.addLiquidity(vader.address, '1000', anchor.address, '1000', {from:acc1})

    await pools.deploySynth(anchor.address)
    await router.swapWithSynths('110', vader.address, false, anchor.address, true, {from:acc0})
    await router.swapWithSynths('110', vader.address, false, anchor.address, true, {from:acc1})

    let synth = await Synth.at(await factory.getSynth(anchor.address));

    await vault.deposit(synth.address, '10', {from:acc0})
    await vault.deposit(synth.address, '10', {from:acc1})

    await vader.changeDAO(dao.address, {from:acc0})

    // await anchor.transfer(acc1, BN2Str(2000))
    // await anchor.approve(router.address, BN2Str(one), {from:acc1})
    
  });
});

describe("DAO Functions", function() {
  it("It should GRANT", async () => {
      await usdv.transfer(vault.address, '100', {from:acc1});
      assert.equal(BN2Str(await vault.reserveUSDV()), '100')
      await dao.newGrantProposal(acc3, '10', { from: acc1 })
      let proposalCount = BN2Str(await dao.proposalCount())
      await dao.voteProposal(proposalCount, { from: acc0 })
      await dao.voteProposal(proposalCount, { from: acc1 })
      await sleep(100)
      let balanceBefore = getBN(await usdv.balanceOf(acc3))
      await dao.finaliseProposal(proposalCount)
      let balanceAfter = getBN(await usdv.balanceOf(acc3))
      assert.equal(BN2Str(balanceAfter.minus(balanceBefore)), '10')
  })
  it("It should cahnge Utils", async () => {
    assert.equal(await vader.UTILS(), utils.address)
    let utils2 = await Utils.new();
    await dao.newAddressProposal(utils2.address, 'UTILS', { from: acc1 })
    let proposalCount = BN2Str(await dao.proposalCount())
    await dao.voteProposal(proposalCount, { from: acc0 })
    await dao.voteProposal(proposalCount, { from: acc1 })
    await sleep(2000)
    await dao.finaliseProposal(proposalCount)
    assert.equal(await vader.UTILS(), utils2.address)
})
})




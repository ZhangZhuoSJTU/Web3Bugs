const { expect } = require("chai");
var Utils = artifacts.require('./Utils')
var Vether = artifacts.require('./Vether')
var Vader = artifacts.require('./Vader')
var USDV = artifacts.require('./USDV')
var VAULT = artifacts.require('./Vault')
var POOLS = artifacts.require('./Pools')
var Router = artifacts.require('./Router')
var Factory = artifacts.require('./Factory')
var Attack = artifacts.require('./Attack')

const BigNumber = require('bignumber.js')
const truffleAssert = require('truffle-assertions')

function BN2Str(BN) { return ((new BigNumber(BN)).toFixed()) }
function getBN(BN) { return (new BigNumber(BN)) }

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

var utils; var vader; var vether; var usdv; var vault; var router; var pools; var attack; var factory;
var acc0; var acc1; var acc2; var acc3; var acc0; var acc5;

// 

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
  pools = await POOLS.new();
  factory = await Factory.new();
  attack = await Attack.new();

})

// acc  | VTH | VADER  | USDV |
// acc0 |   0 |    0 |    0 |
// acc1 |   0 |  2000 |    0 |

describe("Deploy USDV", function() {
  it("Should deploy", async function() {
    await vader.init(vether.address, usdv.address, utils.address)
    await usdv.init(vader.address, vault.address, router.address)
    await vault.init(vader.address, usdv.address, router.address, factory.address, pools.address)
    await router.init(vader.address, usdv.address, pools.address);
    await pools.init(vader.address, usdv.address, router.address, router.address);
    await attack.init(vader.address, usdv.address)
    await factory.init(pools.address);

    await vether.transfer(acc1, '3403') 
    await vether.approve(vader.address, '3400', {from:acc1})
    await vader.upgrade('3400', {from:acc1}) 

    expect(await usdv.name()).to.equal("VADER STABLE DOLLAR");
    expect(await usdv.symbol()).to.equal("USDV");
    expect(BN2Str(await usdv.decimals())).to.equal('18');
    expect(BN2Str(await usdv.totalSupply())).to.equal('0');
    // expect(BN2Str(await usdv.minimumDepositTime())).to.equal('1');
    expect(await usdv.DAO()).to.equal(acc0);
    // expect(await usdv.UTILS()).to.equal(utils.address);
  });
});

describe("Convert and redeem", function() {

  it("Should convert acc1", async function() {
    await vader.flipMinting()
    await usdv.convert('250', {from:acc1})
    expect(BN2Str(await vader.totalSupply())).to.equal('3150');
    expect(BN2Str(await vader.balanceOf(acc1))).to.equal('3150');
    expect(BN2Str(await usdv.totalSupply())).to.equal('250');
    expect(BN2Str(await usdv.balanceOf(acc1))).to.equal('250');
  });
  it("Should convert for member", async function() {
    await usdv.convertForMember(acc1, '250', {from:acc1})
    expect(BN2Str(await vader.totalSupply())).to.equal('2900');
    expect(BN2Str(await vader.balanceOf(acc1))).to.equal('2900');
    expect(BN2Str(await usdv.totalSupply())).to.equal('500');
    expect(BN2Str(await usdv.balanceOf(acc1))).to.equal('500');
  });
  it("Should convert acc1 directly", async function() {
    await usdv.convert('500', {from:acc1})
    expect(BN2Str(await vader.totalSupply())).to.equal(BN2Str(2400));
    expect(BN2Str(await vader.balanceOf(acc1))).to.equal(BN2Str(2400));
    expect(BN2Str(await usdv.totalSupply())).to.equal(BN2Str(1000));
    expect(BN2Str(await usdv.balanceOf(acc1))).to.equal(BN2Str(1000));
  });
  it("Should redeem", async function() {
    // await usdv.approve(usdv.address, '1000', {from:acc1}) 
    expect(BN2Str(await usdv.balanceOf(acc1))).to.equal('1000');
    await usdv.redeem('250',{from:acc1})
    // expect(BN2Str(await usdv.getMemberDeposit(acc1))).to.equal(BN2Str(0));
    expect(BN2Str(await usdv.totalSupply())).to.equal('750');
    expect(BN2Str(await usdv.balanceOf(acc1))).to.equal('750');
    expect(BN2Str(await vader.totalSupply())).to.equal('2650');
    expect(BN2Str(await vader.balanceOf(acc1))).to.equal('2650');
  });
  it("Should redeem for member", async function() {
    await usdv.redeemForMember(acc1, '250',{from:acc1})
    // expect(BN2Str(await usdv.getMemberDeposit(acc1))).to.equal(BN2Str(0));
    expect(BN2Str(await usdv.totalSupply())).to.equal('500');
    expect(BN2Str(await usdv.balanceOf(acc1))).to.equal('500');
    expect(BN2Str(await vader.totalSupply())).to.equal('2900');
    expect(BN2Str(await vader.balanceOf(acc1))).to.equal('2900');
  });

  it("Should convert acc1", async function() {
    await usdv.convert('500', {from:acc1})
    expect(BN2Str(await vader.totalSupply())).to.equal(BN2Str(2400));
    expect(BN2Str(await vader.balanceOf(acc1))).to.equal(BN2Str(2400));
    expect(BN2Str(await usdv.totalSupply())).to.equal(BN2Str(1000));
    expect(BN2Str(await usdv.balanceOf(acc1))).to.equal(BN2Str(1000));
  });

// acc  | VTH | VADER  | USDV |
// acc0 |   0 |    0 |    0 |
// acc1 |   0 | 1000 | 1000 |

});

describe("Be a valid ERC-20", function() {
  it("Should transfer From", async function() {
    await usdv.approve(acc0, "100", {from:acc1}) 
    expect(BN2Str(await usdv.allowance(acc1, acc0))).to.equal('100');
    await usdv.transferFrom(acc1, acc0, "100", {from:acc0})
    expect(BN2Str(await usdv.balanceOf(acc0))).to.equal('100');
  });
// acc  | VTH | VADER  | USDV |
// acc0 |   0 |    0 |  100 |
// acc1 |   0 | 1000 |  900 |

  it("Should transfer to", async function() {
    await usdv.transferTo(acc0, "100", {from:acc1}) 
    expect(BN2Str(await usdv.balanceOf(acc0))).to.equal('200');
  });
// acc  | VTH | VADER  | USDV |
// acc0 |   0 |    0 |  200 |
// acc1 |   0 | 1000 |  800 |

  it("Should burn", async function() {
    await usdv.burn("100", {from:acc0})
    expect(BN2Str(await usdv.balanceOf(acc0))).to.equal('100');
    expect(BN2Str(await usdv.totalSupply())).to.equal(BN2Str('900'));
  });
// acc  | VTH | VADER  | USDV |
// acc0 |   0 |    0 |  100 |
// acc1 |   0 | 1000 |  800 |

  it("Should burn from", async function() {
    await usdv.approve(acc1, "100", {from:acc0}) 
    expect(BN2Str(await usdv.allowance(acc0, acc1))).to.equal('100');
    await usdv.burnFrom(acc0, "100", {from:acc1})
    expect(BN2Str(await usdv.balanceOf(acc0))).to.equal('0');
    expect(BN2Str(await usdv.totalSupply())).to.equal(BN2Str('800'));
    expect(BN2Str(await usdv.balanceOf(acc1))).to.equal('800');
  });
// acc  | VTH | VADER  | USDV |
// acc0 |   0 |    0 |  0   |
// acc1 |   0 | 1000 |  800 |

});

// describe("Should fail deposit USDV for rewards", function() {
//   it("Should fail USDV deposit", async function() {
//     await truffleAssert.reverts(vault.deposit(usdv.address, '200', {from:acc1})) 
//   });
//   it("Should fail VADER deposit", async function() {
//     await truffleAssert.reverts(vault.deposit(vader.address, '200', {from:acc1})) 
//   });
// });

// describe("Should fail attack", function() {
//   it("Same block fails", async function() {
//     // console.log(await usdv.isMature({from:acc1}))
//     await attack.attackUSDV('100', {from:acc1})
//     await usdv.setParams('100', '1', '1', '2592000')
//     await truffleAssert.reverts(attack.attackUSDV('100', {from:acc1}), "No flash")
//   });
// });


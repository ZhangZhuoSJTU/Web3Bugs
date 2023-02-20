const { artifacts, ethers } = require("hardhat")
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const YUSDTokenTester = artifacts.require("./YUSDTokenTester.sol")
const YetiTokenTester = artifacts.require("./YETITokenTester.sol")



const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const getDifference = th.getDifference
const assertRevert = th.assertRevert
const mv = testHelpers.MoneyValues

const YUSDToken = artifacts.require("YUSDToken")
const YetiToken = artifacts.require("YETIToken")
const sYETIToken = artifacts.require("./sYETIToken.sol")
const sYETITokenTester = artifacts.require("./sYETITokenTester.sol")

contract('TroveManager - Redistribution reward calculations', async accounts => {

  const [
    owner,
    alice, bob, carol, dennis, erin, freddy, greta, harry, ida,
    A, B, C, D, E,
    whale, defaulter_1, defaulter_2, defaulter_3, defaulter_4] = accounts;

    const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)


  let yusdToken
  let yetiToken
  let sYetiToken

  let contracts

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.yusdToken = await YUSDTokenTester.new(
      contracts.troveManager.address,
      contracts.troveManagerLiquidations.address,
      contracts.troveManagerRedemptions.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    const YETIContracts = await deploymentHelper.deployYETITesterContractsHardhat()

    await deploymentHelper.connectYETIContracts(YETIContracts)
    await deploymentHelper.connectCoreContracts(contracts, YETIContracts)
    await deploymentHelper.connectYETIContractsToCore(YETIContracts, contracts)

    yusdToken = contracts.yusdToken
    yetiToken = YETIContracts.yetiToken
    sYetiToken = YETIContracts.sYETI;
    // console.log(sYetiToken.methods);
    console.log("Yeti Token address", yetiToken.address);
  })

  it("mint sYETI token", async () => {
    await yetiToken.unprotectedMint(alice, toBN(dec(200, 17)))

    await yetiToken.approve(sYetiToken.address, toBN(dec(200, 17)), {from: alice})
    console.log("63: yeti token address:", yetiToken.address);
    await sYetiToken.mint(toBN(dec(120, 17)), {from: alice})

    // Check balance
    assert.equal(toBN(dec(120, 17)).toString(), (await sYetiToken.balanceOf(alice)).toString())
    assert.equal(toBN(dec(80, 17)).toString(), (await yetiToken.balanceOf(alice)).toString())
  })

  it("mint sYETI token muti accounts", async () => {
    await yetiToken.unprotectedMint(alice, toBN(dec(200, 17)))
    await yetiToken.unprotectedMint(bob, toBN(dec(1000, 17)))
    await yetiToken.unprotectedMint(carol, toBN(dec(1000, 17)))

    await yetiToken.approve(sYetiToken.address, toBN(dec(200, 17)), {from: alice})
    await yetiToken.approve(sYetiToken.address, toBN(dec(1000, 17)), {from: bob})
    await yetiToken.approve(sYetiToken.address, toBN(dec(1000, 17)), {from: carol})

    await sYetiToken.mint(toBN(dec(100, 17)), {from: alice})
    await sYetiToken.mint(toBN(dec(100, 17)), {from: bob})

    await sYetiToken.mint(toBN(dec(100, 17)), {from: carol})
    await sYetiToken.mint(toBN(dec(100, 17)), {from: carol})
    // Check balance
    assert.equal(toBN(dec(100, 17)).toString(), (await sYetiToken.balanceOf(alice)).toString())
    assert.equal(toBN(dec(100, 17)).toString(), (await yetiToken.balanceOf(alice)).toString())

    assert.equal(toBN(dec(100, 17)).toString(), (await sYetiToken.balanceOf(bob)).toString())

    assert.equal(toBN(dec(200, 17)).toString(), (await sYetiToken.balanceOf(carol)).toString())

  })
  it("burn sYETI token muti accounts", async () => {
    await yetiToken.unprotectedMint(alice, toBN(dec(200, 17)))
    await yetiToken.unprotectedMint(bob, toBN(dec(1000, 17)))
    await yetiToken.unprotectedMint(carol, toBN(dec(1000, 17)))

    await yetiToken.approve(sYetiToken.address, toBN(dec(200, 17)), {from: alice})
    await yetiToken.approve(sYetiToken.address, toBN(dec(1000, 17)), {from: bob})
    await yetiToken.approve(sYetiToken.address, toBN(dec(1000, 17)), {from: carol})

    await sYetiToken.mint(toBN(dec(100, 17)), {from: alice})
    await sYetiToken.mint(toBN(dec(100, 17)), {from: bob})

    await sYetiToken.mint(toBN(dec(100, 17)), {from: carol})
    await sYetiToken.mint(toBN(dec(100, 17)), {from: carol})
    // Fastforward time 69 hours
    await ethers.provider.send('evm_increaseTime', [252000]); 
    await ethers.provider.send('evm_mine');

    await sYetiToken.burn(alice, toBN(dec(100, 17)), {from: alice})
    assert.equal(toBN(dec(0, 17)).toString(), (await sYetiToken.balanceOf(alice)).toString())
    assert.equal(toBN(dec(200, 17)).toString(), (await yetiToken.balanceOf(alice)).toString())

    assert.equal(toBN(dec(100, 17)).toString(), (await sYetiToken.balanceOf(bob)).toString())

    assert.equal(toBN(dec(200, 17)).toString(), (await sYetiToken.balanceOf(carol)).toString())

  })
  it("sYETI lockup testing", async () => {
    await yetiToken.unprotectedMint(alice, toBN(dec(200, 17)))
    await yetiToken.unprotectedMint(bob, toBN(dec(1000, 17)))
    await yetiToken.unprotectedMint(carol, toBN(dec(1000, 17)))

    await yetiToken.approve(sYetiToken.address, toBN(dec(200, 17)), {from: alice})
    await yetiToken.approve(sYetiToken.address, toBN(dec(1000, 17)), {from: bob})
    await yetiToken.approve(sYetiToken.address, toBN(dec(1000, 17)), {from: carol})

    await sYetiToken.mint(toBN(dec(100, 17)), {from: alice})
    await sYetiToken.mint(toBN(dec(100, 17)), {from: bob})

    await sYetiToken.mint(toBN(dec(100, 17)), {from: carol})
    await sYetiToken.mint(toBN(dec(100, 17)), {from: carol})
    

    assertRevert(sYetiToken.burn(alice, toBN(dec(100, 17)), {from: alice}))
    

  })
})
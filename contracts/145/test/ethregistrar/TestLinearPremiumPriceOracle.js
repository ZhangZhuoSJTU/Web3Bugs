const ENS = artifacts.require('./registry/ENSRegistry')
const BaseRegistrar = artifacts.require('./BaseRegistrarImplementation')
const DummyOracle = artifacts.require('./DummyOracle')
const LinearPremiumPriceOracle = artifacts.require('./LinearPremiumPriceOracle')

const namehash = require('eth-ens-namehash')
const sha3 = require('web3-utils').sha3
const toBN = require('web3-utils').toBN

const DAY = 86400

contract('LinearPremiumPriceOracle', function(accounts) {
  let priceOracle

  before(async () => {
    ens = await ENS.new()
    registrar = await BaseRegistrar.new(ens.address, namehash.hash('eth'))
    await ens.setSubnodeOwner('0x0', sha3('eth'), registrar.address)
    await registrar.addController(accounts[0])

    // Dummy oracle with 1 ETH == 2 USD
    var dummyOracle = await DummyOracle.new(toBN(200000000))
    // 4 attousd per second for 3 character names, 2 attousd per second for 4 character names,
    // 1 attousd per second for longer names.
    // Pricing premium starts out at 100 USD at expiry and decreases to 0 over 100k seconds (a bit over a day)
    const premium = toBN('100000000000000000000')
    const decreaseRate = toBN('1000000000000000')
    priceOracle = await LinearPremiumPriceOracle.new(
      dummyOracle.address,
      [0, 0, 4, 2, 1],
      premium,
      decreaseRate
    )
  })

  it('should report the correct premium and decrease rate', async () => {
    assert.equal(
      (await priceOracle.initialPremium()).toString(),
      '100000000000000000000'
    )
    assert.equal(
      (await priceOracle.premiumDecreaseRate()).toString(),
      '1000000000000000'
    )
  })

  it('should return correct base prices', async () => {
    assert.equal(parseInt((await priceOracle.price('foo', 0, 3600)).base), 7200)

    assert.equal(
      parseInt((await priceOracle.price('quux', 0, 3600)).base),
      3600
    )
    assert.equal(
      parseInt((await priceOracle.price('fubar', 0, 3600)).base),
      1800
    )
    assert.equal(
      parseInt((await priceOracle.price('foobie', 0, 3600)).base),
      1800
    )
  })

  it('should not specify a premium for first-time registrations', async () => {
    assert.equal((await priceOracle.premium('foobar', 0, 0)).toNumber(), 0)
    assert.equal(parseInt((await priceOracle.price('foobar', 0, 0)).base), 0)
  })

  it('should not specify a premium for renewals', async () => {
    const ts = (await web3.eth.getBlock('latest')).timestamp
    assert.equal((await priceOracle.premium('foobar', ts, 0)).toNumber(), 0)
    assert.equal(parseInt((await priceOracle.price('foobar', ts, 0)).base), 0)
  })

  it('should specify the maximum premium at the moment of expiration', async () => {
    const ts = (await web3.eth.getBlock('latest')).timestamp - 90 * DAY
    assert.equal(
      (await priceOracle.premium('foobar', ts, 0)).toString(),
      '50000000000000000000'
    )
    assert.equal(
      (await priceOracle.price('foobar', ts, 0)).premium,
      '50000000000000000000'
    )
  })

  it('should specify half the premium after half the interval', async () => {
    const ts =
      (await web3.eth.getBlock('latest')).timestamp - (90 * DAY + 50000)
    assert.equal(
      (await priceOracle.premium('foobar', ts, 0)).toString(),
      '25000000000000000000'
    )
    assert.equal(
      (await priceOracle.price('foobar', ts, 0)).premium,
      '25000000000000000000'
    )
  })

  it('should return correct times for price queries', async () => {
    const initialPremiumWei = toBN('50000000000000000000')
    const ts = await priceOracle.timeUntilPremium(0, initialPremiumWei)
    assert.equal(ts.toNumber(), 90 * DAY)
    const ts2 = await priceOracle.timeUntilPremium(0, 0)
    assert.equal(ts2.toNumber(), 90 * DAY + 100000)
  })
})

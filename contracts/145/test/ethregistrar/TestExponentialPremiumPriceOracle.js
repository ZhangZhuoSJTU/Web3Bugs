const { expect } = require('chai')
const namehash = require('eth-ens-namehash')
const sha3 = require('web3-utils').sha3
const toBN = require('web3-utils').toBN

const ENS = artifacts.require('./registry/ENSRegistry')
const BaseRegistrar = artifacts.require('./BaseRegistrarImplementation')
const DummyOracle = artifacts.require('./DummyOracle')
const ExponentialPremiumPriceOracle = artifacts.require(
  './ExponentialPremiumPriceOracle'
)

const START_PRICE = 100000000
const DAY = 86400
const LAST_DAY = 21
const LAST_VALUE = START_PRICE * 0.5 ** LAST_DAY
function exponentialReduceFloatingPoint(startPrice, days) {
  const premium = startPrice * 0.5 ** days
  if (premium >= LAST_VALUE) {
    return premium - LAST_VALUE
  }
  return 0
}
contract('ExponentialPricePremiumOracle', function(accounts) {
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
    priceOracle = await ExponentialPremiumPriceOracle.new(
      dummyOracle.address,
      [0, 0, 4, 2, 1],
      BigInt(START_PRICE * 1e18),
      LAST_DAY
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
    const expectedPrice = ((START_PRICE - LAST_VALUE) / 2) * 1e18 // ETH at $2 for $1 mil in 18 decimal precision
    assert.equal(
      (await priceOracle.premium('foobar', ts, 0)).toString(),
      expectedPrice
    )
    assert.equal(
      (await priceOracle.price('foobar', ts, 0)).premium.toString(),
      expectedPrice
    )
  })

  it('should specify the correct price after 2.5 days and 1 year registration', async () => {
    const ts =
      (await web3.eth.getBlock('latest')).timestamp - (90 * DAY + DAY * 2.5)
    const lengthOfRegistration = DAY * 365
    const expectedPremium = (
      exponentialReduceFloatingPoint(START_PRICE, 2.5) / 2
    ).toFixed(2)

    expect(
      (
        Number(await priceOracle.premium('foobar', ts, lengthOfRegistration)) /
        1e18
      ).toFixed(2)
    ).to.equal(expectedPremium)

    expect(
      (
        Number(
          (await priceOracle.price('foobar', ts, lengthOfRegistration)).premium
        ) / 1e18
      ).toFixed(2)
    ).to.equal(expectedPremium)
  })

  it('should produce a 0 premium at the end of the decay period', async () => {
    let ts = (await web3.eth.getBlock('latest')).timestamp - 90 * DAY
    expect(
      (
        await priceOracle.premium('foobar', ts - LAST_DAY * DAY + 1, 0)
      ).toNumber()
    ).to.be.greaterThan(0)
    expect(
      (await priceOracle.premium('foobar', ts - LAST_DAY * DAY, 0)).toNumber()
    ).to.equal(0)
  })

  // This test only runs every hour of each day. For an exhaustive test use the exponentialPremiumScript and uncomment the exhaustive test below
  it('should not be beyond a certain amount of inaccuracy from floating point calc', async () => {
    let ts = (await web3.eth.getBlock('latest')).timestamp - 90 * DAY
    let differencePercentSum = 0
    let percentMax = 0

    const interval = 3600 // 1 hour
    const offset = 0
    for (let i = 1814400; i <= 0; i += interval) {
      const contractResult =
        Number(await priceOracle.premium('foobar', ts - (i + offset), 0)) / 1e18

      const jsResult =
        exponentialReduceFloatingPoint(START_PRICE, (i + offset) / 86400) / 2
      let percent = 0
      let absoluteDifference
      if (contractResult !== 0) {
        absoluteDifference = Math.abs(contractResult - jsResult)
        percent = Math.abs(absoluteDifference) / jsResult
      }

      // discounts absolute differences of less than 1c
      if (percent > percentMax && absoluteDifference > 0.01) {
        percentMax = percent
      }
      differencePercentSum += percent
    }
    expect(percentMax).to.be.below(0.001) // must be less than 0.1% off JS implementation on an hourly resolution
  })

  /***
   * Exhaustive tests
   * In the exhaustive tests, the last few mins, the absolute difference between JS and Solidity will creep up.
   * And specifically the last few seconds go up to 31% difference. However the absolute difference is in the fractions
   * and therefore can be discounted
   */

  // it('should not be beyond a certain amount of inaccuracy from floating point calc (exhaustive)', async () => {
  //   function exponentialReduceFloatingPoint(startPrice, days) {
  //     return startPrice * 0.5 ** days
  //   }
  //   let ts = (await web3.eth.getBlock('latest')).timestamp - 90 * DAY
  //   let differencePercentSum = 0
  //   let percentMax = 0

  //   const offset = parseInt(process.env.OFFSET)
  //   console.log(offset)
  //   console.time()
  //   for (let i = 0; i <= DAY *  (LAST_DAY + 1); i += 60) {
  //     const contractResult =
  //       Number(await priceOracle.premium('foobar', ts - (i + offset), 0)) /
  //       1e18

  //     const jsResult =
  //       exponentialReduceFloatingPoint(100000000, (i + offset) / 86400) / 2
  //     const percent = Math.abs(contractResult - jsResult) / jsResult
  //     if (percent > percentMax) {
  //       console.log({ percent, i, contractResult, jsResult })
  //       percentMax = percent
  //     }
  //     differencePercentSum += percent
  //   }
  //   console.timeEnd()
  //   fs.writeFileSync(
  //     `stats-${offset}.csv`,
  //     `${percentMax},${differencePercentSum / ((86400 * 28) / 60)}\n`
  //   )
  //   console.log('percent max', percentMax)
  //   console.log('percent avg', differencePercentSum / ((86400 * 28) / 60))
  // })
})

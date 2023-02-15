const BigNumber = require('bignumber.js')
const { constants, tokens, protocols } = require('hardlydifficult-eth')
const { time } = require('@openzeppelin/test-helpers')
const deployLocks = require('../helpers/deployLocks')

const Unlock = artifacts.require('Unlock.sol')
const UnlockDiscountToken = artifacts.require('UnlockDiscountToken.sol')
const PublicLock = artifacts.require('PublicLock')

let unlock
let udt
let lock

const estimateGas = 252166 * 2

contract('UnlockDiscountToken (mainnet) / mintingTokens', (accounts) => {
  const [lockOwner, protocolOwner, minter, referrer, keyBuyer] = accounts
  let rate

  beforeEach(async () => {
    unlock = await Unlock.new()
    await unlock.initialize(protocolOwner)
    const lockTemplate = await PublicLock.new()
    await unlock.setLockTemplate(lockTemplate.address, { from: protocolOwner })
    udt = await UnlockDiscountToken.new()
    await udt.initialize(minter)
    lock = (await deployLocks(unlock, lockOwner)).FIRST

    // Grant Unlock minting permissions
    await udt.addMinter(unlock.address, { from: minter })

    // Deploy the exchange
    const weth = await tokens.weth.deploy(web3, protocolOwner)
    const uniswapRouter = await protocols.uniswapV2.deploy(
      web3,
      protocolOwner,
      constants.ZERO_ADDRESS,
      weth.address
    )
    // Create UDT <-> WETH pool
    await udt.mint(minter, web3.utils.toWei('1000000', 'ether'), {
      from: minter,
    })
    await udt.approve(uniswapRouter.address, constants.MAX_UINT, {
      from: minter,
    })
    await uniswapRouter.addLiquidityETH(
      udt.address,
      web3.utils.toWei('1000000', 'ether'),
      '1',
      '1',
      minter,
      constants.MAX_UINT,
      { from: minter, value: web3.utils.toWei('40', 'ether') }
    )

    const uniswapOracle = await protocols.uniswapOracle.deploy(
      web3,
      protocolOwner,
      await uniswapRouter.factory()
    )

    // Advancing time to avoid an intermittent test fail
    await time.increase(time.duration.hours(1))

    // Do a swap so there is some data accumulated
    await uniswapRouter.swapExactETHForTokens(
      1,
      [weth.address, udt.address],
      minter,
      constants.MAX_UINT,
      { from: minter, value: web3.utils.toWei('1', 'ether') }
    )

    // Config in Unlock
    await unlock.configUnlock(
      udt.address,
      weth.address,
      estimateGas,
      await unlock.globalTokenSymbol(),
      await unlock.globalBaseTokenURI(),
      1, // mainnet
      { from: protocolOwner }
    )
    await unlock.setOracle(udt.address, uniswapOracle.address, {
      from: protocolOwner,
    })

    // Advance time so 1 full period has past and then update again so we have data point to read
    await time.increase(time.duration.hours(30))
    await uniswapOracle.update(weth.address, udt.address, {
      from: protocolOwner,
    })

    // Purchase a valid key for the referrer
    await lock.purchase(0, referrer, constants.ZERO_ADDRESS, [], {
      from: referrer,
      value: await lock.keyPrice(),
    })

    rate = await uniswapOracle.consult(
      udt.address,
      web3.utils.toWei('1', 'ether'),
      weth.address
    )
  })

  it('exchange rate is > 0', async () => {
    assert.notEqual(web3.utils.fromWei(rate.toString(), 'ether'), 0)
    // 1 UDT is worth ~0.000042 ETH
    assert.equal(new BigNumber(rate).shiftedBy(-18).toFixed(5), '0.00004')
  })

  it('referrer has 0 UDT to start', async () => {
    const actual = await udt.balanceOf(referrer)
    assert.equal(actual.toString(), 0)
  })

  it('owner starts with 0 UDT', async () => {
    assert.equal(
      new BigNumber(await udt.balanceOf(await unlock.owner())).toFixed(),
      '0'
    )
  })

  describe('mint by gas price', () => {
    let gasSpent

    beforeEach(async () => {
      const tx = await lock.purchase(0, keyBuyer, referrer, [], {
        from: keyBuyer,
        value: await lock.keyPrice(),
      })
      const transaction = await web3.eth.getTransaction(tx.tx)
      // using estimatedGas instead of the actual gas used so this test does not regress as other features are implemented
      gasSpent = new BigNumber(transaction.gasPrice).times(estimateGas)
    })

    it('referrer has some UDT now', async () => {
      const actual = await udt.balanceOf(referrer)
      assert.notEqual(actual.toString(), 0)
    })

    it('amount minted for referrer ~= gas spent', async () => {
      // 120 UDT minted * 0.000042 ETH/UDT == 0.005 ETH spent
      assert.equal(
        new BigNumber(await udt.balanceOf(referrer))
          .shiftedBy(-18) // shift UDT balance
          .times(rate)
          .shiftedBy(-18) // shift the rate
          .toFixed(3),
        gasSpent.shiftedBy(-18).toFixed(3)
      )
    })

    it('amount minted for dev ~= gas spent * 20%', async () => {
      assert.equal(
        new BigNumber(await udt.balanceOf(await unlock.owner()))
          .shiftedBy(-18) // shift UDT balance
          .times(rate)
          .shiftedBy(-18) // shift the rate
          .toFixed(3),
        gasSpent.times(0.25).shiftedBy(-18).toFixed(3)
      )
    })
  })

  describe('mint capped by % growth', () => {
    beforeEach(async () => {
      // 1,000,000 UDT minted thus far
      // Test goal: 10 UDT minted for the referrer (less than the gas cost equivalent of ~120 UDT)
      // keyPrice / GNP / 2 = 10 * 1.25 / 1,000,000 == 40,000 * keyPrice

      const initialGdp = new BigNumber(await lock.keyPrice()).times(40000)
      await unlock.resetTrackedValue(initialGdp.toFixed(0), 0, {
        from: protocolOwner,
      })

      await lock.purchase(0, keyBuyer, referrer, [], {
        from: keyBuyer,
        value: await lock.keyPrice(),
      })
    })

    it('referrer has some UDT now', async () => {
      const actual = await udt.balanceOf(referrer)
      assert.notEqual(actual.toString(), 0)
    })

    it('amount minted for referrer ~= 10 UDT', async () => {
      assert.equal(
        new BigNumber(await udt.balanceOf(referrer)).shiftedBy(-18).toFixed(0),
        '10'
      )
    })

    it('amount minted for dev ~= 2 UDT', async () => {
      assert.equal(
        new BigNumber(await udt.balanceOf(await unlock.owner()))
          .shiftedBy(-18)
          .toFixed(0),
        '2'
      )
    })
  })
})

const BigNumber = require('bignumber.js')
const { constants, tokens, protocols } = require('hardlydifficult-eth')
const { time } = require('@openzeppelin/test-helpers')
const deployLocks = require('../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../helpers/proxy')

const keyPrice = web3.utils.toWei('0.01', 'ether')

let unlock
let locks
let lock
let token

contract('Unlock / uniswapValue', (accounts) => {
  const [keyOwner, liquidityOwner, protocolOwner] = accounts

  beforeEach(async () => {
    unlock = await getProxy(unlockContract)
  })

  describe('A supported token', () => {
    beforeEach(async () => {
      token = await tokens.dai.deploy(web3, protocolOwner)
      // Mint some tokens so that the totalSupply is greater than 0
      await token.mint(keyOwner, web3.utils.toWei('10000', 'ether'), {
        from: protocolOwner,
      })

      locks = await deployLocks(unlock, protocolOwner, token.address)
      lock = locks.FIRST

      // Deploy the exchange
      const weth = await tokens.weth.deploy(web3, protocolOwner)
      const uniswapRouter = await protocols.uniswapV2.deploy(
        web3,
        protocolOwner,
        constants.ZERO_ADDRESS,
        weth.address
      )
      // Create DAI <-> WETH pool
      await token.mint(liquidityOwner, web3.utils.toWei('100000', 'ether'), {
        from: protocolOwner,
      })
      await token.approve(uniswapRouter.address, constants.MAX_UINT, {
        from: liquidityOwner,
      })
      await uniswapRouter.addLiquidityETH(
        token.address,
        web3.utils.toWei('2000', 'ether'),
        '1',
        '1',
        liquidityOwner,
        constants.MAX_UINT,
        { from: liquidityOwner, value: web3.utils.toWei('10', 'ether') }
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
        [weth.address, token.address],
        keyOwner,
        constants.MAX_UINT,
        { from: keyOwner, value: web3.utils.toWei('1', 'ether') }
      )

      // Config in Unlock
      await unlock.configUnlock(
        await unlock.udt(),
        weth.address,
        await unlock.estimatedGasForPurchase(),
        await unlock.globalTokenSymbol(),
        await unlock.globalBaseTokenURI(),
        1 // mainnet
      )
      await unlock.setOracle(token.address, uniswapOracle.address)

      // Advance time so 1 full period has past and then update again so we have data point to read
      await time.increase(time.duration.hours(30))
    })

    describe('Purchase key', () => {
      let gdpBefore

      beforeEach(async () => {
        gdpBefore = new BigNumber(await unlock.grossNetworkProduct())

        await token.approve(lock.address, keyPrice, { from: keyOwner })
        await lock.purchase(keyPrice, keyOwner, web3.utils.padLeft(0, 40), [], {
          from: keyOwner,
        })
      })

      it('GDP went up by the expected ETH value', async () => {
        const gdp = new BigNumber(await unlock.grossNetworkProduct())
        // 0.01 DAI is ~0.00006 ETH
        assert.equal(
          gdp.shiftedBy(-18).toFixed(5),
          gdpBefore
            .plus(web3.utils.toWei('0.00006', 'ether'))
            .shiftedBy(-18)
            .toFixed(5)
        )
      })
    })
  })

  describe('A unsupported token', () => {
    beforeEach(async () => {
      token = await tokens.dai.deploy(web3, protocolOwner)
      // Mint some tokens so that the totalSupply is greater than 0
      await token.mint(keyOwner, web3.utils.toWei('10000', 'ether'), {
        from: protocolOwner,
      })

      locks = await deployLocks(unlock, protocolOwner, token.address)
      lock = locks.FIRST
    })

    describe('Purchase key', () => {
      let gdpBefore

      beforeEach(async () => {
        gdpBefore = new BigNumber(await unlock.grossNetworkProduct())

        await token.approve(lock.address, keyPrice, { from: keyOwner })

        await lock.purchase(keyPrice, keyOwner, web3.utils.padLeft(0, 40), [], {
          from: keyOwner,
        })
      })

      it('GDP did not change', async () => {
        const gdp = new BigNumber(await unlock.grossNetworkProduct())
        assert.equal(gdp.toFixed(), gdpBefore.toFixed())
      })
    })
  })

  describe('ETH', () => {
    beforeEach(async () => {
      locks = await deployLocks(unlock, protocolOwner)
      lock = locks.FIRST
    })

    describe('Purchase key', () => {
      let gdpBefore

      beforeEach(async () => {
        gdpBefore = new BigNumber(await unlock.grossNetworkProduct())

        await lock.purchase(keyPrice, keyOwner, web3.utils.padLeft(0, 40), [], {
          from: keyOwner,
          value: keyPrice,
        })
      })

      it('GDP went up by the keyPrice', async () => {
        const gdp = new BigNumber(await unlock.grossNetworkProduct())
        assert.equal(gdp.toFixed(), gdpBefore.plus(keyPrice).toFixed())
      })
    })
  })
})

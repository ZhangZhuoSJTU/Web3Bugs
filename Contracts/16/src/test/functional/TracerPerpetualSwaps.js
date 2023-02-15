const { expect, assert } = require("chai")
const { ethers, getNamedAccounts, deployments, network } = require("hardhat")
const { deploy } = deployments
const { time } = require("@openzeppelin/test-helpers")
const tracerAbi = require("../../abi/contracts/TracerPerpetualSwaps.sol/TracerPerpetualSwaps.json")
const insuranceAbi = require("../../abi/contracts/Insurance.sol/Insurance.json")
const pricingAbi = require("../../abi/contracts/Pricing.sol/Pricing.json")
const liquidationAbi = require("../../abi/contracts/Liquidation.sol/Liquidation.json")
const tokenAbi = require("../../abi/contracts/TestToken.sol/TestToken.json")
const { BN } = require("@openzeppelin/test-helpers/src/setup")

// create hardhat optimised feature
const setup = deployments.createFixture(async () => {
    const { deployer } = await getNamedAccounts()

    // deploy contracts
    await deployments.fixture(["FullDeployTest"])
    let Factory = await deployments.get("TracerPerpetualsFactory")
    let factory = await ethers.getContractAt(Factory.abi, Factory.address)
    let tracerAddress = await factory.tracersByIndex(0)
    let tracer = await ethers.getContractAt(tracerAbi, tracerAddress)

    // setup mocks for the contracts and relink
    const Insurance = await tracer.insuranceContract()
    let insurance = await ethers.getContractAt(insuranceAbi, Insurance)

    const Pricing = await tracer.pricingContract()
    let pricing = await ethers.getContractAt(pricingAbi, Pricing)

    const Liquidation = await tracer.liquidationContract()
    let liquidation = await ethers.getContractAt(liquidationAbi, Liquidation)

    const QuoteToken = await tracer.tracerQuoteToken()
    let quoteToken = await ethers.getContractAt(tokenAbi, QuoteToken)

    const traderDeployment = await deployments.get("Trader")
    let traderInstance = await ethers.getContractAt(
        traderDeployment.abi,
        traderDeployment.address
    )

    return {
        tracer,
        insurance,
        pricing,
        liquidation,
        quoteToken,
        deployer,
        factory,
        traderInstance,
    }
})

const forwardTime = async (seconds) => {
    await network.provider.send("evm_increaseTime", [seconds])
    await network.provider.send("evm_mine", [])
}

const compareAccountState = (state, expectedState) => {
    expect(state.position.quote).to.equal(expectedState.position.quote)
    expect(state.position.base).to.equal(expectedState.position.base)
    expect(state.totalLeveragedValue).to.equal(
        expectedState.totalLeveragedValue
    )
    expect(state.lastUpdatedIndex).to.equal(expectedState.lastUpdatedIndex)
    expect(state.lastUpdatedGasPrice).to.equal(
        expectedState.lastUpdatedGasPrice
    )
}

describe("Functional tests: TracerPerpetualSwaps.sol", function () {
    let accounts, deployer
    let insurance, pricing, liquidation, tracer, quoteToken, traderInstance
    let now

    before(async function () {
        const _setup = await setup()
        quoteToken = _setup.quoteToken
        tracer = _setup.tracer
        insurance = _setup.insurance
        pricing = _setup.pricing
        liquidation = _setup.liquidation
        deployer = _setup.deployer
        traderInstance = _setup.traderInstance
        accounts = await ethers.getSigners()
        // transfer tokesn to account 4
        await quoteToken.transfer(
            accounts[4].address,
            ethers.utils.parseEther("1000")
        )
        now = Math.floor(new Date().getTime() / 1000)
    })

    context("Regular Trading over 24 hours", async () => {
        describe("when markets are operating as normal", async () => {
            it("passes", async () => {
                // deposit from 4 accounts
                for (var i = 0; i < 4; i++) {
                    await quoteToken
                        .connect(accounts[i + 1])
                        .approve(
                            tracer.address,
                            ethers.utils.parseEther("1000")
                        )
                    await tracer
                        .connect(accounts[i + 1])
                        .deposit(ethers.utils.parseEther("1000"))
                }

                // make some basic trades
                let order1 = {
                    maker: accounts[1].address,
                    market: tracer.address,
                    price: ethers.utils.parseEther("1"),
                    amount: ethers.utils.parseEther("50"),
                    side: 0, // long,
                    expires: now + 604800, // now + 7 days
                    created: now - 1,
                }
                const mockSignedOrder1 = [
                    order1,
                    ethers.utils.formatBytes32String("DummyString"),
                    ethers.utils.formatBytes32String("DummyString"),
                    0,
                ]

                let order2 = {
                    maker: accounts[2].address,
                    market: tracer.address,
                    price: ethers.utils.parseEther("0.9"),
                    amount: ethers.utils.parseEther("40"),
                    side: 1, // short,
                    expires: now + 604800, // now + 7 days
                    created: now,
                }
                const mockSignedOrder2 = [
                    order2,
                    ethers.utils.formatBytes32String("DummyString"),
                    ethers.utils.formatBytes32String("DummyString"),
                    0,
                ]

                let order3 = {
                    maker: accounts[3].address,
                    market: tracer.address,
                    price: ethers.utils.parseEther("0.9"),
                    amount: ethers.utils.parseEther("10"),
                    side: 1, // short,
                    expires: now + 604800, // now + 7 days
                    created: now,
                }
                const mockSignedOrder3 = [
                    order3,
                    ethers.utils.formatBytes32String("DummyString"),
                    ethers.utils.formatBytes32String("DummyString"),
                    0,
                ]

                let order4 = {
                    maker: accounts[1].address,
                    market: tracer.address,
                    price: ethers.utils.parseEther("1.25"),
                    amount: ethers.utils.parseEther("50"),
                    side: 0, // long,
                    expires: now + 604800, // now + 7 days
                    created: now - 1,
                }
                const mockSignedOrder4 = [
                    order4,
                    ethers.utils.formatBytes32String("DummyString"),
                    ethers.utils.formatBytes32String("DummyString"),
                    0,
                ]

                let order5 = {
                    maker: accounts[2].address,
                    market: tracer.address,
                    price: ethers.utils.parseEther("1.10"),
                    amount: ethers.utils.parseEther("10"),
                    side: 1, // short,
                    expires: now + 604800, // now + 7 days
                    created: now,
                }
                const mockSignedOrder5 = [
                    order5,
                    ethers.utils.formatBytes32String("DummyString"),
                    ethers.utils.formatBytes32String("DummyString"),
                    0,
                ]

                // STATE 1:
                // hour = 0
                // funding index = 0

                // check pricing is in hour 0
                let currentHour = await pricing.currentHour()
                expect(currentHour).to.equal(0)

                // place trades
                await traderInstance.executeTrade(
                    [mockSignedOrder1],
                    [mockSignedOrder2]
                )
                await traderInstance.clearFilled(mockSignedOrder1)
                await traderInstance.clearFilled(mockSignedOrder2)
                await traderInstance.executeTrade(
                    [mockSignedOrder1],
                    [mockSignedOrder3]
                )
                await traderInstance.clearFilled(mockSignedOrder1)
                await traderInstance.clearFilled(mockSignedOrder3)

                // check account state
                let account1 = await tracer.balances(accounts[1].address)
                let account2 = await tracer.balances(accounts[2].address)
                let account3 = await tracer.balances(accounts[3].address)

                // gas price = fast gas in gwei * cost per eth
                // $3000 * 20 gwei fast gas = (3000 / 10^18) * (20 * 10^9)
                // = 3000 * 20 * 10^-9 gwei gas / usd = 0.00006 USD / GAS
                let lastUpdatedGas = "60000000000000"
                let account1Expected = {
                    position: {
                        quote: ethers.utils.parseEther("950"),
                        base: ethers.utils.parseEther("50"),
                    },
                    totalLeveragedValue: 0,
                    lastUpdatedIndex: 0,
                    lastUpdatedGasPrice: lastUpdatedGas,
                }
                let account2Expected = {
                    position: {
                        quote: ethers.utils.parseEther("1040"),
                        base: ethers.utils.parseEther("-40"),
                    },
                    totalLeveragedValue: 0,
                    lastUpdatedIndex: 0,
                    lastUpdatedGasPrice: lastUpdatedGas,
                }
                let account3Expected = {
                    position: {
                        quote: ethers.utils.parseEther("1010"),
                        base: ethers.utils.parseEther("-10"),
                    },
                    totalLeveragedValue: 0,
                    lastUpdatedIndex: 0,
                    lastUpdatedGasPrice: lastUpdatedGas,
                }

                compareAccountState(account1, account1Expected)
                compareAccountState(account2, account2Expected)
                compareAccountState(account3, account3Expected)

                // time travel forward to check pricing state
                await forwardTime(60 * 60 + 100)

                // STATE 2:
                // hour = 1
                // funding index = 1

                // make trade in new hour to tick over funding index
                await traderInstance.executeTrade(
                    [mockSignedOrder4],
                    [mockSignedOrder5]
                )
                await traderInstance.clearFilled(mockSignedOrder4)
                await traderInstance.clearFilled(mockSignedOrder5)

                // check pricing is in hour 1
                currentHour = await pricing.currentHour()
                expect(currentHour).to.equal(1)

                // check funding index is 2
                let fundingIndex = await pricing.currentFundingIndex()
                expect(fundingIndex).to.equal(1)

                // check pricing state
                // derivative price should be the price of the first created trade
                // above (eg account1 long in both trade cases)
                // underlying price should be oracle price of $1
                let twap = await pricing.getTWAPs(0)
                let expectedUnderlying = ethers.utils.parseEther("1")
                let expectedDerivative = ethers.utils.parseEther("1")
                expect(twap[0].toString()).to.equal(
                    expectedUnderlying.toString()
                )
                expect(twap[1].toString()).to.equal(
                    expectedDerivative.toString()
                )

                // time travel forward 2 hours without any trades happening
                await forwardTime(120 * 60 + 100)

                // STATE 3:
                // hour = 2
                // funding index = 2

                await traderInstance.executeTrade(
                    [mockSignedOrder1],
                    [mockSignedOrder2]
                )
                await traderInstance.clearFilled(mockSignedOrder1)
                await traderInstance.clearFilled(mockSignedOrder2)

                // check pricing is in hour 2 (hours with no trades are ignored currently)
                currentHour = await pricing.currentHour()
                expect(currentHour).to.equal(2)

                // check funding index is 3
                fundingIndex = await pricing.currentFundingIndex()
                expect(fundingIndex).to.equal(2)

                // check pricing state
                // derivative price should be the price of the first created trade
                // above (eg trade 4 long price)
                // underlying price should be oracle price of $1
                // twap = 7 * hour 0 ($1) + 8 * hour 1 ($1.25) / 8+7 = 1.13333333333
                let twap2 = await pricing.getTWAPs(1)
                let expectedUnderlying2 = ethers.utils.parseEther("1")
                let expectedDerivative2 = ethers.utils.parseEther(
                    "1.133333333333333333"
                )
                expect(twap2[0].toString()).to.equal(
                    expectedUnderlying2.toString()
                )
                expect(twap2[1].toString()).to.equal(
                    expectedDerivative2.toString()
                )

                // settle accounts and measure funding rate affect
                // fundingRate = derivative twap - underlying twap - time value
                // $1.1333 - $1 - 0 = 0.1333
                let expectedFundingRate = ethers.utils.parseEther(
                    "0.133333333333333333"
                )
                fundingIndex = await pricing.currentFundingIndex()
                let fundingRate = await pricing.fundingRates(fundingIndex - 1)

                // previous funding rate was 0, so instant and cumulative should be same
                expect(fundingRate.cumulativeFundingRate).to.equal(
                    expectedFundingRate
                )
                expect(fundingRate.fundingRate).to.equal(expectedFundingRate)

                // settle and check account 3
                let balanceBeforeSettle = await tracer.balances(
                    accounts[3].address
                )
                // account 3 last updated 2 indexes ago at fundingRateIndex 0
                expect(balanceBeforeSettle.lastUpdatedIndex).to.equal(
                    fundingIndex - 2
                )
                await tracer.settle(accounts[3].address)
                let balanceAfterSettle = await tracer.balances(
                    accounts[3].address
                )
                // funding rate * base
                // account 3 has 10 units short --> should receive funding
                let expectedDifference = expectedFundingRate
                    .mul(ethers.utils.parseEther("10"))
                    .div(ethers.utils.parseEther("1"))
                expect(
                    balanceAfterSettle.position.quote.sub(
                        balanceBeforeSettle.position.quote
                    )
                ).to.equal(expectedDifference)
            })
        })
    })
})

const { expect } = require("chai")
const { ethers, getNamedAccounts, deployments } = require("hardhat")
const { deploy } = deployments
const { smockit } = require("@eth-optimism/smock")
const { BigNumber } = require("ethers")
const zeroAddress = "0x0000000000000000000000000000000000000000"

const getCollaterals = async (insurance) => [
    (await insurance.bufferCollateralAmount()).toString(),
    (await insurance.publicCollateralAmount()).toString(),
]

const putCollateral = async (
    tracer,
    testToken,
    insurance,
    bufferValue,
    publicValue
) => {
    tracer.smocked.getBalance.will.return.with({
        position: { quote: ethers.utils.parseEther(bufferValue), base: 0 }, // quote, base
        totalLeveragedValue: 0, // total leverage
        lastUpdatedIndex: 0, // last updated index
        lastUpdatedGasPrice: 0, // last updated gas price
    })

    await insurance.updatePoolAmount()

    // Set getBalance to return 0 so that updatePoolAmount doesn't add more
    // to buffer (what was in the balance already added)
    tracer.smocked.getBalance.will.return.with({
        position: { quote: 0, base: 0 }, // quote, base
        totalLeveragedValue: 0, // total leverage
        lastUpdatedIndex: 0, // last updated index
        lastUpdatedGasPrice: 0, // last updated gas price
    })

    await testToken.approve(
        insurance.address,
        ethers.utils.parseEther(publicValue)
    )

    await insurance.deposit(ethers.utils.parseEther(publicValue))

    return await getCollaterals(insurance)
}

const putAndTakeCollateral = async (
    tracer,
    testToken,
    insurance,
    bufferValue,
    publicValue,
    amountToDrain
) => {
    await putCollateral(tracer, testToken, insurance, bufferValue, publicValue)

    await insurance.drainPool(ethers.utils.parseEther(amountToDrain))

    return await getCollaterals(insurance)
}

// create hardhat optimised feature
const setup = deployments.createFixture(async () => {
    const { deployer } = await getNamedAccounts()
    _deployer = deployer
    // deploy a test token
    const TestToken = await ethers.getContractFactory("TestToken")
    let testToken = await TestToken.deploy(ethers.utils.parseEther("100000000"))
    await testToken.deployed()

    // deploy mock tracer and libs
    let libBalances = await deploy("Balances", {
        from: deployer,
        log: true,
    })

    let libPerpetuals = await deploy("Perpetuals", {
        from: deployer,
        log: true,
    })

    let libPrices = await deploy("Prices", {
        from: deployer,
        log: true,
    })

    // this deploy method is needed for mocking
    const tracerContractFactory = await ethers.getContractFactory(
        "TracerPerpetualSwaps"
    )

    let deleveragingCliff = ethers.utils.parseEther("20") // 20 percent
    let lowestMaxLeverage = ethers.utils.parseEther("12.5") // Default -> Doesn't go down
    let _insurancePoolSwitchStage = ethers.utils.parseEther("1") // Switches mode at 1%
    const tracer = await tracerContractFactory.deploy(
        ethers.utils.formatBytes32String("TEST/USD"),
        testToken.address,
        18,
        zeroAddress,
        1,
        1,
        1,
        zeroAddress,
        deleveragingCliff,
        lowestMaxLeverage,
        _insurancePoolSwitchStage
    )

    let mockTracer = await smockit(tracer)

    // mock tracer calls that are needed
    // get balance for this account to return 0
    // NOTE: If any test changes mocks, due to Hardhat fixture optimisations,
    // the mock defaults set here WILL NOT be returned. You need to manually
    // change the mock state back to its expected value at the end of the test.
    mockTracer.smocked.getBalance.will.return.with({
        position: { quote: 0, base: 0 }, //quote, base
        totalLeveragedValue: 0, //total leverage
        lastUpdatedIndex: 0, //last updated index
        lastUpdatedGasPrice: 0, //last updated gas price
    })

    // token to return the testToken address
    mockTracer.smocked.tracerQuoteToken.will.return.with(testToken.address)

    // leveraged notional value to return 100
    mockTracer.smocked.leveragedNotionalValue.will.return.with(
        ethers.utils.parseEther("100")
    )

    // quote token decimals
    mockTracer.smocked.quoteTokenDecimals.will.return.with(18)

    // deposit and withdraw to return nothing
    mockTracer.smocked.deposit.will.return()
    mockTracer.smocked.withdraw.will.return()

    // deploy insurance using mock tracer
    const Insurance = await ethers.getContractFactory("Insurance")
    let insurance = await Insurance.deploy(mockTracer.address)
    await insurance.deployed()
    return {
        testToken,
        mockTracer,
        insurance,
    }
})

describe("Unit tests: Insurance.sol", function () {
    let accounts
    let testToken
    let mockTracer
    let insurance

    beforeEach(async function () {
        const _setup = await setup()
        testToken = _setup.testToken
        mockTracer = _setup.mockTracer
        insurance = _setup.insurance
        accounts = await ethers.getSigners()
    })

    describe("constructor", async () => {
        context("when sucessfully deployed", async () => {
            it("deploys a new pool token", async () => {
                let poolToken = await insurance.token()
                expect(poolToken.toString()).to.not.equal(
                    zeroAddress.toString()
                )
            })
            it("uses the same collateral as the quote of the market", async () => {
                let collateralToken = await insurance.collateralAsset()
                expect(collateralToken.toString()).to.equal(testToken.address)
            })
            it("emits a pool created event", async () => {})
        })
    })

    describe("deposit", async () => {
        context("when the user does not have enough tokens", async () => {
            it("reverts", async () => {
                await expect(
                    insurance.deposit(ethers.utils.parseEther("1"))
                ).to.be.revertedWith("ERC20: transfer amount exceeds allowance")
            })
        })

        context("when the user has enough tokens", async () => {
            beforeEach(async () => {
                await testToken.approve(
                    insurance.address,
                    ethers.utils.parseEther("1")
                )
                await insurance.deposit(ethers.utils.parseEther("1"))
            })

            it("mints them pool tokens", async () => {
                let poolTokenHolding = await insurance.getPoolUserBalance(
                    accounts[0].address
                )
                expect(poolTokenHolding).to.equal(ethers.utils.parseEther("1"))
            })

            it("increases the collateral holding of the insurance fund", async () => {
                let collateralHolding = await insurance.publicCollateralAmount()
                expect(collateralHolding).to.equal(ethers.utils.parseEther("1"))
            })

            it("pulls in collateral from the tracer market", async () => {
                let balanceCalls = mockTracer.smocked.getBalance.calls.length
                expect(balanceCalls).to.equal(1)
            })

            it("emits an insurance deposit event", async () => {
                await testToken.approve(
                    insurance.address,
                    ethers.utils.parseEther("1")
                )
                expect(await insurance.deposit(ethers.utils.parseEther("1")))
                    .to.emit(insurance, "InsuranceDeposit")
                    .withArgs(
                        mockTracer.address,
                        accounts[0].address,
                        ethers.utils.parseEther("1")
                    )
            })
        })
    })

    describe("withdraw", async () => {
        context("when the user does not have enough pool tokens", async () => {
            it("reverts", async () => {
                await expect(
                    insurance.withdraw(ethers.utils.parseEther("1"))
                ).to.be.revertedWith("INS: balance < amount")
            })
        })

        context("when the user has enough pool tokens", async () => {
            beforeEach(async () => {
                // get user tp acquire some pool tokens
                await testToken.approve(
                    insurance.address,
                    ethers.utils.parseEther("2")
                )
                await insurance.deposit(ethers.utils.parseEther("2"))
                // get user to burn some pool tokens
                await insurance.withdraw(ethers.utils.parseEther("1"))
            })

            it("burns pool tokens", async () => {
                let poolTokenHolding = await insurance.getPoolUserBalance(
                    accounts[0].address
                )
                expect(poolTokenHolding).to.equal(ethers.utils.parseEther("1"))
            })

            it("decreases the collateral holdings of the insurance fund", async () => {
                let collateralHolding = await insurance.publicCollateralAmount()
                expect(collateralHolding).to.equal(ethers.utils.parseEther("1"))
            })

            it("pulls in collateral from the tracer market", async () => {
                let balanceCalls = mockTracer.smocked.getBalance.calls.length
                expect(balanceCalls).to.equal(1)
            })

            it("emits an insurance withdraw event", async () => {})
        })
    })

    describe("updatePoolAmount", async () => {
        context("when there is only buffer funds", async () => {
            it("pulls funds and updates the collateral holding of the pool", async () => {
                let bufferValue = "1"
                let publicValue = "0"

                await putCollateral(
                    mockTracer,
                    testToken,
                    insurance,
                    bufferValue,
                    publicValue
                )

                mockTracer.smocked.getBalance.will.return.with({
                    position: { quote: ethers.utils.parseEther("1"), base: 0 }, // quote, base
                    totalLeveragedValue: 0, // total leverage
                    lastUpdatedIndex: 0, // last updated index
                    lastUpdatedGasPrice: 0, // last updated gas price
                })

                await insurance.updatePoolAmount()

                let bufferCollateralAmountPost, publicCollateralAmountPost
                ;[bufferCollateralAmountPost, publicCollateralAmountPost] =
                    await getCollaterals(insurance)

                // Pays only to buffer
                expect(bufferCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("2")
                )
                expect(publicCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("0")
                )
            })
        })

        context("when there is both public and buffer funds", async () => {
            it("pulls funds and updates the collateral holding of the pool", async () => {
                let bufferValue = "1"
                let publicValue = "1"

                await putCollateral(
                    mockTracer,
                    testToken,
                    insurance,
                    bufferValue,
                    publicValue
                )

                mockTracer.smocked.getBalance.will.return.with({
                    position: { quote: ethers.utils.parseEther("1"), base: 0 }, // quote, base
                    totalLeveragedValue: 0, // total leverage
                    lastUpdatedIndex: 0, // last updated index
                    lastUpdatedGasPrice: 0, // last updated gas price
                })

                await insurance.updatePoolAmount()

                let bufferCollateralAmountPost, publicCollateralAmountPost
                ;[bufferCollateralAmountPost, publicCollateralAmountPost] =
                    await getCollaterals(insurance)

                // Pays evenly to both the public and the buffer account (50/50 split in terms of collateral)
                expect(bufferCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("1.5")
                )
                expect(publicCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("1.5")
                )
            })
        })

        context("when there are no funds to pull", async () => {
            it("does nothing", async () => {
                mockTracer.smocked.getBalance.will.return.with({
                    position: { quote: ethers.utils.parseEther("1"), base: 0 }, // quote, base
                    totalLeveragedValue: 0, // total leverage
                    lastUpdatedIndex: 0, // last updated index
                    lastUpdatedGasPrice: 0, // last updated gas price
                })

                // ensure tracer.withdraw was called
                expect(mockTracer.smocked.withdraw.calls.length).to.equal(0)

                let bufferCollateralAmountPost, publicCollateralAmountPost
                ;[bufferCollateralAmountPost, publicCollateralAmountPost] =
                    await getCollaterals(insurance)

                expect(publicCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("0")
                )
                expect(bufferCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("0")
                )
            })
        })
    })

    describe("drainPool", async () => {
        context("when called by insurance", async () => {
            beforeEach(async () => {
                // mock ourselvse as the liquidation contract
                mockTracer.smocked.liquidationContract.will.return.with(
                    accounts[0].address
                )
            })

            after(async () => {
                // return mock to its previous state
                mockTracer.smocked.liquidationContract.will.return.with(
                    zeroAddress
                )
            })

            it("drains all but one token in public when there's more than one", async () => {
                let bufferCollateralAmountPre = "1",
                    publicCollateralAmountPre = "1.05",
                    amountToDrain = "3"
                let bufferCollateralAmountPost, publicCollateralAmountPost
                ;[bufferCollateralAmountPost, publicCollateralAmountPost] =
                    await putAndTakeCollateral(
                        mockTracer,
                        testToken,
                        insurance,
                        bufferCollateralAmountPre,
                        publicCollateralAmountPre,
                        amountToDrain
                    )

                expect(bufferCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("0")
                )
                expect(publicCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("1")
                )
            })

            it("drains all but however much is left in public when less than one", async () => {
                let bufferCollateralAmountPre = "1",
                    publicCollateralAmountPre = "0.95",
                    amountToDrain = "3"
                let bufferCollateralAmountPost, publicCollateralAmountPost
                ;[bufferCollateralAmountPost, publicCollateralAmountPost] =
                    await putAndTakeCollateral(
                        mockTracer,
                        testToken,
                        insurance,
                        bufferCollateralAmountPre,
                        publicCollateralAmountPre,
                        amountToDrain
                    )

                expect(bufferCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("0")
                )
                expect(publicCollateralAmountPost).to.equal(
                    ethers.utils.parseEther(publicCollateralAmountPre)
                )
            })

            it("drains all but however much is left in public when less than one", async () => {
                let bufferCollateralAmountPre = "1",
                    publicCollateralAmountPre = "0.95",
                    amountToDrain = "3"
                let bufferCollateralAmountPost, publicCollateralAmountPost
                ;[bufferCollateralAmountPost, publicCollateralAmountPost] =
                    await putAndTakeCollateral(
                        mockTracer,
                        testToken,
                        insurance,
                        bufferCollateralAmountPre,
                        publicCollateralAmountPre,
                        amountToDrain
                    )

                expect(bufferCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("0")
                )
                expect(publicCollateralAmountPost).to.equal(
                    ethers.utils.parseEther(publicCollateralAmountPre)
                )
            })

            it("drains all of the buffer, and some public while leaving < one token", async () => {
                let bufferCollateralAmountPre = "1",
                    publicCollateralAmountPre = "0.7",
                    amountToDrain = "1.5"
                let bufferCollateralAmountPost, publicCollateralAmountPost
                ;[bufferCollateralAmountPost, publicCollateralAmountPost] =
                    await putAndTakeCollateral(
                        mockTracer,
                        testToken,
                        insurance,
                        bufferCollateralAmountPre,
                        publicCollateralAmountPre,
                        amountToDrain
                    )

                expect(bufferCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("0")
                )
                expect(publicCollateralAmountPost).to.equal(
                    ethers.utils.parseEther(publicCollateralAmountPre)
                )
            })

            it("drains all of the buffer, and some public while leaving one token", async () => {
                let bufferCollateralAmountPre = "1",
                    publicCollateralAmountPre = "1.2",
                    amountToDrain = "1.5"
                let bufferCollateralAmountPost, publicCollateralAmountPost
                ;[bufferCollateralAmountPost, publicCollateralAmountPost] =
                    await putAndTakeCollateral(
                        mockTracer,
                        testToken,
                        insurance,
                        bufferCollateralAmountPre,
                        publicCollateralAmountPre,
                        amountToDrain
                    )

                expect(bufferCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("0")
                )
                expect(publicCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("1")
                )
            })

            it("drains all of the buffer, and however much it needs from public", async () => {
                let bufferCollateralAmountPre = "1",
                    publicCollateralAmountPre = "1.2",
                    amountToDrain = "1.1"
                let bufferCollateralAmountPost, publicCollateralAmountPost
                ;[bufferCollateralAmountPost, publicCollateralAmountPost] =
                    await putAndTakeCollateral(
                        mockTracer,
                        testToken,
                        insurance,
                        bufferCollateralAmountPre,
                        publicCollateralAmountPre,
                        amountToDrain
                    )

                expect(bufferCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("0")
                )
                expect(publicCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("1.1")
                )
            })

            it("drains part of buffer", async () => {
                let bufferCollateralAmountPre = "1.5",
                    publicCollateralAmountPre = "0.5",
                    amountToDrain = "1"
                let bufferCollateralAmountPost, publicCollateralAmountPost
                ;[bufferCollateralAmountPost, publicCollateralAmountPost] =
                    await putAndTakeCollateral(
                        mockTracer,
                        testToken,
                        insurance,
                        bufferCollateralAmountPre,
                        publicCollateralAmountPre,
                        amountToDrain
                    )

                expect(bufferCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("0.5")
                )
                expect(publicCollateralAmountPost).to.equal(
                    ethers.utils.parseEther(publicCollateralAmountPre)
                )
            })

            it("deposits into the market", async () => {
                // set collateral holdings to 5
                await testToken.approve(
                    insurance.address,
                    ethers.utils.parseEther("5")
                )
                await insurance.deposit(ethers.utils.parseEther("5"))

                // try withdraw 10 from the pool
                await insurance.drainPool(ethers.utils.parseEther("1"))
                expect(mockTracer.smocked.deposit.calls.length).to.equal(1)
            })

            it("correctly updates the pool's collateral holding", async () => {
                await testToken.approve(
                    insurance.address,
                    ethers.utils.parseEther("5")
                )
                await insurance.deposit(ethers.utils.parseEther("5"))

                // withdraw from pool
                await insurance.drainPool(ethers.utils.parseEther("2"))
                let publicCollateralAmountPost =
                    await insurance.publicCollateralAmount()

                expect(publicCollateralAmountPost).to.equal(
                    ethers.utils.parseEther("3")
                )
            })
        })

        context("when called by someone other than insurance", async () => {
            it("reverts", async () => {
                await expect(
                    insurance.drainPool(ethers.utils.parseEther("1"))
                ).to.be.revertedWith("INS: sender not LIQ contract")
            })
        })
    })

    describe("getPoolBalance", async () => {
        context("when called", async () => {
            it("returns the balance of a user in terms of the pool token", async () => {
                await testToken.approve(
                    insurance.address,
                    ethers.utils.parseEther("2")
                )
                await insurance.deposit(ethers.utils.parseEther("2"))
                let poolBalance = await insurance.getPoolUserBalance(
                    accounts[0].address
                )
                expect(poolBalance).to.equal(ethers.utils.parseEther("2"))
            })
        })
    })

    describe("getPoolTarget", async () => {
        context("when called", async () => {
            it("returns 1% of the markets leveraged notional value", async () => {
                let poolTarget = await insurance.getPoolTarget()
                expect(poolTarget).to.equal(ethers.utils.parseEther("1"))
                // uses leveraged notional value to compute
                let leveragedNotionalCalls =
                    mockTracer.smocked.leveragedNotionalValue.calls.length
                expect(leveragedNotionalCalls).to.equal(1)
            })
        })
    })

    describe("getPoolFundingRate", async () => {
        context("when the leveraged notional value is <= 0", async () => {
            it("returns 0", async () => {
                // set leveraged notional value to 0
                mockTracer.smocked.leveragedNotionalValue.will.return.with(
                    ethers.utils.parseEther("0")
                )

                let poolFundingRate = await insurance.getPoolFundingRate()
                expect(poolFundingRate).to.equal(0)
            })
        })

        context("when the leveraged notional value is > 0", async () => {
            it("returns the appropriate 8 hour funding rate", async () => {
                // set leveraged notional value to 100
                mockTracer.smocked.leveragedNotionalValue.will.return.with(
                    ethers.utils.parseEther("100")
                )

                let poolFundingRate = await insurance.getPoolFundingRate()
                // 0.0036523 * (poolTarget - total collateral) / leveragedNotionalValue))
                // poolTarget = 100 / 1 = 1
                // total collateral = 0
                // leveragedNotionalValue = 100
                // ratio = (poolTarget - collateral) / levNotionalValue = 0.01
                let ratio = ethers.utils.parseEther("0.01")
                let expectedFundingRate = ethers.utils
                    .parseEther("0.0036523")
                    .mul(ratio)
                    .div(ethers.utils.parseEther("1")) //divide by 1 to simulate WAD math division
                expect(poolFundingRate).to.equal(expectedFundingRate)
            })
        })
    })
})

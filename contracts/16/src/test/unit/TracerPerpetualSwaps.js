const { expect, assert } = require("chai")
const { ethers, getNamedAccounts, deployments } = require("hardhat")
const { deploy } = deployments
const { smockit, smoddit } = require("@eth-optimism/smock")
const { BigNumber } = require("ethers")
const zeroAddress = "0x0000000000000000000000000000000000000000"
const tracerAbi = require("../../abi/contracts/TracerPerpetualSwaps.sol/TracerPerpetualSwaps.json")
const insuranceAbi = require("../../abi/contracts/Insurance.sol/Insurance.json")
const pricingAbi = require("../../abi/contracts/Pricing.sol/Pricing.json")
const liquidationAbi = require("../../abi/contracts/Liquidation.sol/Liquidation.json")
const tokenAbi = require("../../abi/contracts/TestToken.sol/TestToken.json")

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

    insurance = await smockit(insurance)
    pricing = await smockit(pricing)
    liquidation = await smockit(liquidation)

    // mock function calls for insurance, pricing & liquidation
    await tracer.setPricingContract(pricing.address)
    await tracer.setInsuranceContract(insurance.address)
    await tracer.setLiquidationContract(liquidation.address)

    pricing.smocked.currentFundingIndex.will.return(0)
    // pricing.smocked.getFundingRate.will.return
    // pricing.smocked.getInsuranceFundingRate.will.return
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
        traderInstance,
    }
})

describe("Unit tests: TracerPerpetualSwaps.sol", function () {
    let tracer
    let insurance
    let pricing
    let liquidation
    let quoteToken
    let deployer
    let accounts
    let traderInstance

    beforeEach(async function () {
        let _setup = await setup()
        tracer = _setup.tracer
        insurance = _setup.insurance
        pricing = _setup.pricing
        liquidation = _setup.liquidation
        quoteToken = _setup.quoteToken
        deployer = _setup.deployer
        traderInstance = _setup.traderInstance
        accounts = await ethers.getSigners()
    })

    describe("deposit", async () => {
        context("when the user has set allowance", async () => {
            beforeEach(async () => {
                await quoteToken.approve(
                    tracer.address,
                    ethers.utils.parseEther("5")
                )
                await tracer.deposit(ethers.utils.parseEther("5"))
            })
            it("updates their quote", async () => {
                let balance = await tracer.balances(deployer)
                await expect(balance.position.quote).to.equal(
                    ethers.utils.parseEther("5")
                )
            })

            it("updates the total TVL", async () => {
                let tvl = await tracer.tvl()
                expect(tvl).to.equal(ethers.utils.parseEther("5"))
            })
        })

        context("when the user has not set allowance", async () => {
            it("reverts", async () => {
                await expect(
                    tracer.deposit(ethers.utils.parseEther("5"))
                ).to.be.revertedWith("ERC20: transfer amount exceeds allowance")
            })
        })

        context("when the token amount is a WAD value", async () => {
            it("update their quote as a WAD value", async () => {
                let tokenBalanceBefore = await quoteToken.balanceOf(deployer)

                // deposit 1 token with dust
                await quoteToken.approve(
                    tracer.address,
                    ethers.utils.parseEther("1.000000001")
                )
                await tracer.deposit(ethers.utils.parseEther("1.000000001"))

                // ensure that token amount has decreased by correct units
                let tokenBalanceAfter = await quoteToken.balanceOf(deployer)
                let difference = tokenBalanceBefore.sub(tokenBalanceAfter)
                let expected = ethers.utils.parseEther("1.000000001")
                // default token only uses 8 decimals, so the last bit should be ignored
                expect(difference.toString()).to.equal(expected)

                // ensure balance in contract has updated by a WAD amount
                let balance = await tracer.balances(deployer)
                await expect(balance.position.quote).to.equal(
                    ethers.utils.parseEther("1.000000001")
                )
            })
        })
    })

    describe("withdraw", async () => {
        beforeEach(async () => {
            await quoteToken.approve(
                tracer.address,
                ethers.utils.parseEther("5")
            )
            await tracer.deposit(ethers.utils.parseEther("5"))
        })
        context("when the user is withdrawing to below margin", async () => {
            it("reverts", async () => {
                await expect(
                    tracer.withdraw(ethers.utils.parseEther("6"))
                ).to.be.revertedWith("TCR: Withdraw below valid Margin")
            })
        })

        context("when the user is making a valid withdraw", async () => {
            beforeEach(async () => {
                await tracer.withdraw(ethers.utils.parseEther("1"))
            })
            it("updates their quote", async () => {
                let balance = await tracer.balances(deployer)
                expect(balance.position.quote).to.equal(
                    ethers.utils.parseEther("4")
                )
            })

            it("updates their leverage", async () => {})

            it("updates the total TVL", async () => {
                let tvl = await tracer.tvl()
                expect(tvl).to.equal(ethers.utils.parseEther("4"))
            })
        })

        context("when the token amount is a WAD value", async () => {
            it("returns the correct amount of tokens", async () => {
                let tokenBalanceBefore = await quoteToken.balanceOf(deployer)

                // withdraw 1 token with dust
                await tracer.withdraw(ethers.utils.parseEther("1.000000001"))

                // ensure that token amount has decreased by correct units
                let tokenBalanceAfter = await quoteToken.balanceOf(deployer)
                let difference = tokenBalanceAfter.sub(tokenBalanceBefore)
                let expected = ethers.utils.parseEther("1.000000001")
                // default token only uses 8 decimals, so the last bit should be ignored
                expect(difference).to.equal(expected)

                // ensure balance in contract has updated by a WAD amount
                let balance = await tracer.balances(deployer)
                await expect(balance.position.quote).to.equal(
                    ethers.utils.parseEther("3.999999999")
                )
            })
        })
    })

    describe("matchOrders", async () => {
        beforeEach(async () => {
            // whitelist so we can submit trades
        })

        context("when the orders can't match", async () => {
            it("emit a FailedOrders event", async () => {
                let order1 = [
                    deployer,
                    tracer.address,
                    ethers.utils.parseEther("1"),
                    ethers.utils.parseEther("1"),
                    0,
                    3621988237, //unrealistic unix timestamp
                    1621988237,
                ]
                const mockSignedOrder1 = [
                    order1,
                    ethers.utils.formatBytes32String("DummyString"),
                    ethers.utils.formatBytes32String("DummyString"),
                    0,
                ]

                let order2 = [
                    deployer,
                    tracer.address,
                    ethers.utils.parseEther("1"),
                    ethers.utils.parseEther("1"),
                    0,
                    3621988237, //unrealistic unix timestamp
                    1621988237,
                ]
                const mockSignedOrder2 = [
                    order2,
                    ethers.utils.formatBytes32String("DummyString"),
                    ethers.utils.formatBytes32String("DummyString"),
                    0,
                ]

                // will return false and not update state
                let balanceBefore = await tracer.balances(deployer)
                const tx = traderInstance.executeTrade(
                    [mockSignedOrder1],
                    [mockSignedOrder2]
                )
                await expect(tx).to.emit(tracer, "FailedOrders")
                await traderInstance.clearFilled(mockSignedOrder1)
                await traderInstance.clearFilled(mockSignedOrder2)
                let balanceAfter = await tracer.balances(deployer)
                // every field should match EXCEPT for last updated gas price
                for (var i = 0; i < 3; i++) {
                    expect(balanceBefore[i].toString()).to.equal(
                        balanceAfter[i].toString()
                    )
                }
            })
        })

        // todo should these just be functional tests
        context("when the orders can match", async () => {
            beforeEach(async () => {})
            it("settles the accounts", async () => {})

            it("executes the trades", async () => {})

            it("updates the account leverage", async () => {})

            it("records the trade with pricing", async () => {})
        })

        context("when the users don't have enough margin", async () => {
            it("emits a FailedOrders event", async () => {
                let order1 = [
                    deployer,
                    tracer.address,
                    ethers.utils.parseEther("3"),
                    ethers.utils.parseEther("1"),
                    0,
                    3621988237, //unrealistic unix timestamp
                    1621988237,
                ]
                const mockSignedOrder1 = [
                    order1,
                    ethers.utils.formatBytes32String("DummyString"),
                    ethers.utils.formatBytes32String("DummyString"),
                    0,
                ]

                let order2 = [
                    accounts[1].address,
                    tracer.address,
                    ethers.utils.parseEther("3"),
                    ethers.utils.parseEther("1"),
                    1,
                    3621988237, //unrealistic unix timestamp
                    1621988237,
                ]
                const mockSignedOrder2 = [
                    order2,
                    ethers.utils.formatBytes32String("DummyString"),
                    ethers.utils.formatBytes32String("DummyString"),
                    0,
                ]

                let balanceBefore = await tracer.balances(deployer)
                const tx = traderInstance.executeTrade(
                    [mockSignedOrder1],
                    [mockSignedOrder2]
                )
                await expect(tx).to.emit(tracer, "FailedOrders")
                await traderInstance.clearFilled(mockSignedOrder1)
                await traderInstance.clearFilled(mockSignedOrder2)
                let balanceAfter = await tracer.balances(deployer)

                // every field should match EXCEPT for last updated gas price
                for (var i = 0; i < 3; i++) {
                    expect(balanceBefore[i].toString()).to.equal(
                        balanceAfter[i].toString()
                    )
                }
            })
        })
    })

    describe("updateAccountsOnLiquidation", async () => {
        context("when not called by liquidation", async () => {
            it("reverts", async () => {
                await expect(
                    tracer.updateAccountsOnLiquidation(
                        accounts[0].address,
                        accounts[1].address,
                        ethers.utils.parseEther("1"),
                        ethers.utils.parseEther("1"),
                        ethers.utils.parseEther("1"),
                        ethers.utils.parseEther("1"),
                        ethers.utils.parseEther("1")
                    )
                ).to.be.revertedWith("TCR: Sender not liquidation")
            })
        })

        context("when the liquidators margin isn't valid", async () => {
            it("reverts", async () => {
                await tracer.setLiquidationContract(accounts[0].address)
                await expect(
                    tracer.updateAccountsOnLiquidation(
                        accounts[0].address,
                        accounts[1].address,
                        ethers.utils.parseEther("1"),
                        ethers.utils.parseEther("1"),
                        ethers.utils.parseEther("1"),
                        ethers.utils.parseEther("1"),
                        ethers.utils.parseEther("1")
                    )
                ).to.be.revertedWith("TCR: Liquidator under min margin")
            })
        })

        context("when called with valid accounts", async () => {
            it("liquidates the account appropriately", async () => {
                await tracer.setLiquidationContract(accounts[0].address)
                await quoteToken
                    .connect(accounts[0])
                    .approve(tracer.address, ethers.utils.parseEther("500"))
                await tracer
                    .connect(accounts[0])
                    .deposit(ethers.utils.parseEther("500"))
                let balanceBeforeLiquidator = await tracer.balances(
                    accounts[0].address
                )
                let balanceBeforeLiquidatee = await tracer.balances(
                    accounts[1].address
                )
                await tracer.updateAccountsOnLiquidation(
                    accounts[0].address,
                    accounts[1].address,
                    ethers.utils.parseEther("1"),
                    ethers.utils.parseEther("1"),
                    ethers.utils.parseEther("-1"),
                    ethers.utils.parseEther("-1"),
                    ethers.utils.parseEther("0.5")
                )
                let balanceAfterLiquidator = await tracer.balances(
                    accounts[0].address
                )
                let balanceAfterLiquidatee = await tracer.balances(
                    accounts[1].address
                )

                // quote: gained 1 but escorwed 0.5 for net 0.5 gain
                expect(
                    balanceAfterLiquidator.position.quote.sub(
                        balanceBeforeLiquidator.position.quote
                    )
                ).to.equal(ethers.utils.parseEther("0.5"))

                // quote: lost 1
                expect(
                    balanceAfterLiquidatee.position.quote.sub(
                        balanceBeforeLiquidatee.position.quote
                    )
                ).to.equal(ethers.utils.parseEther("-1"))

                // base: gained 1
                expect(
                    balanceAfterLiquidator.position.base.sub(
                        balanceBeforeLiquidator.position.base
                    )
                ).to.equal(ethers.utils.parseEther("1"))

                // base: lost 1
                expect(
                    balanceAfterLiquidatee.position.base.sub(
                        balanceBeforeLiquidatee.position.base
                    )
                ).to.equal(ethers.utils.parseEther("-1"))
            })
        })
    })

    describe("updateAccountsOnClaim", async () => {
        context("when not called by liquidation", async () => {
            it("reverts", async () => {
                let one = ethers.utils.parseEther("1")
                await expect(
                    tracer.updateAccountsOnClaim(
                        deployer,
                        one,
                        deployer,
                        one,
                        one
                    )
                ).to.be.revertedWith("TCR: Sender not liquidation")
            })
        })

        context("when the insurance fund ends up empty", async () => {
            it("reverts", async () => {})
        })

        context("when called with valid params", async () => {
            it("takes from insurance", async () => {})

            it("gives to the claimaint", async () => {})

            it("gives to the liquidatee", async () => {})
        })
    })

    describe("settle", async () => {
        context("if the account is on the latest global index", async () => {
            it("does nothing", async () => {
                // ensure on current global index
                await tracer.settle(deployer)

                // settle again
                let balanceBefore = await tracer.balances(deployer)
                await tracer.settle(deployer)
                let balanceAfter = await tracer.balances(deployer)
                expect(balanceAfter.toString()).to.equal(
                    balanceBefore.toString()
                )
            })
        })

        context("if the account isn't up to date", async () => {
            beforeEach(async () => {
                // mock funding index and rates
                pricing.smocked.currentFundingIndex.will.return.with(2)
                pricing.smocked.getFundingRate.will.return.with((index) => {
                    if (ethers.BigNumber.from("1").eq(index)) {
                        // User rate
                        return [
                            0, // timestamp
                            ethers.utils.parseEther("1"), // fundingRate
                            ethers.utils.parseEther("1.45"), // cumulativeFundingRate
                        ]
                    } else if (ethers.BigNumber.from("0").eq(index)) {
                        // Global rate
                        return [
                            0,
                            ethers.utils.parseEther("1"),
                            ethers.utils.parseEther("1.5"),
                        ]
                    }
                })

                for (var i = 0; i < 2; i++) {
                    await quoteToken
                        .connect(accounts[i + 1])
                        .approve(tracer.address, ethers.utils.parseEther("500"))
                    await tracer
                        .connect(accounts[i + 1])
                        .deposit(ethers.utils.parseEther("500"))
                }

                now = Math.floor(new Date().getTime() / 1000)

                // make some basic trades
                let order1 = {
                    maker: accounts[1].address,
                    market: tracer.address,
                    price: ethers.utils.parseEther("1"),
                    amount: ethers.utils.parseEther("1"),
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
                    price: ethers.utils.parseEther("1"),
                    amount: ethers.utils.parseEther("1"),
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

                // check pricing is in hour 0
                let currentHour = await pricing.currentHour()
                expect(currentHour).to.equal(0)

                // place trades
                await traderInstance.executeTrade(
                    [mockSignedOrder1],
                    [mockSignedOrder2]
                )
            })

            it("pays the funding rate", async () => {
                let timestamp, fundingRate, fundingRateValue
                ;[timestamp, fundingRate, fundingRateValue] =
                    await pricing.getFundingRate(0)

                await tracer.settle(accounts[0].address)
            })

            it("pays the insurance funding rate", async () => {})

            it("update their latest gas price", async () => {})

            it("updates their last updated index", async () => {})
        })

        context("if the account is under margin", async () => {
            it("reverts", async () => {})
        })
    })

    describe("setLiquidationContract", async () => {
        context("when called by the owner", async () => {
            it("sets a new liquidation contract address", async () => {
                tracer.setLiquidationContract(deployer)

                expect(await tracer.liquidationContract()).to.equal(deployer)
            })
        })

        context("when called by someone who isn't the owner", async () => {
            it("reverts", async () => {
                // Call setLiquidationContract by someone who isn't an owner -- used insurance contract as an example
                expect(
                    tracer.connect(accounts[1]).setLiquidationContract(deployer)
                ).to.be.revertedWith("Ownable: caller is not the owner")
            })
        })
    })

    describe("setPricingContract", async () => {
        context("when called by the owner", async () => {
            it("sets a new pricing contract address", async () => {
                tracer.setPricingContract(insurance.address)

                expect(await tracer.pricingContract()).to.equal(
                    insurance.address
                )
            })
        })

        context("when called by someone who isn't the owner", async () => {
            it("reverts", async () => {
                expect(
                    tracer.connect(accounts[1]).setPricingContract(deployer)
                ).to.be.revertedWith("Ownable: caller is not the owner")
            })
        })
    })

    describe("setGasOracle", async () => {
        context("when called by the owner", async () => {
            it("sets a new gas oracle contract address", async () => {
                tracer.setGasOracle(insurance.address)

                expect(await tracer.gasPriceOracle()).to.equal(
                    insurance.address
                )
            })
        })

        context("when called by someone who isn't the owner", async () => {
            it("reverts", async () => {
                expect(
                    tracer.connect(accounts[1]).setGasOracle(deployer)
                ).to.be.revertedWith("Ownable: caller is not the owner")
            })
        })
    })

    describe("setFeeReceiver", async () => {
        context("when called by the owner", async () => {
            it("sets a new fee receiver contract address", async () => {
                tracer.setFeeReceiver(insurance.address)

                expect(await tracer.feeReceiver()).to.equal(insurance.address)
            })

            context("when called by someone who isn't the owner", async () => {
                it("reverts", async () => {
                    expect(
                        tracer.connect(accounts[1]).setFeeReceiver(deployer)
                    ).to.be.revertedWith("Ownable: caller is not the owner")
                })
            })

            it("emits an event", async () => {
                expect(tracer.setFeeReceiver(insurance.address))
                    .to.emit(tracer, "FeeReceiverUpdated")
                    .withArgs(insurance.address)
            })
        })

        context("when called by someone who isn't the owner", async () => {
            it("reverts", async () => {
                await expect(
                    tracer.connect(accounts[1]).setGasOracle(deployer)
                ).to.be.revertedWith("Ownable: caller is not the owner")
            })
        })
    })

    describe("withdrawFees", async () => {
        context("when called by the fee receiver", async () => {
            beforeEach(async () => {
                // make some trades and get some fees
                //1% fee
                await tracer.setFeeRate(ethers.utils.parseEther("0.01"))

                for (var i = 0; i < 2; i++) {
                    await quoteToken
                        .connect(accounts[i + 1])
                        .approve(tracer.address, ethers.utils.parseEther("500"))
                    await tracer
                        .connect(accounts[i + 1])
                        .deposit(ethers.utils.parseEther("500"))
                }

                now = Math.floor(new Date().getTime() / 1000)

                // make some basic trades
                let order1 = {
                    maker: accounts[1].address,
                    market: tracer.address,
                    price: ethers.utils.parseEther("1"),
                    amount: ethers.utils.parseEther("100"),
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
                    price: ethers.utils.parseEther("1"),
                    amount: ethers.utils.parseEther("100"),
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

                await traderInstance.executeTrade(
                    [mockSignedOrder1],
                    [mockSignedOrder2]
                )
            })

            it("withdraws the fees", async () => {
                let feeReceiver = await tracer.feeReceiver()
                let balanceBefore = await quoteToken.balanceOf(feeReceiver)
                await tracer.connect(accounts[0]).withdrawFees()
                let balanceAfter = await quoteToken.balanceOf(feeReceiver)
                // 2 quote tokens received as fees (1% of 100 * 2)
                expect(balanceAfter.sub(balanceBefore)).to.equal(
                    ethers.utils.parseEther("2")
                )
            })

            it("resets fees to 0", async () => {
                let feesBefore = await tracer.fees()
                await tracer.connect(accounts[0]).withdrawFees()
                let feesAfter = await tracer.fees()
                expect(feesAfter).to.equal(0)
                expect(feesBefore.sub(feesAfter)).to.equal(
                    ethers.utils.parseEther("2")
                )
            })

            it("emits a FeeWithdrawn event", async () => {
                let feeReceiver = await tracer.feeReceiver()
                await expect(tracer.withdrawFees())
                    .to.emit(tracer, "FeeWithdrawn")
                    .withArgs(feeReceiver, ethers.utils.parseEther("2"))
            })

            it("subtracts fees from the tvl of the market", async () => {
                let tvlBefore = await tracer.tvl()
                await tracer.connect(accounts[0]).withdrawFees()
                let tvlAfter = await tracer.tvl()
                expect(tvlBefore.sub(tvlAfter)).to.equal(
                    ethers.utils.parseEther("2")
                )
            })
        })
    })

    describe("setFeeRate", async () => {
        context("when called by the owner", async () => {
            it("sets a new fee rate", async () => {
                // See fee rate to 50%
                const newFeeRate = ethers.utils.parseEther("0.5")
                await tracer.setFeeRate(newFeeRate)

                expect(await tracer.feeRate()).to.equal(newFeeRate)
            })
        })

        context("when called by someone who isn't the owner", async () => {
            it("reverts", async () => {
                await expect(
                    tracer
                        .connect(accounts[1])
                        .setFeeRate(ethers.utils.parseEther("0.5"))
                ).to.be.revertedWith("Ownable: caller is not the owner")
            })
        })
    })

    describe("setMaxLeverage", async () => {
        context("when called by the owner", async () => {
            it("sets the new max leverage", async () => {
                await tracer.setMaxLeverage(ethers.utils.parseEther("2"))

                expect(await tracer.maxLeverage()).to.equal(
                    ethers.utils.parseEther("2")
                )
            })
        })

        context("when called by someone who isn't the owner", async () => {
            it("reverts", async () => {
                await expect(
                    tracer
                        .connect(accounts[1])
                        .setMaxLeverage(ethers.utils.parseEther("2"))
                ).to.be.revertedWith("Ownable: caller is not the owner")
            })
        })
    })

    describe("setFundingRateSensitivity", async () => {
        context("when called by the owner", async () => {
            it("sets a new funding rate sensitivity", async () => {
                await tracer.setFundingRateSensitivity(
                    ethers.utils.parseEther("2")
                )

                expect(await tracer.fundingRateSensitivity()).to.equal(
                    ethers.utils.parseEther("2")
                )
            })
        })

        context("when called by someone who isn't the owner", async () => {
            it("reverts", async () => {
                await expect(
                    tracer
                        .connect(accounts[1])
                        .setFundingRateSensitivity(ethers.utils.parseEther("2"))
                ).to.be.revertedWith("Ownable: caller is not the owner")
            })
        })
    })

    describe("setDeleveragingCliff", async () => {
        context("when called by the owner", async () => {
            it("sets a new deleveraging cliff", async () => {
                await tracer.setDeleveragingCliff(
                    ethers.utils.parseEther("0.5")
                )

                expect(await tracer.deleveragingCliff()).to.equal(
                    ethers.utils.parseEther("0.5")
                )
            })
        })

        context("when called by someone who isn't the owner", async () => {
            it("reverts", async () => {
                await expect(
                    tracer
                        .connect(accounts[1])
                        .setDeleveragingCliff(ethers.utils.parseEther("0.5"))
                ).to.be.revertedWith("Ownable: caller is not the owner")
            })
        })
    })

    describe("setLowestMaxLeverage", async () => {
        context("when called by the owner", async () => {
            it("sets a new lowest max leverage", async () => {
                await tracer.setLowestMaxLeverage(
                    ethers.utils.parseEther("0.5")
                )

                expect(await tracer.lowestMaxLeverage()).to.equal(
                    ethers.utils.parseEther("0.5")
                )
            })
        })

        context("when called by someone who isn't the owner", async () => {
            it("reverts", async () => {
                await expect(
                    tracer
                        .connect(accounts[1])
                        .setLowestMaxLeverage(ethers.utils.parseEther("0.5"))
                ).to.be.revertedWith("Ownable: caller is not the owner")
            })
        })
    })

    describe("setInsurancePoolSwitchStage", async () => {
        context("when called by the owner", async () => {
            it("sets a new insurance pool switch stage", async () => {
                await tracer.setInsurancePoolSwitchStage(
                    ethers.utils.parseEther("0.5")
                )

                expect(await tracer.insurancePoolSwitchStage()).to.equal(
                    ethers.utils.parseEther("0.5")
                )
            })
        })

        context("when called by someone who isn't the owner", async () => {
            it("reverts", async () => {
                await expect(
                    tracer
                        .connect(accounts[1])
                        .setInsurancePoolSwitchStage(
                            ethers.utils.parseEther("0.5")
                        )
                ).to.be.revertedWith("Ownable: caller is not the owner")
            })
        })
    })

    describe("transferOwnership", async () => {
        context("when called by the owner", async () => {
            it("sets a new owner", async () => {
                await tracer.transferOwnership(insurance.address)

                expect(await tracer.owner()).to.equal(insurance.address)
            })
        })

        context("when called by someone who isn't the owner", async () => {
            it("reverts", async () => {
                await expect(
                    tracer
                        .connect(accounts[1])
                        .transferOwnership(pricing.address)
                ).to.be.revertedWith("Ownable: caller is not the owner")
            })
        })
    })

    describe("setWhitelist", async () => {
        context("when called by the owner", async () => {
            it("whitelists a contract", async () => {
                await tracer.setWhitelist(accounts[1].address, true)

                expect(
                    await tracer.tradingWhitelist(accounts[1].address)
                ).to.equal(true)
            })

            it("can remove a contract from the whitelist", async () => {
                await tracer.setWhitelist(pricing.address, true)
                await tracer.setWhitelist(pricing.address, false)

                expect(await tracer.tradingWhitelist(pricing.address)).to.equal(
                    false
                )
            })
        })

        context("when called by someone who isn't the owner", async () => {
            it("reverts", async () => {
                await expect(
                    tracer
                        .connect(accounts[1])
                        .setWhitelist(pricing.address, false)
                ).to.be.revertedWith("Ownable: caller is not the owner")
            })
        })
    })
})

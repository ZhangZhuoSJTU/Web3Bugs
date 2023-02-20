const { expect } = require("chai")
const { ethers, getNamedAccounts, deployments } = require("hardhat")
const { deploy } = deployments
const zeroAddress = "0x0000000000000000000000000000000000000000"
const MAX_INT256 = ethers.BigNumber.from(2).pow(255).sub(1)
const calcExpectedTwaps = (oraclePrices, tracerPrices, hour) => {
    let cumulativeDerivative = ethers.BigNumber.from("0")
    let cumulativeUnderlying = ethers.BigNumber.from("0")
    let totalTimeWeight = ethers.BigNumber.from("0")
    for (i = 0; i < 8; i++) {
        let currTimeWeight = 8 - i
        let j = hour < i ? 24 - i + hour : hour - i

        totalTimeWeight = totalTimeWeight.add(
            ethers.BigNumber.from(currTimeWeight)
        )
        cumulativeDerivative = cumulativeDerivative.add(
            tracerPrices[j][0].div(tracerPrices[j][1]).mul(currTimeWeight)
        )
        cumulativeUnderlying = cumulativeUnderlying.add(
            oraclePrices[j][0].div(oraclePrices[j][1]).mul(currTimeWeight)
        )
    }
    return [
        cumulativeUnderlying.div(totalTimeWeight),
        cumulativeDerivative.div(totalTimeWeight),
    ]
}

describe("Unit tests: LibPrices.sol", function () {
    before(async function () {
        const { deployer } = await getNamedAccounts()

        libPrices = await deploy("Prices", {
            from: deployer,
            log: true,
        })

        await deploy("LibPricesMock", {
            from: deployer,
            log: true,
            libraries: {
                Prices: libPrices.address,
            },
        })

        let deployment = await deployments.get("LibPricesMock")
        libPrices = await ethers.getContractAt(
            deployment.abi,
            deployment.address
        )
        accounts = await ethers.getSigners()
    })

    describe("fairPrice", async () => {
        context("when called with a positive time value", async () => {
            it("returns as expected", async () => {
                let oraclePrice = ethers.utils.parseEther("100")
                let timeValue = ethers.utils.parseEther("10")

                let result = await libPrices.fairPrice(oraclePrice, timeValue)

                expect(result.toString()).to.equal(
                    ethers.utils.parseEther("90").toString()
                )
            })
        })

        context("when called with a negative time value", async () => {
            it("returns as expected", async () => {
                let oraclePrice = ethers.utils.parseEther("100")
                let timeValue = ethers.utils.parseEther("-10")

                let result = await libPrices.fairPrice(oraclePrice, timeValue)

                expect(result.toString()).to.equal(
                    ethers.utils.parseEther("110").toString()
                )
            })
        })

        context("when called with time value > oracle price", async () => {
            it("returns 0", async () => {
                let oraclePrice = ethers.utils.parseEther("100")
                let timeValue = ethers.utils.parseEther("110")

                let result = await libPrices.fairPrice(oraclePrice, timeValue)

                expect(result.toString()).to.equal(
                    ethers.utils.parseEther("10").toString()
                )
            })
        })

        context("when the oracle price is > max int", async () => {
            it("reverts", async () => {
                let oraclePrice = MAX_INT256.add(ethers.BigNumber.from("1"))
                let timeValue = ethers.utils.parseEther("10")

                await expect(
                    libPrices.fairPrice(oraclePrice, timeValue)
                ).to.be.revertedWith("int256 overflow")
            })
        })
    })

    describe("timeValue", async () => {
        context(
            "when average oracle price > average tracer price",
            async () => {
                it("returns a negative value", async () => {
                    let averageTracerPrice = ethers.utils.parseEther("9100")
                    let averageOraclePrice = ethers.utils.parseEther("10000")

                    let result = await libPrices.timeValue(
                        averageTracerPrice,
                        averageOraclePrice
                    )

                    expect(result.toString()).to.equal(
                        ethers.utils.parseEther("-10").toString()
                    )
                })
            }
        )

        context(
            "when average tracer price >= average oracle price",
            async () => {
                it("returns a positive value", async () => {
                    let averageTracerPrice = ethers.utils.parseEther("10000")
                    let averageOraclePrice = ethers.utils.parseEther("9100")

                    let result = await libPrices.timeValue(
                        averageTracerPrice,
                        averageOraclePrice
                    )

                    expect(result.toString()).to.equal(
                        ethers.utils.parseEther("10").toString()
                    ) // (10000 - 9100) / 90 = 10
                })
            }
        )

        context("when average tracer price > max int", async () => {
            it("reverts", async () => {
                let averageTracerPrice = MAX_INT256.add(
                    ethers.BigNumber.from("1")
                )
                let averageOraclePrice = ethers.utils.parseEther("9100")

                await expect(
                    libPrices.timeValue(averageTracerPrice, averageOraclePrice)
                ).to.be.revertedWith("int256 overflow")
            })
        })

        context("when average oracle price > max int", async () => {
            it("reverts", async () => {
                let averageOraclePrice = MAX_INT256.add(
                    ethers.BigNumber.from("1")
                )
                let averageTracerPrice = ethers.utils.parseEther("9100")

                await expect(
                    libPrices.timeValue(averageTracerPrice, averageOraclePrice)
                ).to.be.revertedWith("int256 overflow")
            })
        })
    })

    describe("averagePrice", async () => {
        context("when trades == 0", async () => {
            it("returns 0", async () => {
                let price = [
                    ethers.utils.parseEther("1"),
                    ethers.utils.parseEther("0"),
                ]

                let result = await libPrices.averagePrice(price)

                expect(result.toString()).to.equal(
                    ethers.BigNumber.from("0").toString()
                )
            })
        })

        context("when trades != 0", async () => {
            it("returns the average trade price", async () => {
                let price = {}

                price.cumulativePrice = ethers.utils.parseEther("10")
                price.trades = ethers.utils.parseEther("1")

                let result = await libPrices.averagePrice(price)

                expect(result.toString()).to.equal(
                    ethers.BigNumber.from("10").toString()
                )
            })
        })
    })

    describe("averagePriceForPeriod", async () => {
        context("when prices length > 24", async () => {
            it("returns the average price for the first 24 periods", async () => {
                let n = 26
                let prices = new Array()

                for (i = 0; i <= n; i++) {
                    prices.push([
                        ethers.BigNumber.from((i * 100000).toString()),
                        ethers.BigNumber.from(50 - i),
                    ])
                }

                await expect(libPrices.averagePriceForPeriod(prices)).to.be
                    .reverted
            })
        })

        context("when prices length <= 24", async () => {
            it("returns the average price for the number of periods present", async () => {
                let n = 24
                let prices = new Array()
                let priceAverages = ethers.constants.Zero

                for (i = 0; i < n; i++) {
                    prices.push([
                        ethers.utils.parseEther((i + 1).toString()),
                        ethers.BigNumber.from(i + 1),
                    ])
                    let dayAverage = ethers.utils
                        .parseEther((i + 1).toString())
                        .div(ethers.BigNumber.from(i + 1))
                    priceAverages = priceAverages.add(dayAverage.toString())
                }

                let averagePriceForPeriod = priceAverages.div(
                    ethers.BigNumber.from(n)
                )
                let result = await libPrices.averagePriceForPeriod(prices)

                expect(result.toString()).to.equal(
                    averagePriceForPeriod.toString()
                )
            })
        })
    })

    describe("globalLeverage", async () => {
        context("when leverage has increased", async () => {
            it("increases global leverage", async () => {
                let globalLeverageInitial = ethers.utils.parseEther("100")
                let oldAccountLeverage = ethers.utils.parseEther("10")
                let newAccountLeverage = ethers.utils.parseEther("20")

                let result = await libPrices.globalLeverage(
                    globalLeverageInitial,
                    oldAccountLeverage,
                    newAccountLeverage
                )

                expect(result.toString()).to.equal(
                    ethers.utils.parseEther("110").toString()
                )
            })
        })

        context("when leverage has not increased", async () => {
            it("decreases global leverage", async () => {
                let globalLeverageInitial = ethers.utils.parseEther("100")
                let oldAccountLeverage = ethers.utils.parseEther("20")
                let newAccountLeverage = ethers.utils.parseEther("10")

                let result = await libPrices.globalLeverage(
                    globalLeverageInitial,
                    oldAccountLeverage,
                    newAccountLeverage
                )

                expect(result.toString()).to.equal(
                    ethers.utils.parseEther("90").toString()
                )
            })
        })

        context(
            "when leverage has decreased by more than the global leverage",
            async () => {
                it("caps global leverage at 0", async () => {
                    let globalLeverageInitial = ethers.utils.parseEther("100")
                    let oldAccountLeverage = ethers.utils.parseEther("110")
                    let newAccountLeverage = ethers.utils.parseEther("0")

                    let result = await libPrices.globalLeverage(
                        globalLeverageInitial,
                        oldAccountLeverage,
                        newAccountLeverage
                    )

                    expect(result.toString()).to.equal(
                        ethers.utils.parseEther("0").toString()
                    )
                })
            }
        )
    })

    describe("calculateTwap", async () => {
        context("for a range of hours", async () => {
            it("returns as expected", async () => {
                let tracerPrices = new Array()
                let oraclePrices = new Array()

                // generate 24 hour oracle and tracer prices
                for (i = 0; i < 24; i++) {
                    oraclePrices.push([
                        ethers.utils.parseUnits((1 + 1 * i).toString(), 18),
                        ethers.BigNumber.from("1"),
                    ])
                    tracerPrices.push([
                        ethers.utils.parseUnits((1 + 0.5 * i).toString(), 18),
                        ethers.BigNumber.from("1"),
                    ])
                }

                // generate expected results
                expectedTwaps = new Array()
                for (var hour = 0; hour < 24; hour++) {
                    let expectedTWAP = calcExpectedTwaps(
                        oraclePrices,
                        tracerPrices,
                        hour
                    )
                    let result = await libPrices.calculateTWAP(
                        hour,
                        tracerPrices,
                        oraclePrices
                    )
                    expect(result[0].toString()).to.equal(
                        expectedTWAP[0].toString()
                    )
                    expect(result[1].toString()).to.equal(
                        expectedTWAP[1].toString()
                    )
                }
            })
        })

        context("when prices are 0", async () => {
            it("returns 0", async () => {
                let tracerPrices = new Array()
                let oraclePrices = new Array()

                // generate 24 hour oracle and tracer prices
                for (i = 0; i < 24; i++) {
                    oraclePrices.push([
                        ethers.utils.parseEther("0"),
                        ethers.BigNumber.from("1"),
                    ])
                    tracerPrices.push([
                        ethers.utils.parseEther("0"),
                        ethers.BigNumber.from("1"),
                    ])
                }

                // generate expected results
                expectedTwaps = new Array()
                for (var hour = 0; hour < 24; hour++) {
                    let expectedTWAP = calcExpectedTwaps(
                        oraclePrices,
                        tracerPrices,
                        hour
                    )
                    let result = await libPrices.calculateTWAP(
                        hour,
                        tracerPrices,
                        oraclePrices
                    )

                    expect(result[0].toString()).to.equal(
                        expectedTWAP[0].toString()
                    )
                    expect(result[1].toString()).to.equal(
                        expectedTWAP[1].toString()
                    )
                }
            })
        })
    })
})

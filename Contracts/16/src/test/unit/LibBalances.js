const { expect } = require("chai")
const { ethers, getNamedAccounts, deployments } = require("hardhat")

/* integer bounds */
// -2^255
const minimumInt = ethers.BigNumber.from(2).pow(255).mul(-1)
const maximumInt = ethers.BigNumber.from(2).pow(255).sub(1)
const maximumUint = ethers.BigNumber.from(2).pow(256).sub(1)
const WAD_POW = ethers.BigNumber.from(10).pow(18)
// const minimumInt = ethers.constants.MaxUint256.div(
//     ethers.BigNumber.from(2)
// ).mul(ethers.BigNumber.from(-1))
// const maximumInt = ethers.constants.MaxUint256.div(ethers.BigNumber.from(1))

const getnotionalValue = (position, price) => {
    // base * price / (10^18) --> brings back to a WAD value
    return position[1].abs().mul(price).div(WAD_POW)
}

const getMargin = (position, price) => {
    // quote + base * price
    return position[0].add(position[1].mul(price).div(WAD_POW))
}

const getTradePosition = (position, trade, feeRate) => {
    let quoteChange = trade[1].mul(trade[0]).div(WAD_POW)
    let fee = quoteChange.mul(feeRate).div(WAD_POW)
    if (trade[2] === 0) {
        // long
        return [
            position[0].sub(quoteChange).add(fee),
            position[1].add(trade[1]),
        ]
    } else {
        // short
        return [
            position[0].add(quoteChange).sub(fee),
            position[1].sub(trade[1]),
        ]
    }
}

describe("Unit tests: LibBalances.sol", async () => {
    let libBalances
    let accounts

    let edgePositions
    let normalPositions
    let edgePrices
    let normalPrices

    before(async () => {
        await deployments.fixture(["LibBalancesMock"])
        const { deployer } = await getNamedAccounts()
        const deployment = await deployments.get("LibBalancesMock")
        libBalances = await ethers.getContractAt(
            deployment.abi,
            deployment.address
        )
        accounts = await ethers.getSigners()

        /* sample sets */
        edgePositions = [
            [minimumInt, minimumInt], // min -> impossible position to actually be in
            [minimumInt, maximumInt],
            [maximumInt, minimumInt],
            [maximumInt, maximumInt], // max -> impossible position to actually be in
        ]

        normalPositions = [
            [ethers.utils.parseEther("1500"), ethers.utils.parseEther("-1500")], // short
            [ethers.utils.parseEther("-1500"), ethers.utils.parseEther("1500")], // long
        ]

        edgePrices = [ethers.constants.MaxUint256]

        normalPrices = [
            ethers.utils.parseEther("0"),
            ethers.utils.parseEther("420"),
        ]
    })

    describe("notionalValue", async () => {
        context("when called with edge case positions", async () => {
            it("reverts", async () => {
                await edgePositions.forEach(async (position) => {
                    await expect(
                        libBalances.notionalValue(position, normalPrices[1])
                    ).to.be.reverted
                })
            })
        })

        context("when called with normal positions", async () => {
            it("returns", async () => {
                await normalPositions.forEach(async (position) => {
                    let expected = getnotionalValue(position, normalPrices[1])
                    let result = await libBalances.notionalValue(
                        position,
                        normalPrices[1]
                    )
                    expect(result).to.equal(expected)
                })
            })
        })

        context("when called with edge case prices", async () => {
            it("reverts", async () => {
                await edgePrices.forEach(async (price) => {
                    await expect(
                        libBalances.notionalValue(normalPositions[0], price)
                    ).to.be.reverted
                })
            })
        })

        context("when called with normal prices", async () => {
            it("returns", async () => {
                await normalPrices.forEach(async (price) => {
                    let expected = getnotionalValue(normalPositions[0], price)
                    let result = await libBalances.notionalValue(
                        normalPositions[0],
                        price
                    )
                    expect(result).to.equal(expected)
                })
            })
        })

        context("when called with price = 0", async () => {
            it("returns 0 for base as max int", async () => {
                await edgePositions.forEach(async (position) => {
                    // only test max int
                    if (position[1] === maximumInt) {
                        let expected = ethers.utils.parseEther("0")
                        let result = await libBalances.notionalValue(
                            position,
                            normalPrices[0]
                        )
                        expect(result).to.equal(expected)
                    }
                })
            })

            it("reverts for base as min int", async () => {
                await edgePositions.forEach(async (position) => {
                    // only test max int
                    if (position[1] === minimumInt) {
                        expect(
                            libBalances.notionalValue(position, normalPrices[0])
                        ).to.be.reverted
                    }
                })
            })

            it("returns 0 for normal positions", async () => {
                await normalPositions.forEach(async (position) => {
                    let expected = ethers.utils.parseEther("0")
                    let result = await libBalances.notionalValue(
                        position,
                        normalPrices[0]
                    )
                    expect(result).to.equal(expected)
                })
            })
        })
    })

    describe("marginIsValid", async () => {
        context("when margin is negative", async () => {
            it("returns false", async () => {
                // Say, quote = 3; base = 2; price = 2;
                // maxLev = 12.5; liquidationGasCost = 0
                let pos = [
                    ethers.utils.parseEther("-3"), // quote
                    ethers.utils.parseEther("-2"), // base
                ]
                let gasCost = ethers.utils.parseEther("1")
                const price = ethers.utils.parseEther("2")
                const trueMaxLeverage = ethers.utils.parseEther("12.5")
                // margin = quote + base * price = -3 - 2 * 2 = -7
                // minMargin = notionalValue / maxLev + 6* liquidationGasCost
                //           = (base * price) / maxLev + 6 * liquidationGasCost
                //           = abs(-2 * 2) / 12.5 + 6*1 = 6.32
                // margin > minMargin

                let result = await libBalances.marginIsValid(
                    pos,
                    gasCost,
                    price,
                    trueMaxLeverage
                )
                expect(result).to.equal(false)
            })
        })

        context("when margin >= minMargin", async () => {
            it("returns true", async () => {
                // Say, quote = 3; base = 2; price = 2;
                // maxLev = 12.5; liquidationGasCost = 0
                let pos = [
                    ethers.utils.parseEther("3"), // quote
                    ethers.utils.parseEther("2"), // base
                ]
                let gasCost = ethers.utils.parseEther("1")
                const price = ethers.utils.parseEther("2")
                const trueMaxLeverage = ethers.utils.parseEther("12.5")
                // margin = quote + base * price = 3 + 2 * 2 = 7
                // minMargin = notionalValue / maxLev + 6* liquidationGasCost
                //           = (base * price) / maxLev + 6 * liquidationGasCost
                //           = (2 * 2) / 12.5 + 6*1 = 6.32
                // margin > minMargin

                let result = await libBalances.marginIsValid(
                    pos,
                    gasCost,
                    price,
                    trueMaxLeverage
                )
                expect(result).to.equal(true)
            })
        })

        context("when margin < minMargin", async () => {
            it("returns false", async () => {
                // Say, quote = -3; base = 2; price = 2;
                // maxLev = 2; liquidationGasCost = 0
                let pos = [
                    ethers.utils.parseEther("-3"), // quote
                    ethers.utils.parseEther("2"), // base
                ]
                let gasCost = ethers.utils.parseEther("3")
                const price = ethers.utils.parseEther("2")
                const trueMaxLeverage = ethers.utils.parseEther("2")
                // margin = quote + base * price = -3 + 2 * 2 = 1
                // minMargin = notionalValue / maxLev + 6 * liquidationGasCost
                //           = (base * price) / maxLev + 6 * liquidationGasCost
                //           = (2 * 2) / 2 + 0 = 2
                // minMargin > margin

                let result = await libBalances.marginIsValid(
                    pos,
                    gasCost,
                    price,
                    trueMaxLeverage
                )
                expect(result).to.equal(false)
            })
        })

        // NOTE: These tests are under the assumption that gasCost isn't being accounted for
        // (i.e. is zero). In normal situations, gasCost > 0 and thus minMargin won't ever be 0
        context("when minMargin == 0", async () => {
            context("when quote > 0", async () => {
                it("returns true", async () => {
                    // Say, quote = 1; base = 0; price = 2;
                    // maxLev = 12.5; liquidationGasCost = 0
                    let pos = [
                        ethers.utils.parseEther("1"), // quote
                        ethers.utils.parseEther("0"), // base
                    ]
                    let gasCost = ethers.utils.parseEther("0")
                    const price = ethers.utils.parseEther("2")
                    const trueMaxLeverage = ethers.utils.parseEther("12.5")
                    // margin = quote + base * price = 1 + 2 * 2 = 1
                    // minMargin = notionalValue / maxLev + liquidationGasCost
                    //           = (base * price) / maxLev + liquidationGasCost
                    //           = (0 * 2) / 2 + 0 = 2 (>= 0)
                    // minMargin > margin

                    let result = await libBalances.marginIsValid(
                        pos,
                        gasCost,
                        price,
                        trueMaxLeverage
                    )
                    expect(result).to.equal(true)
                })
            })
            context("when quote == 0", async () => {
                it("returns true", async () => {
                    // Say, quote = 1; base = 0; price = 2;
                    // maxLev = 12.5; liquidationGasCost = 0
                    let pos = [
                        ethers.utils.parseEther("1"), // quote
                        ethers.utils.parseEther("0"), // base
                    ]
                    let gasCost = ethers.utils.parseEther("0")
                    const price = ethers.utils.parseEther("2")
                    const trueMaxLeverage = ethers.utils.parseEther("12.5")
                    // minMargin = notionalValue / maxLev + liquidationGasCost
                    //           = (base * price) / maxLev + liquidationGasCost
                    //           = (0 * 2) / 2 + 0 = 0 (>= 0)

                    let result = await libBalances.marginIsValid(
                        pos,
                        gasCost,
                        price,
                        trueMaxLeverage
                    )
                    expect(result).to.equal(true)
                })
            })
        })
    })

    describe("margin", async () => {
        context("when called with edge case positions", async () => {
            it("reverts", async () => {
                await edgePositions.forEach(async (position) => {
                    await expect(
                        // test edge cases where price means base and quote
                        // do not cancel
                        libBalances.margin(position, normalPrices[1])
                    ).to.be.reverted
                })
            })
        })

        context("when called with normal positions", async () => {
            it("returns", async () => {
                await normalPositions.forEach(async (position) => {
                    let expected = getMargin(position, normalPrices[1])
                    let result = await libBalances.margin(
                        position,
                        normalPrices[1]
                    )
                    expect(result).to.equal(expected)
                })
            })
        })

        context("when called with edge case prices", async () => {
            it("reverts", async () => {
                await edgePrices.forEach(async (price) => {
                    await expect(libBalances.margin(normalPositions[0], price))
                        .to.be.reverted
                })
            })
        })

        context("when called with normal prices", async () => {
            it("returns", async () => {
                await normalPrices.forEach(async (price) => {
                    let expected = getMargin(normalPositions[0], price)
                    let result = await libBalances.margin(
                        normalPositions[0],
                        price
                    )
                    expect(result).to.equal(expected)
                })
            })
        })

        context("when called with price = 0", async () => {
            it("returns the value of the quote", async () => {
                await normalPositions.forEach(async (position) => {
                    let expected = position[0]
                    let result = await libBalances.margin(
                        position,
                        normalPrices[0]
                    )
                    expect(result).to.equal(expected)
                })
            })
        })
    })

    describe("leveragedNotionalValue", async () => {
        context("when signedNotionalValue > max int", async () => {
            it("reverts", async () => {
                // get notionalValue to return max int
                let position = [
                    ethers.utils.parseEther("-1"),
                    ethers.utils.parseEther("1"),
                ]
                let price = maximumUint
                // base * price = 2^256 - 1
                await expect(
                    libBalances.leveragedNotionalValue(position, price)
                ).to.be.revertedWith("uint256 overflow")
            })
        })

        context("when signedNotionalValue < marginValue", async () => {
            it("returns 0", async () => {
                let position = [
                    ethers.utils.parseEther("100"),
                    ethers.utils.parseEther("-1"),
                ]
                let price = ethers.utils.parseEther("1")
                // notionalValue = base * price
                // marginValue = quote + base * price
                // get base * price < quote + base * price
                let result = await libBalances.leveragedNotionalValue(
                    position,
                    price
                )
                let expected = ethers.utils.parseEther("0")
                expect(result).to.equal(expected)
            })
        })

        context("with normal parameters", async () => {
            it("returns", async () => {
                let position = [
                    ethers.utils.parseEther("10"),
                    ethers.utils.parseEther("-30"),
                ]
                let price = ethers.utils.parseEther("1")
                // notionalValue = abs(base) * price
                // marginValue = quote + base * price
                // leveragedNotionalValue = notionalValue - marginValue = 30 - (-30 + 10) = 50
                let result = await libBalances.leveragedNotionalValue(
                    position,
                    price
                )
                let expected = ethers.utils.parseEther("50")
                expect(result).to.equal(expected)
            })
        })
    })

    describe("minimumMargin", async () => {
        context("when base = 0", async () => {
            it("returns 0", async () => {
                let position = [
                    ethers.utils.parseEther("10"),
                    ethers.utils.parseEther("0"),
                ]
                let price = ethers.utils.parseEther("1")
                let result = await libBalances.minimumMargin(
                    position,
                    price,
                    0,
                    0
                )
                let expected = ethers.utils.parseEther("0")
                expect(result).to.equal(expected)
            })
        })

        context("when liquidation gas cost > max uint", async () => {
            it("reverts", async () => {
                let position = [
                    ethers.utils.parseEther("10"),
                    ethers.utils.parseEther("10"),
                ]
                let price = ethers.utils.parseEther("1")
                let gasCost = maximumUint
                let maxLeverage = ethers.utils.parseEther("10")
                expect(
                    libBalances.minimumMargin(
                        position,
                        price,
                        gasCost,
                        maxLeverage
                    )
                ).to.be.reverted
            })
        })

        context(
            "when liquidation gas cost + minimum margin > max uint",
            async () => {
                it("reverts", async () => {
                    let position = [
                        ethers.utils.parseEther("10"),
                        ethers.utils.parseEther("10"),
                    ]
                    let price = ethers.utils.parseEther("1")
                    let gasCost = maximumUint.sub(ethers.BigNumber.from("1"))
                    let maxLeverage = ethers.utils.parseEther("10")
                    expect(
                        libBalances.minimumMargin(
                            position,
                            price,
                            gasCost,
                            maxLeverage
                        )
                    ).to.be.reverted
                })
            }
        )

        context("with normal parameters", async () => {
            it("returns", async () => {
                let position = [
                    ethers.utils.parseEther("10"),
                    ethers.utils.parseEther("10"),
                ]
                let price = ethers.utils.parseEther("1")
                let notionalValue = getnotionalValue(position, price)
                let gasCost = ethers.utils.parseEther("1")
                let maxLeverage = ethers.utils.parseEther("10")
                // minMargin = notional value / max leverage + 6 * gas cost
                // expected = 7
                let expected = notionalValue
                    .div(maxLeverage)
                    .mul(WAD_POW) // Needs to be WAD
                    .add(gasCost.mul(ethers.BigNumber.from("6")))
                let result = await libBalances.minimumMargin(
                    position,
                    price,
                    gasCost,
                    maxLeverage
                )
                expect(result).to.equal(expected)
            })
        })
    })

    describe("applyTrade", async () => {
        context("when amount > max int", async () => {
            it("reverts", async () => {
                let position = [
                    ethers.utils.parseEther("10"),
                    ethers.utils.parseEther("10"),
                ]
                let trade = [ethers.utils.parseEther("1"), maximumUint, 0]
                let feeRate = ethers.BigNumber.from("0")
                await expect(libBalances.applyTrade(position, trade, feeRate))
                    .to.be.reverted
            })
        })

        context("when price > max int", async () => {
            it("reverts", async () => {
                let position = [
                    ethers.utils.parseEther("10"),
                    ethers.utils.parseEther("10"),
                ]
                let trade = [maximumUint, ethers.utils.parseEther("1"), 0]
                let feeRate = ethers.BigNumber.from("0")
                await expect(libBalances.applyTrade(position, trade, feeRate))
                    .to.be.reverted
            })
        })

        context("when fee rate > max int", async () => {
            it("reverts", async () => {
                let position = [
                    ethers.utils.parseEther("10"),
                    ethers.utils.parseEther("10"),
                ]
                let trade = [
                    ethers.utils.parseEther("1"),
                    ethers.utils.parseEther("1"),
                    0,
                ]
                let feeRate = maximumUint
                await expect(libBalances.applyTrade(position, trade, feeRate))
                    .to.be.reverted
            })
        })

        context("when quote change > max int", async () => {
            it("reverts", async () => {
                let position = [
                    ethers.utils.parseEther("10"),
                    ethers.utils.parseEther("10"),
                ]
                // amount * price > max int
                let trade = [maximumInt, maximumInt, 0]
                let feeRate = ethers.BigNumber.from("0")
                await expect(libBalances.applyTrade(position, trade, feeRate))
                    .to.be.reverted
            })
        })

        context("when fee > max int", async () => {
            it("reverts", async () => {
                let position = [
                    ethers.utils.parseEther("10"),
                    ethers.utils.parseEther("10"),
                ]
                // fee = quote change * fee rate = amount * price * fee rate
                //     = max int * 4 > max int
                let trade = [
                    ethers.utils.parseEther("2"),
                    ethers.utils.parseEther("2"),
                    0,
                ]
                let feeRate = maximumInt
                await expect(libBalances.applyTrade(position, trade, feeRate))
                    .to.be.reverted
            })
        })

        context("when trade is long", async () => {
            it("returns as expected", async () => {
                let position = [
                    ethers.utils.parseEther("10"),
                    ethers.utils.parseEther("0"),
                ]
                // long 5 units at $2
                let trade = [
                    ethers.utils.parseEther("2"),
                    ethers.utils.parseEther("5"),
                    0,
                ]
                let feeRate = ethers.BigNumber.from("0")
                let expected = getTradePosition(position, trade, feeRate)
                let result = await libBalances.applyTrade(
                    position,
                    trade,
                    feeRate
                )
                expect(result[0]).to.equal(expected[0])
                expect(result[1]).to.equal(expected[1])
            })
        })

        context("when trade is short", async () => {
            it("returns as expected", async () => {
                let position = [
                    ethers.utils.parseEther("10"),
                    ethers.utils.parseEther("0"),
                ]
                let trade = [
                    ethers.utils.parseEther("1"),
                    ethers.utils.parseEther("5"),
                    1,
                ]
                let feeRate = ethers.BigNumber.from("0")
                let expected = getTradePosition(position, trade, feeRate)
                let result = await libBalances.applyTrade(
                    position,
                    trade,
                    feeRate
                )
                expect(result[0]).to.equal(expected[0])
                expect(result[1]).to.equal(expected[1])
            })
        })
    })

    describe("tokenToWad", async () => {
        context("when token decimals > max token decimals", async () => {
            it("reverts", async () => {
                await expect(
                    libBalances.tokenToWad(20, ethers.utils.parseEther("100"))
                ).to.be.reverted
            })
        })

        context("when amount > max int", async () => {
            it("reverts", async () => {
                await expect(
                    libBalances.tokenToWad(
                        20,
                        maximumInt.add(ethers.BigNumber.from("1"))
                    )
                ).to.be.reverted
            })
        })

        context("when params are normal", async () => {
            it("returns", async () => {
                let expected = ethers.utils.parseEther("100")
                let result = await libBalances.tokenToWad(6, "100000000")
                expect(result).to.equal(expected)
            })
        })
    })

    describe("wadToToken", async () => {
        context("when token decimals > max token decimals", async () => {
            it("reverts", async () => {
                await expect(
                    libBalances.wadToToken(20, ethers.utils.parseEther("100"))
                ).to.be.reverted
            })
        })

        context("when amount > max int", async () => {
            it("reverts", async () => {
                await expect(
                    libBalances.wadToToken(
                        20,
                        maximumInt.add(ethers.BigNumber.from("1"))
                    )
                ).to.be.reverted
            })
        })

        context("when params are normal", async () => {
            it("returns", async () => {
                let expected = ethers.BigNumber.from("100000000")
                let result = await libBalances.wadToToken(
                    6,
                    ethers.utils.parseEther("100.0000001")
                )
                expect(result).to.equal(expected)
            })
        })
    })
})

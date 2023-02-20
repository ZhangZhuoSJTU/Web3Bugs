const { expect } = require("chai")
const { ethers, getNamedAccounts, deployments } = require("hardhat")
const { BigNumber } = require("ethers")

describe("Unit tests: LibLiquidation.sol", function () {
    let libLiquidation
    const long = 0
    const short = 1

    before(async function () {
        await deployments.fixture(["LibLiquidationMock"])
        const deployment = await deployments.get("LibLiquidationMock")
        libLiquidation = await ethers.getContractAt(
            deployment.abi,
            deployment.address
        )
    })

    context("calcEscrowLiquidationAmount", async function () {
        context("if margin == minMargin", async function () {
            it("Should escrow full amount", async function () {
                const margin = 123
                const minMargin = 123
                const amount = 100
                const expectedEscrowAmount = minMargin.toString()

                const escrowAmount =
                    await libLiquidation.calcEscrowLiquidationAmount(
                        minMargin,
                        margin,
                        amount,
                        amount
                    )
                expect(escrowAmount.toString()).to.equal(expectedEscrowAmount)
            })
        })

        context("as margin drops below minMargin", async function () {
            it("Should escrow less", async function () {
                const margin = 100
                const minMargin = 123
                const amount = 100
                const expectedEscrowAmount = 77 // 100 - (123 - 100) = 77

                const escrowAmount =
                    await libLiquidation.calcEscrowLiquidationAmount(
                        minMargin,
                        margin,
                        amount,
                        amount
                    )
                expect(escrowAmount.toString()).to.equal(
                    expectedEscrowAmount.toString()
                )
            })
        })
        context("once margin hits 0", async function () {
            it("Should escrow 0", async function () {
                const margin = 0
                const minMargin = 123
                const amount = 100
                const expectedEscrowAmount = 0 // min(0, 0 - (123 - 0)) = 0

                const escrowAmount =
                    await libLiquidation.calcEscrowLiquidationAmount(
                        minMargin,
                        margin,
                        amount,
                        amount
                    )
                expect(escrowAmount.toString()).to.equal(
                    expectedEscrowAmount.toString()
                )
            })
        })

        context("once margin goes below 0", async function () {
            it("Should escrow 0", async function () {
                const margin = -9999
                const minMargin = 123
                const amount = 100
                const expectedEscrowAmount = 0 // min(0, 0 - (123 - 0)) = 0

                const escrowAmount =
                    await libLiquidation.calcEscrowLiquidationAmount(
                        minMargin,
                        margin,
                        amount,
                        amount
                    )
                expect(escrowAmount.toString()).to.equal(
                    expectedEscrowAmount.toString()
                )
            })
        })

        context("when amount is not whole margin", async function () {
            it("Should escrow proportionally", async function () {
                const margin = ethers.utils.parseEther("100")
                const minMargin = ethers.utils.parseEther("123")
                const amount = ethers.utils.parseEther("100")
                const totalQuote = ethers.utils.parseEther("200")
                const expectedEscrowAmount = ethers.utils.parseEther("38.5") // (100 - (123 - 100)) / 2

                const escrowAmount =
                    await libLiquidation.calcEscrowLiquidationAmount(
                        minMargin,
                        margin,
                        amount,
                        totalQuote
                    )
                expect(escrowAmount.toString()).to.equal(
                    expectedEscrowAmount.toString()
                )
            })
        })
    })

    context("liquidationBalanceChanges", async function () {
        it("changes full balance on full liquidation", async function () {
            const liquidatedQuote = "-100"
            const liquidatedBase = "250"
            const amount = "250"

            /* quote goes up or down by 100, base goes up or down by 250, since this is a complete liquidation */
            const expectedLiquidatorQuoteChange = "-100"
            const expectedLiquidatorBaseChange = "250"
            const expectedLiquidateeQuoteChange = "100"
            const expectedLiquidateeBaseChange = "-250"

            const ret = await libLiquidation.liquidationBalanceChanges(
                liquidatedBase,
                liquidatedQuote,
                amount
            )
            expect(ret._liquidatorQuoteChange.toString()).to.equal(
                expectedLiquidatorQuoteChange
            )
            expect(ret._liquidatorBaseChange.toString()).to.equal(
                expectedLiquidatorBaseChange
            )
            expect(ret._liquidateeQuoteChange.toString()).to.equal(
                expectedLiquidateeQuoteChange
            )
            expect(ret._liquidateeBaseChange.toString()).to.equal(
                expectedLiquidateeBaseChange
            )
        })

        it("changes zero balance on zero liquidation", async function () {
            const liquidatedQuote = "100"
            const liquidatedBase = "250"
            const amount = "0"

            /* Nothing changes, since amount = 0 */
            const expectedChange = "0"

            const ret = await libLiquidation.liquidationBalanceChanges(
                liquidatedBase,
                liquidatedQuote,
                amount
            )
            expect(ret._liquidatorQuoteChange.toString()).to.equal(
                expectedChange
            )
            expect(ret._liquidatorBaseChange.toString()).to.equal(
                expectedChange
            )
            expect(ret._liquidateeQuoteChange.toString()).to.equal(
                expectedChange
            )
            expect(ret._liquidateeBaseChange.toString()).to.equal(
                expectedChange
            )
        })

        it("changes part of balance on partial liquidation", async function () {
            const liquidatedQuote = "-100"
            const liquidatedBase = "250"
            const amount = "125"

            /* quote goes up or down by 50, base goes up or down by 125, since this is a 50% partial liquidation */
            const expectedLiquidatorQuoteChange = "-50"
            const expectedLiquidatorBaseChange = "125"
            const expectedLiquidateeQuoteChange = "50"
            const expectedLiquidateeBaseChange = "-125"

            const ret = await libLiquidation.liquidationBalanceChanges(
                liquidatedBase,
                liquidatedQuote,
                amount
            )
            expect(ret._liquidatorQuoteChange.toString()).to.equal(
                expectedLiquidatorQuoteChange
            )
            expect(ret._liquidatorBaseChange.toString()).to.equal(
                expectedLiquidatorBaseChange
            )
            expect(ret._liquidateeQuoteChange.toString()).to.equal(
                expectedLiquidateeQuoteChange
            )
            expect(ret._liquidateeBaseChange.toString()).to.equal(
                expectedLiquidateeBaseChange
            )
        })

        it("Returns 0 if liquidated agent has no balance", async function () {
            const liquidatedQuote = "0"
            const liquidatedBase = "0"
            const amount = "125"

            /* quote goes up or down by 50, base goes up or down by 125, since this is a 50% partial liquidation */
            const expectedChange = "0"

            const ret = await libLiquidation.liquidationBalanceChanges(
                liquidatedBase,
                liquidatedQuote,
                amount
            )
            expect(ret._liquidatorQuoteChange.toString()).to.equal(
                expectedChange
            )
            expect(ret._liquidatorBaseChange.toString()).to.equal(
                expectedChange
            )
            expect(ret._liquidateeQuoteChange.toString()).to.equal(
                expectedChange
            )
            expect(ret._liquidateeBaseChange.toString()).to.equal(
                expectedChange
            )
        })

        it("Caps the amount at min(base, amount) i.e. if amount > base, ", async function () {
            const liquidatedQuote = "0"
            const liquidatedBase = "0"
            const amount = "125"

            /* quote goes up or down by 50, base goes up or down by 125, since this is a 50% partial liquidation */
            const expectedChange = "0"

            const ret = await libLiquidation.liquidationBalanceChanges(
                liquidatedBase,
                liquidatedQuote,
                amount
            )
            expect(ret._liquidatorQuoteChange.toString()).to.equal(
                expectedChange
            )
            expect(ret._liquidatorBaseChange.toString()).to.equal(
                expectedChange
            )
            expect(ret._liquidateeQuoteChange.toString()).to.equal(
                expectedChange
            )
            expect(ret._liquidateeBaseChange.toString()).to.equal(
                expectedChange
            )
        })

        it("Calculates correctly on short liquidation", async function () {
            const liquidatedQuote = "100"
            const liquidatedBase = "-200"
            const amount = "200"

            /* quote goes up or down by 50, base goes up or down by 125, since this is a 50% partial liquidation */
            const expectedBaseChange = BigNumber.from("200")
            const expectedQuoteChange = BigNumber.from("100")

            const ret = await libLiquidation.liquidationBalanceChanges(
                liquidatedBase,
                liquidatedQuote,
                amount
            )
            expect(ret._liquidatorQuoteChange).to.equal(expectedQuoteChange)
            expect(ret._liquidatorBaseChange).to.equal(
                expectedBaseChange.mul(BigNumber.from("-1"))
            )
            expect(ret._liquidateeQuoteChange).to.equal(
                expectedQuoteChange.mul(BigNumber.from("-1"))
            )
            expect(ret._liquidateeBaseChange).to.equal(expectedBaseChange)
        })
    })

    context("calculateSlippage", async function () {
        it("0% slippage", async function () {
            const unitsSold = ethers.utils.parseEther("100")
            const maxSlippage = ethers.utils.parseEther("1") // 100%
            const avgPrice = "200000000"
            const receiptPrice = "200000000"
            const expectedSlippage = "0" // 100*2 - 100*2
            const slippage = await libLiquidation.calculateSlippage(
                unitsSold,
                maxSlippage,
                avgPrice,
                receiptPrice,
                long
            )
            expect(slippage.toString()).to.equal(expectedSlippage)
        })

        it("reverse slippage (liquidator benefits)", async function () {
            const unitsSold = ethers.utils.parseEther("100")
            const maxSlippage = ethers.utils.parseEther("0.1") // 10%
            const avgPrice = "300000000"
            const receiptPrice = "200000000"
            const expectedSlippage = "0"
            const slippage = await libLiquidation.calculateSlippage(
                unitsSold,
                maxSlippage,
                avgPrice,
                receiptPrice,
                long
            )
            expect(slippage.toString()).to.equal(expectedSlippage)
        })

        it("slippage over maxSlippage amount", async function () {
            const unitsSold = ethers.utils.parseEther("100")
            const maxSlippage = ethers.utils.parseEther("0.1") // 10%
            const avgPrice = ethers.utils.parseEther("1")
            const receiptPrice = ethers.utils.parseEther("2")
            const expectedSlippage = ethers.utils.parseEther("20") // 10% of 200
            const slippage = await libLiquidation.calculateSlippage(
                unitsSold,
                maxSlippage,
                avgPrice,
                receiptPrice,
                long
            )
            expect(slippage.toString()).to.equal(expectedSlippage)
        })

        it("50% slippage", async function () {
            const unitsSold = ethers.utils.parseEther("100")
            const maxSlippage = ethers.utils.parseEther("1") // 100%
            const avgPrice = ethers.utils.parseEther("1")
            const receiptPrice = ethers.utils.parseEther("2")
            const expectedSlippage = ethers.utils.parseEther("100") // 100*2 - 100*1
            const slippage = await libLiquidation.calculateSlippage(
                unitsSold,
                maxSlippage,
                avgPrice,
                receiptPrice,
                long
            )
            expect(slippage.toString()).to.equal(expectedSlippage)
        })

        it("short slippage (price goes up)", async function () {
            const unitsSold = ethers.utils.parseEther("100")
            const maxSlippage = ethers.utils.parseEther("1") // 100%
            const avgPrice = ethers.utils.parseEther("2")
            const receiptPrice = ethers.utils.parseEther("1")
            const expectedSlippage = ethers.utils.parseEther("100") // 100*2 - 100*1
            const slippage = await libLiquidation.calculateSlippage(
                unitsSold,
                maxSlippage,
                avgPrice,
                receiptPrice,
                short
            )
            expect(slippage.toString()).to.equal(expectedSlippage)
        })

        it("short slippage - slippage exceeds maxSlippage", async function () {
            const unitsSold = ethers.utils.parseEther("100")
            const maxSlippage = ethers.utils.parseEther("1") // 100%
            const avgPrice = ethers.utils.parseEther("3")
            const receiptPrice = ethers.utils.parseEther("1")
            const expectedSlippage = ethers.utils.parseEther("100") // 100% of 100
            const slippage = await libLiquidation.calculateSlippage(
                unitsSold,
                maxSlippage,
                avgPrice,
                receiptPrice,
                short
            )
            expect(slippage.toString()).to.equal(expectedSlippage)
        })

        it("short slippage - liquidator benefits", async function () {
            const unitsSold = ethers.utils.parseEther("100")
            const maxSlippage = ethers.utils.parseEther("1") // 100%
            const avgPrice = ethers.utils.parseEther("1")
            const receiptPrice = ethers.utils.parseEther("5")
            const expectedSlippage = "0"
            const slippage = await libLiquidation.calculateSlippage(
                unitsSold,
                maxSlippage,
                avgPrice,
                receiptPrice,
                short
            )
            expect(slippage.toString()).to.equal(expectedSlippage)
        })
    })

    context("partialLiquidationIsValid", async () => {
        context(
            "when price is 0, quote is 0, but position is low",
            async () => {
                it("returns true, since margin = 0", async () => {
                    const liquidatedBaseChange = 1
                    const liquidatedQuoteChange = 0
                    const liquidatedBase = 145
                    const liquidatedQuote = 0
                    const leftoverBase = liquidatedBase + liquidatedBaseChange
                    const leftoverQuote =
                        liquidatedQuote + liquidatedQuoteChange
                    const lastUpdatedGasCost = 100
                    const liquidationGasCost = 123
                    const price = 0
                    const minimumLeftoverGasCostMultiplier = 10

                    const valid =
                        await libLiquidation.partialLiquidationIsValid(
                            leftoverBase,
                            leftoverQuote,
                            lastUpdatedGasCost,
                            liquidationGasCost,
                            price,
                            minimumLeftoverGasCostMultiplier
                        )

                    expect(valid).to.equal(true)
                })
            }
        )

        context("liquidationGasCost is 0, and margin is negative", async () => {
            it("returns false", async () => {
                const liquidatedBaseChange = ethers.utils.parseEther("1")
                const liquidatedQuoteChange = ethers.utils.parseEther("0")
                const liquidatedBase = ethers.utils.parseEther("-145")
                const liquidatedQuote = ethers.utils.parseEther("0")
                const leftoverBase = liquidatedBase.add(liquidatedBaseChange)
                const leftoverQuote = liquidatedQuote.add(liquidatedQuoteChange)
                const lastUpdatedGasCost = ethers.utils.parseEther("100")
                const liquidationGasCost = ethers.utils.parseEther("0")
                const price = ethers.utils.parseEther("1")
                const minimumLeftoverGasCostMultiplier = 10

                const valid = await libLiquidation.partialLiquidationIsValid(
                    leftoverBase,
                    leftoverQuote,
                    lastUpdatedGasCost, // 100
                    liquidationGasCost, // 0
                    price, // 1
                    minimumLeftoverGasCostMultiplier
                )

                expect(valid).to.equal(false)
            })
        })

        context("margin is below minimum amount leftover", async () => {
            it("Returns false", async () => {
                const liquidatedBaseChange = ethers.utils.parseEther("-1")
                const liquidatedQuoteChange = ethers.utils.parseEther("3")
                const liquidatedBase = ethers.utils.parseEther("-145")
                const liquidatedQuote = ethers.utils.parseEther("146")
                const leftoverBase = liquidatedBase.add(liquidatedBaseChange)
                const leftoverQuote = liquidatedQuote.add(liquidatedQuoteChange)
                const lastUpdatedGasCost = ethers.utils.parseEther("0.0003")
                const liquidationGasCost = ethers.utils.parseEther("63516")
                const price = ethers.utils.parseEther("1")
                const minimumLeftoverGasCostMultiplier = 10

                const valid = await libLiquidation.partialLiquidationIsValid(
                    leftoverBase,
                    leftoverQuote,
                    lastUpdatedGasCost,
                    liquidationGasCost,
                    price,
                    minimumLeftoverGasCostMultiplier
                )

                expect(valid).to.equal(false)
            })
        })

        context("normal case (above leftover minimum)", async () => {
            it("returns true", async () => {
                const liquidatedBaseChange = ethers.utils.parseEther("145")
                const liquidatedQuoteChange = ethers.utils.parseEther("191")
                const liquidatedBase = ethers.utils.parseEther("-145")
                const liquidatedQuote = ethers.utils.parseEther("0")
                const leftoverBase = liquidatedBase.add(liquidatedBaseChange)
                const leftoverQuote = liquidatedQuote.add(liquidatedQuoteChange)
                const lastUpdatedGasCost = ethers.utils.parseEther("0.0003")
                const liquidationGasCost = ethers.utils.parseEther("63516")
                const price = ethers.utils.parseEther("1")
                const minimumLeftoverGasCostMultiplier = 10

                const valid = await libLiquidation.partialLiquidationIsValid(
                    leftoverBase,
                    leftoverQuote,
                    lastUpdatedGasCost, // 0.0003
                    liquidationGasCost, // 63516
                    price, // 1
                    minimumLeftoverGasCostMultiplier
                )

                expect(valid).to.equal(true)
            })
        })

        context("normal case (below leftover minimum)", async () => {
            it("returns false", async () => {
                const liquidatedBaseChange = ethers.utils.parseEther("145")
                const liquidatedQuoteChange = ethers.utils.parseEther("190.4")
                const liquidatedBase = ethers.utils.parseEther("-145")
                const liquidatedQuote = ethers.utils.parseEther("0")
                const leftoverBase = liquidatedBase.add(liquidatedBaseChange)
                const leftoverQuote = liquidatedQuote.add(liquidatedQuoteChange)
                const lastUpdatedGasCost = ethers.utils.parseEther("0.0003")
                const liquidationGasCost = ethers.utils.parseEther("63516")
                const price = ethers.utils.parseEther("1")
                const minimumLeftoverGasCostMultiplier = 10

                const valid = await libLiquidation.partialLiquidationIsValid(
                    leftoverBase,
                    leftoverQuote,
                    lastUpdatedGasCost,
                    liquidationGasCost,
                    price,
                    minimumLeftoverGasCostMultiplier
                )

                expect(valid).to.equal(false)
            })
        })

        context("when leftover base == 0 and quote == 0", async () => {
            it("Returns true", async () => {
                const leftoverBase = 0
                const leftoverQuote = 0
                const lastUpdatedGasCost = ethers.utils.parseEther("0.0003")
                const liquidationGasCost = ethers.utils.parseEther("63516")
                const price = ethers.utils.parseEther("1")
                const minimumLeftoverGasCostMultiplier = 10

                const valid = await libLiquidation.partialLiquidationIsValid(
                    leftoverBase,
                    leftoverQuote,
                    lastUpdatedGasCost,
                    liquidationGasCost,
                    price,
                    minimumLeftoverGasCostMultiplier
                )

                expect(valid).to.equal(true)
            })
        })
    })
})

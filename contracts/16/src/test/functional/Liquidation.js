const perpsAbi = require("../../abi/contracts/TracerPerpetualSwaps.sol/TracerPerpetualSwaps.json")
const liquidationAbi = require("../../abi/contracts/Liquidation.sol/Liquidation.json")
const insuranceAbi = require("../../abi/contracts/Insurance.sol/Insurance.json")
const { expect } = require("chai")
const { ethers, getNamedAccounts, deployments } = require("hardhat")
const { smockit, smoddit } = require("@eth-optimism/smock")
const { BigNumber } = require("ethers")

const provideOrders = async (contracts, liquidationAmount) => {
    const timestamp = contracts.timestamp
    const sellWholeLiquidationAmount = {
        maker: accounts[1].address,
        market: contracts.tracerPerps.address,
        price: ethers.utils.parseEther("0.5").toString(),
        amount: liquidationAmount,
        side: "1", // Short, because original position liquidated was long
        expires: timestamp + 100,
        created: timestamp + 1,
    }

    const sellWholeLiquidationAmountTinySlippage = {
        maker: accounts[1].address,
        market: contracts.tracerPerps.address,
        price: ethers.utils.parseEther("0.94").toString(),
        amount: liquidationAmount,
        side: "1", // Short, because original position liquidated was long
        expires: timestamp + 100,
        created: timestamp + 1,
    }

    const sellWholeLiquidationAmountZeroTokens = {
        maker: accounts[1].address,
        market: contracts.tracerPerps.address,
        price: ethers.utils.parseEther("0.5").toString(),
        amount: "0",
        side: "1", // Short, because original position liquidated was long
        expires: timestamp + 100,
        created: timestamp + 1,
    }

    const sellWholeLiquidationAmountUseNoSlippage = {
        maker: accounts[1].address,
        market: contracts.tracerPerps.address,
        price: ethers.utils.parseEther("0.01").toString(),
        amount: liquidationAmount,
        side: "1", // Short, because original position liquidated was long
        expires: timestamp + 100,
        created: timestamp + 1,
    }

    const sellHalfLiquidationAmount = {
        maker: accounts[1].address,
        market: contracts.tracerPerps.address,
        price: ethers.utils.parseEther("0.5").toString(),
        amount: ethers.BigNumber.from(liquidationAmount).div(2).toString(),
        side: "1", // Short, because original position liquidated was long
        expires: timestamp + 100,
        created: timestamp + 1,
    }

    const sellHalfLiquidationAmountSecond = {
        maker: accounts[1].address,
        market: contracts.tracerPerps.address,
        price: ethers.utils.parseEther("0.5").toString(),
        amount: ethers.BigNumber.from(liquidationAmount).div(2).toString(),
        side: "1", // Short, because original position liquidated was long
        expires: timestamp + 100,
        created: timestamp + 2,
    }

    const sellHalfLiquidationAmountThird = {
        maker: accounts[1].address,
        market: contracts.tracerPerps.address,
        price: ethers.utils.parseEther("0.5").toString(),
        amount: ethers.BigNumber.from(liquidationAmount).div(2).toString(),
        side: "1", // Short, because original position liquidated was long
        expires: timestamp + 100,
        created: timestamp + 3,
    }

    const sellLiquidationAmountNoSlippage = {
        maker: accounts[1].address,
        market: contracts.tracerPerps.address,
        price: ethers.utils.parseEther("0.95").toString(),
        amount: ethers.BigNumber.from(liquidationAmount).toString(),
        side: "1", // Short, because original position liquidated was long
        expires: timestamp + 100,
        created: timestamp + 2,
    }

    const longOrder = {
        maker: accounts[1].address,
        market: contracts.tracerPerps.address,
        price: ethers.utils.parseEther("0.5").toString(),
        amount: liquidationAmount,
        side: "0", // Long, which is invalid
        expires: timestamp + 100,
        created: timestamp,
    }

    const zeroDollarOrder = {
        maker: accounts[1].address,
        market: contracts.tracerPerps.address,
        price: "0", // $0
        amount: liquidationAmount,
        side: "1", // Short, because original position liquidated was long
        expires: timestamp + 100,
        created: timestamp,
    }

    const earlyCreationOrder = {
        maker: accounts[1].address,
        market: contracts.tracerPerps.address,
        price: ethers.utils.parseEther("0.5").toString(),
        amount: ethers.BigNumber.from(liquidationAmount).div(2).toString(),
        side: "1", // Short, because original position liquidated was long
        expires: timestamp + 100,
        created: 0,
    }

    const wrongMakerOrder = {
        maker: accounts[2].address,
        market: contracts.tracerPerps.address,
        price: ethers.utils.parseEther("0.5").toString(),
        amount: ethers.BigNumber.from(liquidationAmount).div(2).toString(),
        side: "1", // Short, because original position liquidated was long
        expires: timestamp + 100,
        created: 0,
    }

    orders = {
        sellWholeLiquidationAmount: sellWholeLiquidationAmount,
        sellWholeLiquidationAmountTinySlippage:
            sellWholeLiquidationAmountTinySlippage,
        sellHalfLiquidationAmount: sellHalfLiquidationAmount,
        sellHalfLiquidationAmountSecond: sellHalfLiquidationAmountSecond,
        sellHalfLiquidationAmountThird: sellHalfLiquidationAmountThird,
        longOrder: longOrder,
        zeroDollarOrder: zeroDollarOrder,
        earlyCreationOrder: earlyCreationOrder,
        wrongMakerOrder: wrongMakerOrder,
        sellWholeLiquidationAmountUseNoSlippage:
            sellWholeLiquidationAmountUseNoSlippage,
        sellLiquidationAmountNoSlippage: sellLiquidationAmountNoSlippage,
        sellWholeLiquidationAmountZeroTokens:
            sellWholeLiquidationAmountZeroTokens,
    }

    return orders
}

const halfLiquidate = deployments.createFixture(async () => {
    const contracts = await baseLiquidatablePosition()
    const { deployer } = await getNamedAccounts()
    accounts = await ethers.getSigners()
    const { tracerPerps, liquidation } = contracts

    // Get half the base. Liquidate this amount
    const halfBase = (await tracerPerps.getBalance(deployer)).position.base.div(
        2
    )

    await liquidation.connect(accounts[1]).liquidate(halfBase, deployer)

    const timestamp = (await ethers.provider.getBlock("latest")).timestamp

    return { ...contracts, timestamp }
})

const invalidLiquidate = async () => {
    const contracts = await baseLiquidatablePosition()
    const { deployer } = await getNamedAccounts()
    accounts = await ethers.getSigners()
    const { tracerPerps, liquidation, trader, libPerpetuals } = contracts

    // Get half the base. Liquidate this amount
    const doubleBase = (
        await tracerPerps.getBalance(deployer)
    ).position.base.mul(2)

    const tx = liquidation.connect(accounts[1]).liquidate(doubleBase, deployer)
    await expect(tx).to.be.reverted

    return { tracerPerps, liquidation, trader, libPerpetuals }
}

const baseLiquidatablePosition = deployments.createFixture(async () => {
    await deployments.fixture("GetIntoLiquidatablePosition")
    const { deployer } = await getNamedAccounts()
    accounts = await ethers.getSigners()

    let perpsAddress = await deployments.read(
        "TracerPerpetualsFactory",
        "tracersByIndex",
        0
    )
    let tracerPerpsInstance = new ethers.Contract(
        perpsAddress,
        perpsAbi,
        ethers.provider
    )
    tracerPerpsInstance = await tracerPerpsInstance.connect(deployer)

    let liquidationInstance = new ethers.Contract(
        await tracerPerpsInstance.liquidationContract(),
        liquidationAbi,
        ethers.provider
    )
    liquidationInstance = await liquidationInstance.connect(accounts[0])

    let insuranceInstance = new ethers.Contract(
        await tracerPerpsInstance.insuranceContract(),
        insuranceAbi,
        ethers.provider
    )
    insuranceInstance = await insuranceInstance.connect(accounts[0])

    const traderDeployment = await deployments.get("Trader")
    let traderInstance = await ethers.getContractAt(
        traderDeployment.abi,
        traderDeployment.address
    )

    const tokenDeployment = await deployments.get("QuoteToken")
    let token = await ethers.getContractAt(
        tokenDeployment.abi,
        tokenDeployment.address
    )

    // liquidationInstance.connect(deployer)
    await deployments.fixture("PerpetualsMock")
    const libPerpetualsDeployment = await deployments.get("PerpetualsMock")
    let libPerpetuals = await ethers.getContractAt(
        libPerpetualsDeployment.abi,
        libPerpetualsDeployment.address
    )
    const contracts = {
        tracerPerps: tracerPerpsInstance,
        liquidation: liquidationInstance,
        trader: traderInstance,
        libPerpetuals: libPerpetuals,
        token: token,
        insurance: insuranceInstance,
    }

    return contracts
})

const addOrdersToModifiedTrader = async (
    modifiableTrader,
    contracts,
    orders
) => {
    for (const [key, order] of Object.entries(orders)) {
        let hash = await contracts.libPerpetuals.callStatic.orderId(order)
        await modifiableTrader.smodify.put({
            orders: {
                [hash]: order,
            },
        })

        await modifiableTrader.smodify.put({
            filled: {
                [hash]: order.amount,
            },
        })

        if (key === "sellWholeLiquidationAmountUseNoSlippage") {
            await modifiableTrader.smodify.put({
                averageExecutionPrice: {
                    [hash]: ethers.utils.parseEther("0.95").toString(), // no slippage on actual executionPrice
                },
            })
        } else {
            await modifiableTrader.smodify.put({
                averageExecutionPrice: {
                    [hash]: order.price,
                },
            })
        }
    }
}

/**
 * 1) Deploy smodded Trader contract
 * 2) Get into liquidatable position
 * 3) liquidate half the position
 * 4) Put in fake orders into smodded Trader contract
 */
const setupReceiptTest = deployments.createFixture(async () => {
    const { modifiableTrader } = await deployModifiableTrader()
    const contracts = await halfLiquidate()

    const liquidationAmount = (
        await contracts.liquidation.liquidationReceipts(0)
    ).amountLiquidated.toString()
    const orders = await provideOrders(
        contracts,
        liquidationAmount,
        contracts.timestamp
    )

    await addOrdersToModifiedTrader(modifiableTrader, contracts, orders)
    return { ...contracts, modifiableTrader, ...orders }
})

const setupLiquidationTest = deployments.createFixture(async () => {
    const contracts = await baseLiquidatablePosition()

    const tracer = contracts.tracerPerps.connect(accounts[2])
    const liquidation = contracts.liquidation.connect(accounts[2])
    const token = contracts.token.connect(accounts[2])
    await token.approve(tracer.address, ethers.utils.parseEther("10000"))
    await tracer.deposit(ethers.utils.parseEther("10000"))

    return { token: token, tracer: tracer, liquidation: liquidation }
})

const deployModifiableTrader = deployments.createFixture(async () => {
    const ModifiableTraderContract = await smoddit("Trader", {
        libraries: {
            // Perpetuals: contracts.libPerpetuals.address
        },
    })
    const modifiableTrader = await ModifiableTraderContract.deploy()
    return { modifiableTrader }
})

describe("Liquidation functional tests", async () => {
    let accounts
    let tracerPerps
    let liquidation
    let trader
    let libPerpetuals
    const fifteenMinutes = 60 * 15
    before(async function () {
        accounts = await ethers.getSigners()
    })

    beforeEach(async function () {})

    context("calcAmountToReturn", async () => {
        context(
            "when units sold is greater than liquidation amount",
            async () => {
                it("Reverts ", async () => {
                    const contracts = await setupReceiptTest()

                    const tx = contracts.liquidation.calcAmountToReturn(
                        0,
                        [
                            contracts.sellHalfLiquidationAmount,
                            contracts.sellHalfLiquidationAmountSecond,
                            contracts.sellHalfLiquidationAmountThird,
                        ],
                        contracts.modifiableTrader.address
                    )
                    await expect(tx).to.be.revertedWith("LIQ: Unit mismatch")
                })
            }
        )

        context(
            "When execution price has no slippage, but order price is low",
            async () => {
                it("calculates no slippage", async () => {
                    const contracts = await setupReceiptTest()
                    tracerPerps = contracts.tracerPerps
                    liquidation = contracts.liquidation
                    trader = contracts.modifiableTrader

                    const tx = await liquidation.callStatic.calcAmountToReturn(
                        0,
                        [contracts.sellWholeLiquidationAmountUseNoSlippage],
                        trader.address
                    )
                    await expect(tx).to.equal(ethers.utils.parseEther("0"))
                })
            }
        )

        context("When there is slippage", async () => {
            it("Calculates accurately", async () => {
                contracts = await setupReceiptTest()

                const amountToReturn =
                    await contracts.liquidation.callStatic.calcAmountToReturn(
                        0,
                        [
                            contracts.sellHalfLiquidationAmount,
                            contracts.sellHalfLiquidationAmountSecond,
                        ],
                        contracts.modifiableTrader.address
                    )

                // 5000 * 0.95 - 5000* 0.5 = 2250
                const expectedAmountToReturn = ethers.utils.parseEther("2250")
                expect(amountToReturn).to.equal(expectedAmountToReturn)
            })
        })

        context("When there is no slippage", async () => {
            it("Returns 0 ", async () => {
                const contracts = await setupReceiptTest()

                const amountToReturn =
                    await contracts.liquidation.callStatic.calcAmountToReturn(
                        0,
                        [contracts.sellLiquidationAmountNoSlippage],
                        contracts.modifiableTrader.address
                    )
                expect(amountToReturn).to.equal(BigNumber.from("0"))
            })
        })
    })

    context("getLiquidationReceipt", async () => {
        context("after a receipt submission", async () => {
            it("Returns a valid receipt", async () => {
                const contracts = await setupReceiptTest()
                accounts = await ethers.getSigners()
                const blockTimestamp = (
                    await ethers.provider.getBlock("latest")
                ).timestamp
                const amountLiquidated = ethers.utils.parseEther("5000")
                // minMargin = 6 * (0.00006*63515) + 9500/12.5
                // escrowAmount = (margin - (minMargin - margin)) / 2 = (500 - (782.86 - 500))/2 = 108.56712
                const escrowedAmount = ethers.utils.parseEther("108.56712")
                const liquidationSide = 0 // long

                const expectedReceipt = [
                    contracts.tracerPerps.address, // market
                    accounts[1].address, // liquidator
                    accounts[0].address, // liquidatee
                    ethers.utils.parseEther("0.95"), // price
                    BigNumber.from(blockTimestamp), // time
                    escrowedAmount,
                    BigNumber.from(blockTimestamp + fifteenMinutes),
                    amountLiquidated,
                    false, // escrow claimed
                    liquidationSide,
                    false, // liquidatorRefundClaimed
                ]
                let receipt = await contracts.liquidation.liquidationReceipts(0)
                receipt = receipt.slice(0, 11)
                for (let i = 0; i < receipt.length; i++) {
                    expect(receipt[i]).to.equal(expectedReceipt[i])
                }
            })
        })

        context("on invalid submission", async () => {
            it("Returns nothing", async () => {
                const contracts = await invalidLiquidate()
                let receipt = await contracts.liquidation.liquidationReceipts(0)
                const zeroAddress = "0x0000000000000000000000000000000000000000"

                for (let i = 0; i < 3; i++) {
                    expect(receipt[i]).to.equal(zeroAddress)
                }

                for (let i = 3; i < 8; i++) {
                    expect(receipt[i].toString()).to.equal("0")
                }
                expect(receipt[8]).to.equal(false)
                expect(receipt[9].toString()).to.equal("0")
                expect(receipt[10]).to.equal(false)
            })
        })
    })

    context("liquidate", async () => {
        context(
            "when liquidation would put liquidator below minimum margin",
            async () => {
                it("Reverts", async () => {
                    const contracts = await baseLiquidatablePosition()
                    accounts = await ethers.getSigners()

                    const tracer = contracts.tracerPerps.connect(accounts[2])
                    const liquidation = contracts.liquidation.connect(
                        accounts[2]
                    )
                    const token = contracts.token.connect(accounts[2])
                    const liquidationAmount = (
                        await tracer.balances(accounts[0].address)
                    ).position.base
                    const quote = (await tracer.balances(accounts[0].address))
                        .position.quote

                    // Deposit just a single token
                    await token.approve(
                        tracer.address,
                        ethers.utils.parseEther("1")
                    )
                    await tracer.deposit(ethers.utils.parseEther("1"))

                    // Liquidate, but only 1 quote token won't be enough to afford liquidating
                    const tx = liquidation.liquidate(
                        liquidationAmount,
                        accounts[0].address
                    )
                    await expect(tx).to.be.revertedWith(
                        "TCR: Liquidator under min margin"
                    )
                })
            }
        )

        context("when agent isn't below margin", async () => {
            it("Reverts", async () => {
                const contracts = await setupLiquidationTest()
                accounts = await ethers.getSigners()

                // Liquidate, but accounts[1] is above margin
                const tx = contracts.liquidation.liquidate(
                    "1",
                    accounts[1].address
                )
                await expect(tx).to.be.revertedWith("LIQ: Account above margin")
            })
        })

        context(
            "when agent isn't below margin, then insurance pool drops and is below",
            async () => {
                it("Reverts when below, and allows liquidation when trueMaxLeverage drops", async () => {
                    const contracts = await setupLiquidationTest()
                    accounts = await ethers.getSigners()
                    await contracts.token
                        .connect(accounts[1])
                        .approve(
                            contracts.tracer.address,
                            ethers.utils.parseEther("10000")
                        )
                    await contracts.tracer
                        .connect(accounts[1])
                        .deposit(ethers.utils.parseEther("100"))

                    // Liquidate, but accounts[1] is above margin
                    const invalidTx = contracts.liquidation.liquidate(
                        "1",
                        accounts[1].address
                    )
                    await expect(invalidTx).to.be.revertedWith(
                        "LIQ: Account above margin"
                    )

                    // Set lowestMaxLeverage to 1.5x
                    await contracts.tracer
                        .connect(accounts[0])
                        .setLowestMaxLeverage(ethers.utils.parseEther("1.5"))

                    // Liquidate, and now accounts[1] is below minimum margin
                    const tx = contracts.liquidation.liquidate(
                        "1",
                        accounts[1].address
                    )
                    await expect(tx).to.emit(contracts.liquidation, "Liquidate")
                })
            }
        )

        context("when gas price is above fast gas price", async () => {
            it("Reverts", async () => {
                const contracts = await setupLiquidationTest()
                accounts = await ethers.getSigners()

                const liquidationAmount = (
                    await contracts.tracer.balances(accounts[0].address)
                ).position.base

                // Liquidate with high gas price
                const tx = contracts.liquidation.liquidate(
                    liquidationAmount,
                    accounts[0].address,
                    {
                        gasPrice: "1000000000000000",
                    }
                )
                await expect(tx).to.be.revertedWith("LIQ: GasPrice > FGasPrice")
            })
        })

        context("when negative liquidation amount", async () => {
            it("Reverts", async () => {
                const contracts = await setupLiquidationTest()
                accounts = await ethers.getSigners()

                // Liquidate with negative amount
                const tx = contracts.liquidation.liquidate(
                    ethers.utils.parseEther("-10000"),
                    accounts[0].address
                )
                await expect(tx).to.be.revertedWith(
                    "LIQ: Liquidation amount <= 0"
                )
            })
        })

        context("when amount > agent base amount", async () => {
            it("Reverts", async () => {
                const contracts = await setupLiquidationTest()
                accounts = await ethers.getSigners()

                const liquidationAmount = (
                    await contracts.tracer.balances(accounts[0].address)
                ).position.base

                // Liquidate with 1 more than agent's position
                const tx = contracts.liquidation.liquidate(
                    liquidationAmount.add(BigNumber.from("1")),
                    accounts[0].address
                )
                await expect(tx).to.be.revertedWith(
                    "LIQ: Liquidate Amount > Position"
                )
            })
        })

        context("when liquidation amount == 0", async () => {
            it("Reverts", async () => {
                const contracts = await setupLiquidationTest()
                accounts = await ethers.getSigners()

                // Liquidate with 0
                const tx = contracts.liquidation.liquidate(
                    ethers.utils.parseEther("0"),
                    accounts[0].address
                )
                await expect(tx).to.be.revertedWith(
                    "LIQ: Liquidation amount <= 0"
                )
            })
        })

        context("on full liquidation", async () => {
            it("Updates accounts and escrow correctly", async () => {
                const contracts = await setupLiquidationTest()
                accounts = await ethers.getSigners()

                const liquidationAmount = (
                    await contracts.tracer.balances(accounts[0].address)
                ).position.base

                const baseBefore = (
                    await contracts.tracer.balances(accounts[2].address)
                ).position.base

                // Normal liquidation
                const tx = await contracts.liquidation.liquidate(
                    liquidationAmount,
                    accounts[0].address
                )

                // escrowedAmount = [margin - (minMargin - margin)] = [500 - (782.86576 - 500)] = 217.13424
                const expectedEscrowedAmount =
                    ethers.utils.parseEther("217.13424")

                const escrowedAmount = (
                    await contracts.liquidation.liquidationReceipts(0)
                ).escrowedAmount
                expect(escrowedAmount).to.equal(expectedEscrowedAmount)

                const baseAfter = (
                    await contracts.tracer.balances(accounts[2].address)
                ).position.base

                expect(baseAfter).to.equal(baseBefore.add(liquidationAmount))
            })
        })

        context("on partial liquidation", async () => {
            it("Updates accounts and escrow correctly", async () => {
                const contracts = await setupLiquidationTest()
                accounts = await ethers.getSigners()

                const liquidationAmount = (
                    await contracts.tracer.balances(accounts[0].address)
                ).position.base.div(2)

                const baseBefore = (
                    await contracts.tracer.balances(accounts[2].address)
                ).position.base

                // Normal liquidation
                const tx = await contracts.liquidation.liquidate(
                    liquidationAmount,
                    accounts[0].address
                )

                // minMargin = 6 * (0.00006*63515) + 9500/12.5
                // escrowAmount = (margin - (minMargin - margin)) / 2 = (500 - (782.86 - 500))/2 = 108.56712
                const expectedEscrowedAmount =
                    ethers.utils.parseEther("108.56712")

                const escrowedAmount = (
                    await contracts.liquidation.liquidationReceipts(0)
                ).escrowedAmount
                expect(escrowedAmount).to.equal(expectedEscrowedAmount)

                const baseAfter = (
                    await contracts.tracer.balances(accounts[2].address)
                ).position.base

                expect(baseAfter).to.equal(baseBefore.add(liquidationAmount))
            })
        })
    })

    context("claimReceipt", async () => {
        const liquidateAndDepositAccount2 = deployments.createFixture(
            async () => {
                const contracts = await setupReceiptTest()
                accounts = await ethers.getSigners()

                await contracts.token
                    .connect(accounts[2])
                    .approve(
                        contracts.insurance.address,
                        ethers.utils.parseEther("10000")
                    )

                return contracts
            }
        )

        context("when receipt doesn't exist", async () => {
            it("Reverts", async () => {
                const contracts = await setupLiquidationTest()
                accounts = await ethers.getSigners()
                const tx = contracts.liquidation.claimReceipt(
                    32,
                    [],
                    accounts[0].address
                )

                // Revert with the first check that requires a field to not equal 0
                await expect(tx).to.be.revertedWith("LIQ: Liquidator mismatch")
            })
        })

        context("when non-whitelisted trader is given", async () => {
            it("Reverts", async () => {
                const contracts = await setupReceiptTest()
                accounts = await ethers.getSigners()
                const tx = contracts.liquidation
                    .connect(accounts[1])
                    .claimReceipt(0, [], accounts[3].address)

                await expect(tx).to.be.revertedWith(
                    "LIQ: Trader is not whitelisted"
                )
            })
        })

        context("when claim time has passed", async () => {
            it("Reverts ", async () => {
                const contracts = await setupReceiptTest()
                accounts = await ethers.getSigners()

                // Increase time by a bit over the claim receipt time
                await network.provider.send("evm_increaseTime", [
                    fifteenMinutes + 1,
                ])
                await network.provider.send("evm_mine", [])

                const tx = contracts.liquidation
                    .connect(accounts[1])
                    .claimReceipt(0, [], accounts[0].address)

                await expect(tx).to.be.revertedWith("LIQ: claim time passed")
            })
        })

        context("when sender isn't liquidator", async () => {
            it("reverts", async () => {
                const contracts = await setupReceiptTest()
                accounts = await ethers.getSigners()

                const tx = contracts.liquidation
                    .connect(accounts[2])
                    .claimReceipt(0, [], accounts[0].address)

                await expect(tx).to.be.revertedWith("LIQ: Liquidator mismatch")
            })
        })

        context("on a receipt that's already claimed", async () => {
            it("reverts", async () => {
                const contracts = await setupReceiptTest()
                accounts = await ethers.getSigners()

                const order = contracts.sellLiquidationAmountNoSlippage

                // Whitelist the smoddit Trader
                await contracts.tracerPerps
                    .connect(accounts[0])
                    .setWhitelist(contracts.modifiableTrader.address, true)
                // Claim receipt then claim again
                await contracts.liquidation
                    .connect(accounts[1])
                    .claimReceipt(
                        0,
                        [order],
                        contracts.modifiableTrader.address
                    )
                const tx = contracts.liquidation
                    .connect(accounts[1])
                    .claimReceipt(
                        0,
                        [order],
                        contracts.modifiableTrader.address
                    )

                await expect(tx).to.be.revertedWith("LIQ: Already claimed")
            })
        })

        context("when slippage occurs - below escrow amount", async () => {
            it("Accurately updates accounts", async () => {
                const contracts = await setupReceiptTest()
                accounts = await ethers.getSigners()
                const liquidationAmount = (
                    await contracts.liquidation.liquidationReceipts(0)
                ).amountLiquidated
                const escrowedAmount = (
                    await contracts.liquidation.liquidationReceipts(0)
                ).escrowedAmount

                // This order sells all liquidationAmount at $0.94, even though the receipt is $0.95,
                // so slippage is liquidationAmount*0.95 - liquidationAmount*0.94
                const order = contracts.sellWholeLiquidationAmountTinySlippage

                const receiptValue = liquidationAmount
                    .mul(BigNumber.from("95"))
                    .div(BigNumber.from("100"))
                const sellValue = liquidationAmount
                    .mul(BigNumber.from("94"))
                    .div(BigNumber.from("100"))
                const slippageAmount = receiptValue.sub(sellValue)

                const liquidatorQuoteBefore = (
                    await contracts.tracerPerps.balances(accounts[1].address)
                ).position.quote
                const liquidateeQuoteBefore = (
                    await contracts.tracerPerps.balances(accounts[0].address)
                ).position.quote

                // Whitelist the smoddit Trader
                await contracts.tracerPerps
                    .connect(accounts[0])
                    .setWhitelist(contracts.modifiableTrader.address, true)
                // Claim receipt then claim again
                await contracts.liquidation
                    .connect(accounts[1])
                    .claimReceipt(
                        0,
                        [order],
                        contracts.modifiableTrader.address
                    )

                const liquidatorQuoteAfter = (
                    await contracts.tracerPerps.balances(accounts[1].address)
                ).position.quote
                const liquidateeQuoteAfter = (
                    await contracts.tracerPerps.balances(accounts[0].address)
                ).position.quote

                expect(liquidatorQuoteAfter).to.equal(
                    liquidatorQuoteBefore.add(slippageAmount)
                )

                const expectedLiquidateeDifference =
                    escrowedAmount.sub(slippageAmount)
                expect(liquidateeQuoteAfter).to.equal(
                    liquidateeQuoteBefore.add(expectedLiquidateeDifference)
                )
            })
        })

        context(
            "when slippage occurs - above escrow amount & empty insurance pool",
            async () => {
                it("Accurately updates accounts", async () => {
                    const contracts = await setupReceiptTest()
                    accounts = await ethers.getSigners()
                    const escrowedAmount = (
                        await contracts.liquidation.liquidationReceipts(0)
                    ).escrowedAmount

                    // This order sells all liquidationAmount at $0.5, even though the receipt is $0.95,
                    // so slippage is liquidationAmount*0.95 - liquidationAmount*0.5
                    const order = contracts.sellWholeLiquidationAmount

                    const liquidatorQuoteBefore = (
                        await contracts.tracerPerps.balances(
                            accounts[1].address
                        )
                    ).position.quote
                    const liquidateeQuoteBefore = (
                        await contracts.tracerPerps.balances(
                            accounts[0].address
                        )
                    ).position.quote

                    // Whitelist the smoddit Trader
                    await contracts.tracerPerps
                        .connect(accounts[0])
                        .setWhitelist(contracts.modifiableTrader.address, true)

                    // Claim receipt then claim again
                    await contracts.liquidation
                        .connect(accounts[1])
                        .claimReceipt(
                            0,
                            [order],
                            contracts.modifiableTrader.address
                        )

                    const liquidatorQuoteAfter = (
                        await contracts.tracerPerps.balances(
                            accounts[1].address
                        )
                    ).position.quote
                    const liquidateeQuoteAfter = (
                        await contracts.tracerPerps.balances(
                            accounts[0].address
                        )
                    ).position.quote

                    // Amount should only increase by escrowed amount, since ins pool is empty
                    expect(liquidatorQuoteAfter).to.equal(
                        liquidatorQuoteBefore.add(escrowedAmount)
                    )
                    // Liquidatee's balance should not change
                    expect(liquidateeQuoteAfter).to.equal(liquidateeQuoteBefore)
                })
            }
        )

        context(
            "when slippage occurs - above escrow amount & indadequately-full insurance pool",
            async () => {
                it("Accurately updates accounts", async () => {
                    const contracts = await liquidateAndDepositAccount2()
                    accounts = await ethers.getSigners()

                    const liquidationAmount = (
                        await contracts.liquidation.liquidationReceipts(0)
                    ).amountLiquidated
                    const escrowedAmount = (
                        await contracts.liquidation.liquidationReceipts(0)
                    ).escrowedAmount

                    // This order sells all liquidationAmount at $0.5, even though the receipt is $0.95,
                    // so slippage is liquidationAmount*0.95 - liquidationAmount*0.5
                    const order = contracts.sellWholeLiquidationAmount

                    const receiptValue = liquidationAmount
                        .mul(BigNumber.from("95"))
                        .div(BigNumber.from("100"))
                    const sellValue = liquidationAmount
                        .mul(BigNumber.from("50"))
                        .div(BigNumber.from("100"))
                    const slippageAmount = receiptValue.sub(sellValue)

                    // We want slippage > escrowedAmount + insurancePoolHoldings
                    await contracts.insurance
                        .connect(accounts[2])
                        .deposit(slippageAmount.sub(escrowedAmount).div(2))
                    await contracts.insurance
                        .connect(accounts[2])
                        .updatePoolAmount()

                    const poolHoldingsBefore =
                        await contracts.insurance.getPoolHoldings()
                    const liquidatorQuoteBefore = (
                        await contracts.tracerPerps.balances(
                            accounts[1].address
                        )
                    ).position.quote
                    const liquidateeQuoteBefore = (
                        await contracts.tracerPerps.balances(
                            accounts[0].address
                        )
                    ).position.quote

                    // Whitelist the smoddit Trader
                    await contracts.tracerPerps
                        .connect(accounts[0])
                        .setWhitelist(contracts.modifiableTrader.address, true)
                    await contracts.liquidation
                        .connect(accounts[1])
                        .claimReceipt(
                            0,
                            [order],
                            contracts.modifiableTrader.address
                        )

                    const liquidatorQuoteAfter = (
                        await contracts.tracerPerps.balances(
                            accounts[1].address
                        )
                    ).position.quote
                    const liquidateeQuoteAfter = (
                        await contracts.tracerPerps.balances(
                            accounts[0].address
                        )
                    ).position.quote
                    const expectedDifference = escrowedAmount
                        .add(poolHoldingsBefore)
                        .sub(ethers.utils.parseEther("1"))

                    // Should increase by amount escrowed + whatever was in the insurance pool
                    expect(liquidatorQuoteAfter).to.equal(
                        liquidatorQuoteBefore.add(expectedDifference)
                    )
                    expect(liquidateeQuoteAfter).to.equal(liquidateeQuoteBefore)
                    await contracts.insurance.updatePoolAmount()
                    expect(
                        await contracts.insurance.getPoolHoldings()
                    ).to.equal(ethers.utils.parseEther("1"))
                })
            }
        )

        context(
            "when slippage occurs - above escrow amount & full insurance pool",
            async () => {
                it("Accurately updates accounts", async () => {
                    const contracts = await liquidateAndDepositAccount2()
                    accounts = await ethers.getSigners()

                    const liquidationAmount = (
                        await contracts.liquidation.liquidationReceipts(0)
                    ).amountLiquidated
                    const escrowedAmount = (
                        await contracts.liquidation.liquidationReceipts(0)
                    ).escrowedAmount

                    // This order sells all liquidationAmount at $0.5, even though the receipt is $0.95,
                    // so slippage is liquidationAmount*0.95 - liquidationAmount*0.5
                    const order = contracts.sellWholeLiquidationAmount
                    const receiptValue = liquidationAmount
                        .mul(BigNumber.from("95"))
                        .div(BigNumber.from("100"))
                    const sellValue = liquidationAmount
                        .mul(BigNumber.from("50"))
                        .div(BigNumber.from("100"))
                    const slippageAmount = receiptValue.sub(sellValue)

                    // We want slippage > escrowedAmount + insurancePoolHoldings
                    await contracts.insurance
                        .connect(accounts[2])
                        .deposit(ethers.utils.parseEther("10000"))
                    await contracts.insurance
                        .connect(accounts[2])
                        .updatePoolAmount()

                    const poolHoldingsBefore =
                        await contracts.insurance.getPoolHoldings()
                    const liquidatorQuoteBefore = (
                        await contracts.tracerPerps.balances(
                            accounts[1].address
                        )
                    ).position.quote
                    const liquidateeQuoteBefore = (
                        await contracts.tracerPerps.balances(
                            accounts[0].address
                        )
                    ).position.quote

                    // Whitelist the smoddit Trader
                    await contracts.tracerPerps
                        .connect(accounts[0])
                        .setWhitelist(contracts.modifiableTrader.address, true)
                    await contracts.liquidation
                        .connect(accounts[1])
                        .claimReceipt(
                            0,
                            [order],
                            contracts.modifiableTrader.address
                        )

                    const liquidatorQuoteAfter = (
                        await contracts.tracerPerps.balances(
                            accounts[1].address
                        )
                    ).position.quote
                    const liquidateeQuoteAfter = (
                        await contracts.tracerPerps.balances(
                            accounts[0].address
                        )
                    ).position.quote

                    // Should increase by amount escrowed + whatever was in the insurance pool
                    expect(liquidatorQuoteAfter).to.equal(
                        liquidatorQuoteBefore.add(slippageAmount)
                    )
                    expect(liquidateeQuoteAfter).to.equal(liquidateeQuoteBefore)
                    await contracts.insurance.updatePoolAmount()

                    // Insurance pool should go down by (slippageAmount - escrowedAMount)
                    const expectedPoolHoldings = poolHoldingsBefore.sub(
                        slippageAmount.sub(escrowedAmount)
                    )
                    expect(
                        await contracts.insurance.getPoolHoldings()
                    ).to.equal(expectedPoolHoldings)
                })
            }
        )

        context(
            "when slippage occurs - above maxSlippage (caps at maxSlippage)",
            async () => {
                it("Accurately updates accounts", async () => {
                    const contracts = await liquidateAndDepositAccount2()
                    accounts = await ethers.getSigners()

                    // Set maxSlippage to 2%
                    await contracts.liquidation
                        .connect(accounts[0])
                        .setMaxSlippage(ethers.utils.parseEther("0.02"))

                    const liquidationAmount = (
                        await contracts.liquidation.liquidationReceipts(0)
                    ).amountLiquidated
                    const escrowedAmount = (
                        await contracts.liquidation.liquidationReceipts(0)
                    ).escrowedAmount

                    // This order sells all liquidationAmount at $0.5, even though the receipt is $0.95,
                    // so slippage is liquidationAmount*0.95 - liquidationAmount*0.5
                    // But that goes over the newly-set 2% cap
                    const order = contracts.sellWholeLiquidationAmount
                    const receiptValue = liquidationAmount
                        .mul(BigNumber.from("95"))
                        .div(BigNumber.from("100"))

                    // percent slippage = slippage / total amount
                    // slippage = percent / total amount
                    const expectedSlippage = receiptValue
                        .mul(BigNumber.from("2"))
                        .div(BigNumber.from("100"))

                    const liquidatorQuoteBefore = (
                        await contracts.tracerPerps.balances(
                            accounts[1].address
                        )
                    ).position.quote
                    const liquidateeQuoteBefore = (
                        await contracts.tracerPerps.balances(
                            accounts[0].address
                        )
                    ).position.quote

                    // Whitelist the smoddit Trader
                    await contracts.tracerPerps
                        .connect(accounts[0])
                        .setWhitelist(contracts.modifiableTrader.address, true)
                    await contracts.liquidation
                        .connect(accounts[1])
                        .claimReceipt(
                            0,
                            [order],
                            contracts.modifiableTrader.address
                        )

                    const liquidatorQuoteAfter = (
                        await contracts.tracerPerps.balances(
                            accounts[1].address
                        )
                    ).position.quote
                    const liquidateeQuoteAfter = (
                        await contracts.tracerPerps.balances(
                            accounts[0].address
                        )
                    ).position.quote

                    // Should increase by amount escrowed + whatever was in the insurance pool
                    expect(liquidatorQuoteAfter).to.equal(
                        liquidatorQuoteBefore.add(expectedSlippage)
                    )

                    // liquidatee base should have gone up by (escrowedAmount - slippage)
                    expect(liquidateeQuoteAfter).to.equal(
                        liquidateeQuoteBefore.add(
                            escrowedAmount.sub(expectedSlippage)
                        )
                    )
                })
            }
        )

        context("when No slippage", async () => {
            it("Makes no changes (except liquidatee, who gets escrow) ", async () => {
                const contracts = await liquidateAndDepositAccount2()
                accounts = await ethers.getSigners()

                const order = contracts.sellLiquidationAmountNoSlippage
                const escrowedAmount = (
                    await contracts.liquidation.liquidationReceipts(0)
                ).escrowedAmount

                const liquidatorQuoteBefore = (
                    await contracts.tracerPerps.balances(accounts[1].address)
                ).position.quote
                const liquidateeQuoteBefore = (
                    await contracts.tracerPerps.balances(accounts[0].address)
                ).position.quote

                await contracts.insurance.updatePoolAmount()
                const insuranceHoldingsBefore =
                    await contracts.insurance.getPoolHoldings()

                // Whitelist the smoddit Trader
                await contracts.tracerPerps
                    .connect(accounts[0])
                    .setWhitelist(contracts.modifiableTrader.address, true)
                await contracts.liquidation
                    .connect(accounts[1])
                    .claimReceipt(
                        0,
                        [order],
                        contracts.modifiableTrader.address
                    )

                const liquidatorQuoteAfter = (
                    await contracts.tracerPerps.balances(accounts[1].address)
                ).position.quote
                const liquidateeQuoteAfter = (
                    await contracts.tracerPerps.balances(accounts[0].address)
                ).position.quote
                await contracts.insurance.updatePoolAmount()
                const insuranceHoldingsAfter =
                    await contracts.insurance.getPoolHoldings()

                // Should increase by amount escrowed + whatever was in the insurance pool
                expect(liquidatorQuoteAfter).to.equal(liquidatorQuoteBefore)

                // liquidatee base should have gone up by escrowedAMount
                expect(liquidateeQuoteAfter).to.equal(
                    liquidateeQuoteBefore.add(escrowedAmount)
                )
                expect(insuranceHoldingsBefore).to.equal(insuranceHoldingsAfter)
            })
        })

        context("when units sold is 0", async () => {
            it("Makes no changes (except to liquidatee, who gets escrow) ", async () => {
                const contracts = await liquidateAndDepositAccount2()
                accounts = await ethers.getSigners()

                const order = contracts.sellWholeLiquidationAmountZeroTokens
                const escrowedAmount = (
                    await contracts.liquidation.liquidationReceipts(0)
                ).escrowedAmount

                const liquidatorQuoteBefore = (
                    await contracts.tracerPerps.balances(accounts[1].address)
                ).position.quote
                const liquidateeQuoteBefore = (
                    await contracts.tracerPerps.balances(accounts[0].address)
                ).position.quote

                await contracts.insurance.updatePoolAmount()
                const insuranceHoldingsBefore =
                    await contracts.insurance.getPoolHoldings()

                // Whitelist the smoddit Trader
                await contracts.tracerPerps
                    .connect(accounts[0])
                    .setWhitelist(contracts.modifiableTrader.address, true)
                await contracts.liquidation
                    .connect(accounts[1])
                    .claimReceipt(
                        0,
                        [order],
                        contracts.modifiableTrader.address
                    )

                const liquidatorQuoteAfter = (
                    await contracts.tracerPerps.balances(accounts[1].address)
                ).position.quote
                const liquidateeQuoteAfter = (
                    await contracts.tracerPerps.balances(accounts[0].address)
                ).position.quote

                await contracts.insurance.updatePoolAmount()
                const insuranceHoldingsAfter =
                    await contracts.insurance.getPoolHoldings()

                // Should increase by amount escrowed + whatever was in the insurance pool
                expect(liquidatorQuoteAfter).to.equal(liquidatorQuoteBefore)

                // liquidatee base should have gone up by escrowedAmount
                expect(liquidateeQuoteAfter).to.equal(
                    liquidateeQuoteBefore.add(escrowedAmount)
                )
                expect(insuranceHoldingsAfter).to.equal(insuranceHoldingsBefore)
            })
        })
    })

    context("claimEscrow", async () => {
        const increaseFifteenMinutes = async () => {
            await network.provider.send("evm_increaseTime", [
                fifteenMinutes + 1,
            ])
            await network.provider.send("evm_mine", [])
        }

        context(
            "when receipt already claimed through claimEscrow",
            async () => {
                it("Reverts ", async () => {
                    const contracts = await setupReceiptTest()
                    accounts = await ethers.getSigners()
                    await increaseFifteenMinutes()
                    await contracts.liquidation
                        .connect(accounts[0])
                        .claimEscrow(0)
                    const tx = contracts.liquidation
                        .connect(accounts[0])
                        .claimEscrow(0)
                    await expect(tx).to.be.revertedWith("LIQ: Escrow claimed")
                })
            }
        )

        context("when calling too early", async () => {
            it("Reverts ", async () => {
                const contracts = await setupReceiptTest()
                accounts = await ethers.getSigners()
                const tx = contracts.liquidation
                    .connect(accounts[0])
                    .claimEscrow(0)
                await expect(tx).to.be.revertedWith("LIQ: Not released")
            })
        })

        context(
            "when receipt partially claimed by liquidator on claimReceipt",
            async () => {
                it("reverts", async () => {
                    const contracts = await setupReceiptTest()
                    accounts = await ethers.getSigners()
                    // This order sells all liquidationAmount at $0.94, even though the receipt is $0.95,
                    // so slippage is liquidationAmount*0.95 - liquidationAmount*0.94
                    const order =
                        contracts.sellWholeLiquidationAmountTinySlippage

                    // Whitelist the smoddit Trader
                    await contracts.tracerPerps
                        .connect(accounts[0])
                        .setWhitelist(contracts.modifiableTrader.address, true)
                    // Claim receipt then claim again
                    await contracts.liquidation
                        .connect(accounts[1])
                        .claimReceipt(
                            0,
                            [order],
                            contracts.modifiableTrader.address
                        )
                    // Don't need to test balances because that is tested in context("claimReceipts")

                    await increaseFifteenMinutes()
                    const tx = contracts.liquidation
                        .connect(accounts[0])
                        .claimEscrow(0)
                    await expect(tx).to.be.revertedWith("LIQ: Escrow claimed")
                })
            }
        )

        context(
            "when receipt fully claimed by liquidator on claimReceipt",
            async () => {
                it("Reverts", async () => {
                    const contracts = await setupReceiptTest()
                    accounts = await ethers.getSigners()
                    const escrowedAmount = (
                        await contracts.liquidation.liquidationReceipts(0)
                    ).escrowedAmount

                    // This order sells all liquidationAmount at $0.5, even though the receipt is $0.95,
                    // so slippage is liquidationAmount*0.95 - liquidationAmount*0.5
                    const order = contracts.sellWholeLiquidationAmount

                    // Whitelist the smoddit Trader
                    await contracts.tracerPerps
                        .connect(accounts[0])
                        .setWhitelist(contracts.modifiableTrader.address, true)

                    // Claim receipt then claim again
                    await contracts.liquidation
                        .connect(accounts[1])
                        .claimReceipt(
                            0,
                            [order],
                            contracts.modifiableTrader.address
                        )

                    await increaseFifteenMinutes()
                    const tx = contracts.liquidation
                        .connect(accounts[0])
                        .claimEscrow(0)
                    await expect(tx).to.be.revertedWith("LIQ: Escrow claimed")
                })
            }
        )

        context(
            "when receipt not claimed by liquidator on claimReceipt",
            async () => {
                it("Claims accurately", async () => {
                    const contracts = await setupReceiptTest()
                    accounts = await ethers.getSigners()

                    const escrowedAmount = (
                        await contracts.liquidation.liquidationReceipts(0)
                    ).escrowedAmount
                    const quoteBefore = (
                        await contracts.tracerPerps.balances(
                            accounts[0].address
                        )
                    ).position.quote

                    await increaseFifteenMinutes()
                    await contracts.liquidation
                        .connect(accounts[0])
                        .claimEscrow(0)

                    const quoteAfter = (
                        await contracts.tracerPerps.balances(
                            accounts[0].address
                        )
                    ).position.quote

                    expect(quoteAfter).to.equal(quoteBefore.add(escrowedAmount))
                })
            }
        )
    })

    context("currentLiquidationId", async () => {
        context("liquidation ID", async () => {
            it("Correctly increments", async () => {
                // setupReceiptTest() liquidates half, so check liquidation ID then liquidate rest
                const contracts = await setupReceiptTest()
                accounts = await ethers.getSigners()

                const firstLiquidationID =
                    await contracts.liquidation.currentLiquidationId()
                expect(firstLiquidationID).to.equal(BigNumber.from("1"))

                // Get half the base. Liquidate this amount
                const restOfBase = (
                    await contracts.tracerPerps.getBalance(accounts[0].address)
                ).position.base.div(2)

                await contracts.liquidation
                    .connect(accounts[1])
                    .liquidate(restOfBase, accounts[0].address)

                const secondLiquidationID =
                    await contracts.liquidation.currentLiquidationId()
                expect(secondLiquidationID).to.equal(BigNumber.from("2"))
            })
        })
    })

    context("setMaxSlippage", async () => {
        context("maxSlippage", async () => {
            it("correctly updates ", async () => {
                const contracts = await setupReceiptTest()
                accounts = await ethers.getSigners()
                await contracts.liquidation
                    .connect(accounts[0])
                    .setMaxSlippage("123")
                expect(await contracts.liquidation.maxSlippage()).to.equal(
                    "123"
                )
            })
        })
    })

    context("calcUnitsSold", async () => {
        context("When no orders given", async () => {
            it("Returns nothing ", async () => {
                const contracts = await setupReceiptTest()
                const result =
                    await contracts.liquidation.callStatic.calcUnitsSold(
                        [],
                        contracts.modifiableTrader.address,
                        0
                    )
                expect(result[0]).to.equal(0)
                expect(result[1]).to.equal(0)
            })
        })

        context(
            "When execution price has no slippage, but order price is low",
            async () => {
                it("calculates no slippage", async () => {
                    const contracts = await setupReceiptTest()
                    tracerPerps = contracts.tracerPerps
                    liquidation = contracts.liquidation
                    trader = contracts.modifiableTrader
                    const liquidationAmount = (
                        await liquidation.liquidationReceipts(0)
                    ).amountLiquidated
                    const orders = await provideOrders(
                        contracts,
                        liquidationAmount
                    )

                    const tx = await liquidation.callStatic.calcUnitsSold(
                        [orders.sellWholeLiquidationAmountUseNoSlippage],
                        trader.address,
                        0
                    )
                    await expect(tx[0]).to.equal(
                        ethers.utils.parseEther("5000")
                    )
                    await expect(tx[1]).to.equal(
                        ethers.utils.parseEther("0.95")
                    )
                })
            }
        )

        context("in the normal case", async () => {
            it("Calculates correctly", async () => {
                const contracts = await setupReceiptTest()
                tracerPerps = contracts.tracerPerps
                liquidation = contracts.liquidation
                trader = contracts.modifiableTrader

                const tx = await liquidation.callStatic.calcUnitsSold(
                    [
                        contracts.sellHalfLiquidationAmount,
                        contracts.sellHalfLiquidationAmountSecond,
                    ],
                    trader.address,
                    0
                )
                expect(tx[0]).to.equal(ethers.utils.parseEther("5000"))
                expect(tx[1]).to.equal(ethers.utils.parseEther("0.5"))
            })
        })

        context("when all invalid orders", async () => {
            it("Returns nothing ", async () => {
                const contracts = await setupReceiptTest()
                const receiptId = 0
                const liquidationAmount = (
                    await contracts.liquidation.liquidationReceipts(receiptId)
                ).amountLiquidated

                const receipt = await (
                    await contracts.liquidation.calcUnitsSold(
                        [
                            contracts.longOrder,
                            contracts.wrongMakerOrder,
                            contracts.earlyCreationOrder,
                            contracts.longOrder,
                        ],
                        contracts.modifiableTrader.address,
                        0
                    )
                ).wait()
                let eventCounter = 0
                // Make sure InvalidClaimOrder is emitted correct number of times
                receipt.events.filter((x) => {
                    if (
                        x.event === "InvalidClaimOrder" &&
                        x.args.receiptId == 0
                    ) {
                        eventCounter++
                    }
                })
                const expectedNumberOfEventEmissions = 4
                expect(eventCounter).to.equal(expectedNumberOfEventEmissions)
                const result =
                    await contracts.liquidation.callStatic.calcUnitsSold(
                        [
                            contracts.longOrder,
                            contracts.wrongMakerOrder,
                            contracts.earlyCreationOrder,
                            contracts.longOrder,
                        ],
                        contracts.modifiableTrader.address,
                        0
                    )
                expect(result[0]).to.equal(0)
                expect(result[1]).to.equal(0)
            })
        })

        context("when some invalid orders", async () => {
            it("Calculates correctly", async () => {
                const contracts = await setupReceiptTest()
                const receiptId = 0

                const receipt = await (
                    await contracts.liquidation.calcUnitsSold(
                        [
                            contracts.sellHalfLiquidationAmount,
                            contracts.longOrder,
                            contracts.earlyCreationOrder,
                        ],
                        contracts.modifiableTrader.address,
                        0
                    )
                ).wait()
                let eventCounter = 0
                // Make sure InvalidClaimOrder is emitted correct number of times
                receipt.events.filter((x) => {
                    if (
                        x.event === "InvalidClaimOrder" &&
                        x.args.receiptId == 0
                    ) {
                        eventCounter++
                    }
                })
                const expectedNumberOfEventEmissions = 2
                expect(eventCounter).to.equal(expectedNumberOfEventEmissions)
                const result =
                    await contracts.liquidation.callStatic.calcUnitsSold(
                        [
                            contracts.sellHalfLiquidationAmount,
                            contracts.longOrder,
                            contracts.earlyCreationOrder,
                        ],
                        contracts.modifiableTrader.address,
                        0
                    )
                expect(result[0]).to.equal(ethers.utils.parseEther("2500")) // units sold
                expect(result[1]).to.equal(ethers.utils.parseEther("0.5")) // avg price
            })
        })

        context("when orders were created before the receipt", async () => {
            it("Calculates correctly", async () => {
                const contracts = await setupReceiptTest()
                const receiptId = 0

                const receipt = await (
                    await contracts.liquidation.calcUnitsSold(
                        [
                            contracts.earlyCreationOrder,
                            contracts.earlyCreationOrder,
                        ],
                        contracts.modifiableTrader.address,
                        0
                    )
                ).wait()
                let eventCounter = 0
                // Make sure InvalidClaimOrder is emitted correct number of times
                receipt.events.filter((x) => {
                    if (
                        x.event === "InvalidClaimOrder" &&
                        x.args.receiptId == 0
                    ) {
                        eventCounter++
                    }
                })
                const expectedNumberOfEventEmissions = 2
                expect(eventCounter).to.equal(expectedNumberOfEventEmissions)
                const result =
                    await contracts.liquidation.callStatic.calcUnitsSold(
                        [
                            contracts.earlyCreationOrder,
                            contracts.earlyCreationOrder,
                        ],
                        contracts.modifiableTrader.address,
                        0
                    )
                expect(result[0]).to.equal(ethers.utils.parseEther("0")) // units sold
                expect(result[1]).to.equal(ethers.utils.parseEther("0")) // avg price
            })
        })

        context(
            "when orders were created of the wrong side (e.g. long when they should be short)",
            async () => {
                it("Calculates correctly", async () => {
                    const contracts = await setupReceiptTest()

                    const receipt = await (
                        await contracts.liquidation.calcUnitsSold(
                            [contracts.longOrder, contracts.longOrder],
                            contracts.modifiableTrader.address,
                            0
                        )
                    ).wait()
                    let eventCounter = 0
                    // Make sure InvalidClaimOrder is emitted correct number of times
                    receipt.events.filter((x) => {
                        if (
                            x.event === "InvalidClaimOrder" &&
                            x.args.receiptId == 0
                        ) {
                            eventCounter++
                        }
                    })
                    const expectedNumberOfEventEmissions = 2
                    expect(eventCounter).to.equal(
                        expectedNumberOfEventEmissions
                    )
                    const result =
                        await contracts.liquidation.callStatic.calcUnitsSold(
                            [contracts.longOrder, contracts.longOrder],
                            contracts.modifiableTrader.address,
                            0
                        )
                    expect(result[0]).to.equal(ethers.utils.parseEther("0")) // units sold
                    expect(result[1]).to.equal(ethers.utils.parseEther("0")) // avg price
                })
            }
        )

        context(
            "when some orders have different maker to liquidator",
            async () => {
                it("Calculates correctly", async () => {
                    const contracts = await setupReceiptTest()
                    const receiptId = 0

                    const receipt = await (
                        await contracts.liquidation.calcUnitsSold(
                            [
                                contracts.wrongMakerOrder,
                                contracts.wrongMakerOrder,
                            ],
                            contracts.modifiableTrader.address,
                            receiptId
                        )
                    ).wait()
                    let eventCounter = 0
                    // Make sure InvalidClaimOrder is emitted correct number of times
                    receipt.events.filter((x) => {
                        if (
                            x.event === "InvalidClaimOrder" &&
                            x.args.receiptId == 0
                        ) {
                            eventCounter++
                        }
                    })
                    const expectedNumberOfEventEmissions = 2
                    expect(eventCounter).to.equal(
                        expectedNumberOfEventEmissions
                    )
                    const result =
                        await contracts.liquidation.callStatic.calcUnitsSold(
                            [
                                contracts.wrongMakerOrder,
                                contracts.wrongMakerOrder,
                            ],
                            contracts.modifiableTrader.address,
                            0
                        )
                    expect(result[0]).to.equal(ethers.utils.parseEther("0")) // units sold
                    expect(result[1]).to.equal(ethers.utils.parseEther("0")) // avg price
                })
            }
        )
    })
})

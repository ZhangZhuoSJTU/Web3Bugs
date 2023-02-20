// test the earnings calculation for a combination of pre-LIP36 and post-LIP36 rounds.

import Fixture from "./helpers/Fixture"
import {
    contractId,
    functionSig,
    functionEncodedABI
} from "../../utils/helpers"
import {web3, ethers} from "hardhat"

import chai, {assert} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("LIP36 transition", () => {
    let fixture
    let proxy
    let bondingManager

    const NUM_ACTIVE_TRANSCODERS = 2
    const UNBONDING_PERIOD = 2
    const MAX_EARNINGS_CLAIMS_ROUNDS = 20

    const PERC_DIVISOR = 1000000
    const PERC_MULTIPLIER = PERC_DIVISOR / 100

    let bondingManagerFac

    before(async () => {
        fixture = new Fixture(web3)
        await fixture.deploy()

        // Link DoubleSortedLL
        const ll = await (
            await ethers.getContractFactory("SortedDoublyLL")
        ).deploy()
        const BondingManagerPreLIP36Fac = await ethers.getContractFactory(
            "BondingManagerPreLIP36",
            {
                libraries: {
                    SortedDoublyLL: ll.address
                }
            }
        )
        bondingManagerFac = await ethers.getContractFactory("BondingManager", {
            libraries: {
                SortedDoublyLL: ll.address
            }
        })

        // deploy proxy
        proxy = await fixture.deployAndRegister(
            await ethers.getContractFactory("ManagerProxy"),
            "BondingManager",
            fixture.controller.address,
            contractId("BondingManager")
        )

        // deploy proxy target implementation
        await fixture.deployAndRegister(
            BondingManagerPreLIP36Fac,
            "BondingManager",
            fixture.controller.address
        )

        // bind ABI to proxy
        bondingManager = await ethers.getContractAt(
            "BondingManagerPreLIP36",
            proxy.address
        )

        await bondingManager.setUnbondingPeriod(UNBONDING_PERIOD)
        await bondingManager.setNumActiveTranscoders(NUM_ACTIVE_TRANSCODERS)
        await bondingManager.setMaxEarningsClaimsRounds(
            MAX_EARNINGS_CLAIMS_ROUNDS
        )
    })

    beforeEach(async () => {
        await fixture.setUp()
    })

    afterEach(async () => {
        await fixture.tearDown()
    })

    describe("pendingStake", async () => {
        let transcoder
        let delegator
        let signers
        const currentRound = 100

        beforeEach(async () => {
            signers = await ethers.getSigners()
            transcoder = signers[0]
            delegator = signers[1]
            await fixture.roundsManager.setMockBool(
                functionSig("currentRoundInitialized()"),
                true
            )
            await fixture.roundsManager.setMockBool(
                functionSig("currentRoundLocked()"),
                false
            )

            // set reward amount
            await fixture.minter.setMockUint256(
                functionSig("createReward(uint256,uint256)"),
                1000
            )

            // register transcoder
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound - 2
            )
            await bondingManager.bond(1000, transcoder.address)
            await bondingManager.transcoder(
                50 * PERC_MULTIPLIER,
                25 * PERC_MULTIPLIER
            )
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound - 1
            )
            // delegate stake to transcoder
            await bondingManager
                .connect(delegator)
                .bond(1000, transcoder.address)
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )

            // call reward (pre-LIP36)
            await bondingManager.reward()

            // deploy LIP-36
            await fixture.deployAndRegister(
                bondingManagerFac,
                "BondingManager",
                fixture.controller.address
            )
            bondingManager = await ethers.getContractAt(
                "BondingManager",
                proxy.address
            )
            await fixture.roundsManager.setMockUint256(
                functionSig("lipUpgradeRound(uint256)"),
                currentRound
            )

            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound + 1
            )
            await bondingManager.reward()
        })

        describe("delegator", () => {
            it("should return pending rewards for rounds both before and after LIP-36 combined when endRound < currentRound", async () => {
                const pendingRewards0 = 250
                const pendingRewards1 = Math.floor(
                    (500 * ((1250 * PERC_DIVISOR) / 3000)) / PERC_DIVISOR
                )

                assert.equal(
                    (
                        await bondingManager.pendingStake(
                            delegator.address,
                            currentRound
                        )
                    ).toString(),
                    1000 + pendingRewards0 + pendingRewards1,
                    "should return sum of bondedAmount and pending rewards for 2 rounds"
                )
            })

            it("should return pending rewards for rounds both before and after LIP-36 combined when endRound == currentRound", async () => {
                const pendingRewards0 = 250
                const pendingRewards1 = Math.floor(
                    (500 * ((1250 * PERC_DIVISOR) / 3000)) / PERC_DIVISOR
                )

                assert.equal(
                    (
                        await bondingManager.pendingStake(
                            delegator.address,
                            currentRound + 1
                        )
                    ).toString(),
                    1000 + pendingRewards0 + pendingRewards1,
                    "should return sum of bondedAmount and pending rewards for 2 rounds"
                )
            })

            it("should return pending rewards if delegator has already claimed since LIP-36", async () => {
                const pendingRewards0 = 250
                const pendingRewards1 = Math.floor(
                    (500 * ((1250 * PERC_DIVISOR) / 3000)) / PERC_DIVISOR
                )
                const pendingRewards2 = Math.floor(
                    (500 * ((1458 * PERC_DIVISOR) / 4000)) / PERC_DIVISOR
                )
                await bondingManager
                    .connect(delegator)
                    .claimEarnings(currentRound + 1)
                await fixture.roundsManager.setMockUint256(
                    functionSig("currentRound()"),
                    currentRound + 2
                )

                await bondingManager.reward()
                assert.equal(
                    (
                        await bondingManager.pendingStake(
                            delegator.address,
                            currentRound + 2
                        )
                    ).toString(),
                    (
                        1000 +
                        pendingRewards0 +
                        pendingRewards1 +
                        pendingRewards2
                    ).toString()
                )
            })
        })

        describe("transcoder", () => {
            it("should return pending rewards for rounds both before and after LIP-36 combined when endRound < currentRound", async () => {
                const cumulativeRewards = 500
                const pendingRewards0 = 250 + 500
                const pendingRewards1 = Math.floor(
                    (500 * ((1750 * PERC_DIVISOR) / 3000)) / PERC_DIVISOR
                )

                assert.equal(
                    (
                        await bondingManager.pendingStake(
                            transcoder.address,
                            currentRound
                        )
                    ).toNumber(),
                    1000 +
                        pendingRewards0 +
                        pendingRewards1 +
                        cumulativeRewards,
                    "should return sum of bondedAmount and pending rewards as both a delegator and transcoder for 2 rounds"
                )
            })

            it("should return pending rewards for rounds both before and after LIP-36 combined when endRound == currentRound", async () => {
                const cumulativeRewards = 500
                const pendingRewards0 = 250 + 500
                const pendingRewards1 = Math.floor(
                    (500 * ((1750 * PERC_DIVISOR) / 3000)) / PERC_DIVISOR
                )

                assert.equal(
                    (
                        await bondingManager.pendingStake(
                            transcoder.address,
                            currentRound + 1
                        )
                    ).toString(),
                    1000 +
                        pendingRewards0 +
                        pendingRewards1 +
                        cumulativeRewards,
                    "should return sum of bondedAmount and pending rewards as both a delegator and transcoder for 2 rounds"
                )
            })
        })
    })

    describe("pendingStake (reward call in LIP-36 round post-upgrade)", () => {
        let transcoder
        let delegator
        let signers
        const currentRound = 100

        beforeEach(async () => {
            signers = await ethers.getSigners()
            transcoder = signers[0]
            delegator = signers[1]
            await fixture.roundsManager.setMockBool(
                functionSig("currentRoundInitialized()"),
                true
            )
            await fixture.roundsManager.setMockBool(
                functionSig("currentRoundLocked()"),
                false
            )

            // Register transcoder
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound - 2
            )
            await bondingManager.bond(1000, transcoder.address)
            await bondingManager.transcoder(
                50 * PERC_MULTIPLIER,
                25 * PERC_MULTIPLIER
            )

            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound - 1
            )

            // Delegate stake to transcoder
            await bondingManager
                .connect(delegator)
                .bond(1000, transcoder.address)

            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )

            await fixture.minter.setMockUint256(
                functionSig("createReward(uint256,uint256)"),
                1000
            )

            // deploy LIP-36
            await fixture.deployAndRegister(
                bondingManagerFac,
                "BondingManager",
                fixture.controller.address
            )
            bondingManager = await ethers.getContractAt(
                "BondingManager",
                proxy.address
            )
            await fixture.roundsManager.setMockUint256(
                functionSig("lipUpgradeRound(uint256)"),
                currentRound
            )

            await bondingManager.reward()
        })

        it("should return correct pending stake for LIP-36 round", async () => {
            // Check for delegator
            const dPendingRewards0 = 250
            assert.equal(
                (
                    await bondingManager.pendingStake(
                        delegator.address,
                        currentRound
                    )
                ).toString(),
                (1000 + dPendingRewards0).toString()
            )

            // Check for transcoder
            const tPendingRewards = 250 + 500
            assert.equal(
                (
                    await bondingManager.pendingStake(
                        transcoder.address,
                        currentRound
                    )
                ).toNumber(),
                (1000 + tPendingRewards).toString()
            )
        })

        it("should return correct pending stake for LIP-36 round + 1", async () => {
            // Call reward during LIP-36 round + 1
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound + 1
            )
            await bondingManager.reward()

            // Check for delegator
            const dPendingRewards0 = 250
            const dPendingRewards1 = Math.floor(
                (500 * ((1250 * PERC_DIVISOR) / 3000)) / PERC_DIVISOR
            )

            assert.equal(
                (
                    await bondingManager.pendingStake(
                        delegator.address,
                        currentRound + 1
                    )
                ).toString(),
                (1000 + dPendingRewards0 + dPendingRewards1).toString()
            )

            // Check for transcoder
            const cumulativeRewards = 500
            const tPendingRewards0 = 250 + 500
            const tPendingRewards1 = Math.floor(
                (500 * ((1750 * PERC_DIVISOR) / 3000)) / PERC_DIVISOR
            )

            assert.equal(
                (
                    await bondingManager.pendingStake(
                        transcoder.address,
                        currentRound + 1
                    )
                ).toString(),
                (
                    1000 +
                    tPendingRewards0 +
                    tPendingRewards1 +
                    cumulativeRewards
                ).toString()
            )
        })
    })

    describe("pendingFees", () => {
        let transcoder
        let delegator
        let signers
        const currentRound = 100

        beforeEach(async () => {
            signers = await ethers.getSigners()
            transcoder = signers[0]
            delegator = signers[1]
            await fixture.roundsManager.setMockBool(
                functionSig("currentRoundInitialized()"),
                true
            )
            await fixture.roundsManager.setMockBool(
                functionSig("currentRoundLocked()"),
                false
            )

            // Register transcoder
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound - 2
            )
            await bondingManager.bond(1000, transcoder.address)
            await bondingManager.transcoder(
                50 * PERC_MULTIPLIER,
                25 * PERC_MULTIPLIER
            )

            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound - 1
            )

            // delegate stake to transcoder
            // Delegate stake to transcoder
            await bondingManager
                .connect(delegator)
                .bond(1000, transcoder.address)

            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )

            // assign fees pre-LIP36
            await fixture.ticketBroker.execute(
                bondingManager.address,
                functionEncodedABI(
                    "updateTranscoderWithFees(address,uint256,uint256)",
                    ["address", "uint256", "uint256"],
                    [transcoder.address, 1000, currentRound]
                )
            )

            await fixture.minter.setMockUint256(
                functionSig("createReward(uint256,uint256)"),
                1000
            )
            await bondingManager.reward()

            // deploy LIP-36
            await fixture.deployAndRegister(
                bondingManagerFac,
                "BondingManager",
                fixture.controller.address
            )
            bondingManager = await ethers.getContractAt(
                "BondingManager",
                proxy.address
            )
            await fixture.roundsManager.setMockUint256(
                functionSig("lipUpgradeRound(uint256)"),
                currentRound
            )

            // assign fees post-LIP36
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound + 1
            )
            await fixture.ticketBroker.execute(
                bondingManager.address,
                functionEncodedABI(
                    "updateTranscoderWithFees(address,uint256,uint256)",
                    ["address", "uint256", "uint256"],
                    [transcoder.address, 1000, currentRound + 1]
                )
            )

            await bondingManager.reward()
        })

        describe("delegator", () => {
            it("should return pending fees for rounds both before and after LIP-36 combined when endRound < currentRound", async () => {
                const pendingFees0 = 125
                const pendingFees1 = Math.floor(
                    (250 * ((1250 * PERC_DIVISOR) / 3000)) / PERC_DIVISOR
                )

                assert.equal(
                    (
                        await bondingManager.pendingFees(
                            delegator.address,
                            currentRound
                        )
                    ).toString(),
                    pendingFees0 + pendingFees1,
                    "should return sum of collected fees and pending fees for 2 rounds"
                )
            })

            it("should return pending fees for rounds both before and after LIP-36 combined when endRound == currentRound", async () => {
                const pendingFees0 = 125
                const pendingFees1 = Math.floor(
                    (250 * ((1250 * PERC_DIVISOR) / 3000)) / PERC_DIVISOR
                )
                assert.equal(
                    (
                        await bondingManager.pendingFees(
                            delegator.address,
                            currentRound + 1
                        )
                    ).toNumber(),
                    pendingFees0 + pendingFees1,
                    "should return sum of collected fees and pending fees for 2 rounds"
                )
            })

            it("should return pending fees when transcoder has claimed earnings since LIP36", async () => {
                const pendingFees0 = 125
                const pendingFees1 = Math.floor(
                    (250 * ((1250 * PERC_DIVISOR) / 3000)) / PERC_DIVISOR
                )
                const pendingFees2 = Math.floor(
                    (250 * ((1458 * PERC_DIVISOR) / 4000)) / PERC_DIVISOR
                )

                await bondingManager
                    .connect(delegator)
                    .claimEarnings(currentRound + 1)
                const fees = (
                    await bondingManager.getDelegator(delegator.address)
                ).fees
                assert.equal(
                    pendingFees0 + pendingFees1,
                    fees.toNumber(),
                    "delegator fees not correct"
                )
                await fixture.roundsManager.setMockUint256(
                    functionSig("currentRound()"),
                    currentRound + 2
                )

                await fixture.ticketBroker.execute(
                    bondingManager.address,
                    functionEncodedABI(
                        "updateTranscoderWithFees(address,uint256,uint256)",
                        ["address", "uint256", "uint256"],
                        [transcoder.address, 1000, currentRound + 2]
                    )
                )

                await fixture.ticketBroker.execute(
                    bondingManager.address,
                    functionEncodedABI(
                        "updateTranscoderWithFees(address,uint256,uint256)",
                        ["address", "uint256", "uint256"],
                        [transcoder.address, 1000, currentRound + 2]
                    )
                )

                assert.equal(
                    (
                        await bondingManager.pendingFees(
                            delegator.address,
                            currentRound + 2
                        )
                    ).toString(),
                    (pendingFees0 + pendingFees1 + pendingFees2 * 2).toString()
                )
            })
        })

        describe("transcoder", () => {
            it("should return pending fees for rounds both before and after LIP-36 combined when endRound < currentRound", async () => {
                const cumulativeFees = (
                    await bondingManager.getTranscoder(transcoder.address)
                ).cumulativeFees.toNumber()
                const pendingFees0 = 125 + 750
                const pendingFees1 = Math.floor(
                    (250 * ((1750 * PERC_DIVISOR) / 3000)) / PERC_DIVISOR
                )

                assert.equal(
                    (
                        await bondingManager.pendingFees(
                            transcoder.address,
                            currentRound
                        )
                    ).toNumber(),
                    pendingFees0 + pendingFees1 + cumulativeFees,
                    "should return sum of collected fees and pending fees as both a delegator and transcoder for 2 rounds"
                )
            })

            it("should return pending fees for a round both before and after LIP-36 combined when endRound == currentRound", async () => {
                const cumulativeFees = (
                    await bondingManager.getTranscoder(transcoder.address)
                ).cumulativeFees.toNumber()
                const pendingFees0 = 125 + 750
                const pendingFees1 = Math.floor(
                    (250 * ((1750 * PERC_DIVISOR) / 3000)) / PERC_DIVISOR
                )
                assert.equal(
                    (
                        await bondingManager.pendingFees(
                            transcoder.address,
                            currentRound + 1
                        )
                    ).toNumber(),
                    pendingFees0 + pendingFees1 + cumulativeFees,
                    "should return sum of collected fees and pending fees as both a delegator and transcoder for 2 rounds"
                )
            })
        })
    })
})

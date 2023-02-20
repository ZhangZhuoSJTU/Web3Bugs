import RPC from "../../utils/rpc"
import {web3, ethers} from "hardhat"

import chai from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("transcoder pool size gas report", () => {
    let rpc

    let controller
    let bondingManager
    let roundsManager
    let token

    let roundLength

    let signers

    // Creates a full pool using the addresses in `accs`
    // Upon creation, the pool ordering (ascending from last position) is:
    // (accs[0], 1) -> (accs[1], 2) -> (accs[1], 3) -> ... -> (accs[accs.length - 1], accs.length)
    const createFullPool = async accs => {
        await bondingManager.setNumActiveTranscoders(accs.length)
        await Promise.all(accs.map((acc, i) => selfBond(acc, i + 1)))

        await roundsManager.mineBlocks(roundLength.toNumber())
        await roundsManager.initializeRound()
    }

    const approve = async (delegator, amount) => {
        await token.transfer(delegator.address, amount)
        await token.connect(delegator).approve(bondingManager.address, amount)
    }

    const selfBond = async (delegator, amount) => {
        await approve(delegator, amount)
        await bondingManager.connect(delegator).bond(amount, delegator.address)
    }

    before(async () => {
        rpc = new RPC(web3)

        const fixture = await deployments.fixture(["Contracts"])
        controller = await ethers.getContractAt(
            "Controller",
            fixture.Controller.address
        )

        bondingManager = await ethers.getContractAt(
            "BondingManager",
            fixture.BondingManager.address
        )

        roundsManager = await ethers.getContractAt(
            "AdjustableRoundsManager",
            fixture.AdjustableRoundsManager.address
        )

        token = await ethers.getContractAt(
            "LivepeerToken",
            fixture.LivepeerToken.address
        )

        roundLength = await roundsManager.roundLength()

        await controller.unpause()
    })

    const testWithPoolSize = size => {
        let transcoders = []
        let newTranscoder
        let delegator
        describe(`${size} transcoders`, () => {
            let baseSnapshotID
            let testSnapshotID

            before(async () => {
                signers = await ethers.getSigners()
                transcoders = signers.slice(0, size)
                newTranscoder = signers[size]
                delegator = signers[size + 1]
                baseSnapshotID = await rpc.snapshot()

                await createFullPool(transcoders)
            })

            after(async () => {
                await rpc.revert(baseSnapshotID)
            })

            beforeEach(async () => {
                testSnapshotID = await rpc.snapshot()
            })

            afterEach(async () => {
                await rpc.revert(testSnapshotID)
            })

            describe("transcoder", () => {
                // The most expensive transcoder() call occurs when
                // - Caller is not currently in pool
                // - Pool is full
                // - Caller has enough stake to join the pool at the last position
                // - Caller's rewardCut and feeShare are currently 0

                describe("caller not in pool + full pool + join at last position + rewardCut/feeShare = 0", () => {
                    beforeEach(async () => {
                        // Increase transcoders[1] stake to 3
                        await approve(transcoders[1], 1)
                        await bondingManager
                            .connect(transcoders[1])
                            .bond(1, transcoders[1].address)

                        // Pool ordering (ascending from last position):
                        // (transcoders[0], 1) -> (transcoders[2], 3) -> (transcoders[1], 3)

                        // Increase transcoders[0] stake to 2
                        await approve(transcoders[0], 1)
                        await bondingManager
                            .connect(transcoders[0])
                            .bond(1, transcoders[0].address)

                        // Pool ordering (ascending from last position):
                        // (transcoders[0], 2) -> (transcoders[2], 3) -> (transcoders[1], 3)

                        // newTranscoder bonds 2 which is not enough to join the pool because the last transcoder's stake is 2
                        await approve(newTranscoder, 2)
                        await bondingManager
                            .connect(newTranscoder)
                            .bond(2, newTranscoder.address)

                        // Decrease transcoders[0] stake to 1
                        await bondingManager.connect(transcoders[0]).unbond(1)

                        // Pool ordering (ascending from last position):
                        // (transcoders[0], 1) -> (transcoders[2], 3) -> (transcoders[1], 3)
                    })

                    it("insert a new transcoder in the last position and evict the last transcoder", async () => {
                        await bondingManager
                            .connect(newTranscoder)
                            .transcoder(1, 1)
                    })

                    it("insert a new transcoder in the last position and evict the last transcoder (with hint)", async () => {
                        await bondingManager
                            .connect(newTranscoder)
                            .transcoderWithHint(
                                1,
                                1,
                                transcoders[2].address,
                                ethers.constants.AddressZero
                            )
                    })
                })
            })

            describe("bond", () => {
                describe("self bonding", () => {
                    describe("new transcoder bonds enough to join at last position", () => {
                        beforeEach(async () => {
                            // Increase transcoders[1] stake to 3
                            await approve(transcoders[1], 1)
                            await bondingManager
                                .connect(transcoders[1])
                                .bond(1, transcoders[1].address)

                            // Pool ordering (ascending from last position):
                            // (transcoders[0], 1) -> (transcoders[2], 3) -> (transcoders[1], 3)

                            await approve(newTranscoder, 2)
                        })

                        it("insert new transcoder into the last position and evict the last transcoder", async () => {
                            await bondingManager
                                .connect(newTranscoder)
                                .bond(2, newTranscoder.address)
                        })

                        it("insert new transcoder into the last position and evict the last transcoder (with hint)", async () => {
                            await bondingManager
                                .connect(newTranscoder)
                                .bondWithHint(
                                    2,
                                    newTranscoder.address,
                                    ethers.constants.AddressZero,
                                    ethers.constants.AddressZero,
                                    transcoders[2].address,
                                    ethers.constants.AddressZero
                                )
                        })
                    })

                    describe("new transcoder bonds enough to join at first position", () => {
                        beforeEach(async () => {
                            await approve(newTranscoder, size + 1)
                        })

                        it("insert new transcoder into the first position and evict the last transcoder", async () => {
                            await bondingManager
                                .connect(newTranscoder)
                                .bond(size + 1, newTranscoder.address)
                        })

                        it("insert new transcoder into the first position and evict the last transcoder (with hint)", async () => {
                            await bondingManager
                                .connect(newTranscoder)
                                .bondWithHint(
                                    size + 1,
                                    newTranscoder.address,
                                    ethers.constants.AddressZero,
                                    ethers.constants.AddressZero,
                                    ethers.constants.AddressZero,
                                    transcoders[size - 2].address
                                )
                        })
                    })
                })

                describe("delegation", () => {
                    describe("delegator moving stake can drop first transcoder to last position", () => {
                        beforeEach(async () => {
                            // Increase transcoders[0] stake to 2
                            await approve(transcoders[0], 1)
                            await bondingManager
                                .connect(transcoders[0])
                                .bond(1, transcoders[0].address)

                            // Decrease transcoders[size - 1] stake by `size - 1` so that its stake becomes 1
                            const amount = size - 1
                            await bondingManager
                                .connect(transcoders[size - 1])
                                .unbond(amount)

                            // Pool ordering (ascending from last position):
                            // (transcoders[size - 1], 1) -> (transcoders[1], 2) -> (transcoders[0], 2)

                            // delegator delegates to transcoders[size - 1] and increases its stake back to `size`
                            // Now transcoders[size - 1] -> first transcoder
                            await approve(delegator, amount)
                            await bondingManager
                                .connect(delegator)
                                .bond(amount, transcoders[size - 1].address)
                        })

                        it("move first transcoder to last position and last transcoder to first position", async () => {
                            await bondingManager
                                .connect(delegator)
                                .bond(0, transcoders[1].address)
                        })

                        it("move first transcoder to last position and last transcoder to first position (with hint)", async () => {
                            await bondingManager
                                .connect(delegator)
                                .bondWithHint(
                                    0,
                                    transcoders[1].address,
                                    transcoders[1].address,
                                    ethers.constants.AddressZero,
                                    ethers.constants.AddressZero,
                                    transcoders[size - 2].address
                                )
                        })
                    })

                    describe("delegator delegates to first transcoder", () => {
                        beforeEach(async () => {
                            await approve(delegator, 100)
                        })

                        it("delegate to first transcoder", async () => {
                            await bondingManager
                                .connect(delegator)
                                .bond(100, transcoders[size - 1].address)
                        })

                        it("delegate to first transcoder (with hint)", async () => {
                            await bondingManager
                                .connect(delegator)
                                .bondWithHint(
                                    100,
                                    transcoders[size - 1].address,
                                    ethers.constants.AddressZero,
                                    ethers.constants.AddressZero,
                                    ethers.constants.AddressZero,
                                    transcoders[size - 2].address
                                )
                        })
                    })
                })
            })

            describe("unbond", () => {
                // The most expensive unbond() call happens when the first transcoder is moved to the last position

                beforeEach(async () => {
                    // Increase transcoders[0] stake to 2
                    await approve(transcoders[0], 1)
                    await bondingManager
                        .connect(transcoders[0])
                        .bond(1, transcoders[0].address)

                    // Pool ordering (ascending from last position):
                    // (transcoders[1], 2) -> (transcoders[0], 2)
                })

                it("moves the first transcoder to the last position", async () => {
                    await bondingManager
                        .connect(transcoders[size - 1])
                        .unbond(size - 1)
                })

                it("moves the first transcoder to the last position (with hint)", async () => {
                    await bondingManager
                        .connect(transcoders[size - 1])
                        .unbondWithHint(
                            size - 1,
                            transcoders[1].address,
                            ethers.constants.AddressZero
                        )
                })

                it("keeps the first transcoder in first position", async () => {
                    await bondingManager
                        .connect(transcoders[size - 1])
                        .unbond(1)
                })

                it("keeps the first transcoder in first position (with hint)", async () => {
                    await bondingManager
                        .connect(transcoders[size - 1])
                        .unbondWithHint(
                            1,
                            ethers.constants.AddressZero,
                            transcoders[size - 2].address
                        )
                })
            })

            describe("rebond", () => {
                // The most expensive rebond() call happens when a transcoder not in the pool is inserted in the last position

                const unbondingLockID = 0

                describe("last transcoder can rebond and still be last", () => {
                    beforeEach(async () => {
                        await approve(transcoders[0], 1)
                        await bondingManager
                            .connect(transcoders[0])
                            .bond(1, transcoders[0].address)
                        await approve(transcoders[1], 1)
                        await bondingManager
                            .connect(transcoders[1])
                            .bond(1, transcoders[1].address)

                        // Pool order (ascending from last position):
                        // (transcoders[0], 2) -> (transcoders[2], 3) -> (transcoders[1], 3)

                        await bondingManager.connect(transcoders[0]).unbond(1)
                    })

                    it("inserts a transcoder into the last spot", async () => {
                        await bondingManager
                            .connect(transcoders[0])
                            .rebond(unbondingLockID)
                    })

                    it("inserts a transcoder into the last spot (with hint)", async () => {
                        await bondingManager
                            .connect(transcoders[0])
                            .rebondWithHint(
                                unbondingLockID,
                                transcoders[2].address,
                                ethers.constants.AddressZero
                            )
                    })
                })

                describe("first transcoder can rebond and still be first", () => {
                    beforeEach(async () => {
                        await bondingManager
                            .connect(transcoders[size - 1])
                            .unbond(1)
                    })

                    it("keeps transcoder in first place", async () => {
                        await bondingManager
                            .connect(transcoders[size - 1])
                            .rebond(unbondingLockID)
                    })

                    it("keeps transcoder in first place (with hint)", async () => {
                        await bondingManager
                            .connect(transcoders[size - 1])
                            .rebondWithHint(
                                unbondingLockID,
                                ethers.constants.AddressZero,
                                transcoders[size - 2].address
                            )
                    })
                })
            })

            describe("rebondFromUnbonded", () => {
                // The most expensive rebondFromUnbonded() call occurs when a transcoder not in the pool is inserted in the last position

                const unbondingLockID = 0

                describe("last transcoder is unbonded", () => {
                    beforeEach(async () => {
                        // The last transcoder's stake is 1 so unbonding 1 will remove it from the pool
                        await bondingManager.connect(transcoders[0]).unbond(1)
                    })

                    it("inserts a transcoder back into the last spot", async () => {
                        await bondingManager
                            .connect(transcoders[0])
                            .rebondFromUnbonded(
                                transcoders[0].address,
                                unbondingLockID
                            )
                    })

                    it("inserts a transcoder back into the last spot (with hint)", async () => {
                        await bondingManager
                            .connect(transcoders[0])
                            .rebondFromUnbondedWithHint(
                                transcoders[0].address,
                                unbondingLockID,
                                transcoders[1].address,
                                ethers.constants.AddressZero
                            )
                    })
                })

                describe("first transcoder is unbonded", () => {
                    beforeEach(async () => {
                        // The first transcoder's stake is `size` so unbonding `size` will remove it from the pool
                        await bondingManager
                            .connect(transcoders[size - 1])
                            .unbond(size)
                    })

                    it("inserts a transcoder back into the first spot", async () => {
                        await bondingManager
                            .connect(transcoders[size - 1])
                            .rebondFromUnbonded(
                                signers[size - 1].address,
                                unbondingLockID
                            )
                    })

                    it("inserts a transcoder back into the first spot (with hint)", async () => {
                        await bondingManager
                            .connect(transcoders[size - 1])
                            .rebondFromUnbondedWithHint(
                                signers[size - 1].address,
                                unbondingLockID,
                                ethers.constants.AddressZero,
                                transcoders[size - 2].address
                            )
                    })
                })
            })

            describe("reward", () => {
                // The most expensive reward() call occurs when:
                // - The transcoder hasn't called reward for more than 1 round
                // - The transcoder hasn't received stake updates in the last round
                // - The transcoder is in the last position in the list

                describe("called by last transcoder", () => {
                    beforeEach(async () => {
                        // Initialize an extra round so that the transcoder's lastActiveStakeUpdateRound < currentRound
                        await roundsManager.mineBlocks(roundLength.toNumber())
                        await roundsManager.initializeRound()

                        // All transcoders besides transcoders[0] (the last position) call reward
                        const rewardTranscoders = transcoders.slice(1)
                        for (const tr of rewardTranscoders) {
                            await bondingManager.connect(tr).reward()
                        }
                    })

                    it("updates the key for the last transcoder in the pool", async () => {
                        await bondingManager.connect(transcoders[0]).reward()
                    })

                    it("updates the key for the last transcoder in the pool (with hint)", async () => {
                        await bondingManager
                            .connect(transcoders[0])
                            .rewardWithHint(
                                transcoders[1].address,
                                ethers.constants.AddressZero
                            )
                    })
                })
            })
        })
    }

    testWithPoolSize(100)
    testWithPoolSize(200)
})

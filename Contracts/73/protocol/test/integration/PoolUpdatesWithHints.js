import RPC from "../../utils/rpc"
import {deployments, ethers} from "hardhat"
import chai, {assert, expect} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("PoolUpdatesWithHints", () => {
    let rpc
    let snapshotId
    let signers

    let controller
    let bondingManager
    let roundsManager
    let token

    let roundLength

    // Default active set size is 10
    let transcoders
    let delegator
    let newTranscoder

    // Creates a full pool using the addresses in `accs`
    // Upon creation, the pool ordering (descending from first position) is:
    // (accs[0], accs.length) -> (accs[1], accs.length - 1) -> .. -> (accs[accs.length - 1], 1)
    const createFullPool = async accs => {
        let prevAcc = {address: ethers.constants.AddressZero}
        let stake = accs.length
        for (const acc of accs) {
            await selfBond(acc, stake, prevAcc, ethers.constants.AddressZero)
            prevAcc = acc
            stake--
        }

        await roundsManager.mineBlocks(roundLength.toNumber())
        await roundsManager.initializeRound()
    }

    const approve = async (delegator, amount) => {
        await token.transfer(delegator.address, amount)
        await token.connect(delegator).approve(bondingManager.address, amount)
    }

    const selfBond = async (delegator, amount, newPosPrev, newPosNext) => {
        await approve(delegator, amount)
        await bondingManager
            .connect(delegator)
            .bondWithHint(
                amount,
                delegator.address,
                ethers.constants.AddressZero,
                ethers.constants.AddressZero,
                newPosPrev.address,
                newPosNext
            )
    }

    const transcoderAtPoolPos = async pos => {
        const pool = await transcoderPool()
        return pool[pos]
    }

    const transcoderPool = async () => {
        const pool = []
        let tr = await bondingManager.getFirstTranscoderInPool()

        while (tr != ethers.constants.AddressZero) {
            pool.push(tr)
            tr = await bondingManager.getNextTranscoderInPool(tr)
        }

        return pool
    }

    before(async () => {
        signers = await ethers.getSigners()
        transcoders = signers.slice(0, 10)
        delegator = signers[11]
        newTranscoder = signers[12]
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

        await createFullPool(transcoders)
    })

    beforeEach(async () => {
        snapshotId = await rpc.snapshot()
    })

    afterEach(async () => {
        await rpc.revert(snapshotId)
    })

    it("initial transcoder pool order should be correct", async () => {
        const pool = await transcoderPool()

        for (let i = 0; i < transcoders.length; i++) {
            assert.equal(pool[i], transcoders[i].address)
        }
    })

    it("transcoder calls reward with hint", async () => {
        // All transcoders call reward() except for the last one
        const size = transcoders.length - 1
        const rewardTranscoders = transcoders.slice(0, size - 1)
        for (const tr of rewardTranscoders) {
            await bondingManager.connect(tr).reward()
        }

        const testSnapshotId = await rpc.snapshot()

        // Get gas cost of reward()
        const txResNoHint = await (
            await bondingManager.connect(transcoders[size - 1]).reward()
        ).wait()
        assert.equal(
            await transcoderAtPoolPos(size - 1),
            transcoders[size - 1].address
        )

        await rpc.revert(testSnapshotId)

        // Get gas cost rewardWithHint()
        const txResHint = await (
            await bondingManager
                .connect(transcoders[size - 1])
                .rewardWithHint(
                    transcoders[size - 2].address,
                    ethers.constants.AddressZero
                )
        ).wait()
        assert.equal(
            await transcoderAtPoolPos(size - 1),
            transcoders[size - 1].address
        )

        // Gas cost of rewardWithHint() should be less than gas cost of reward()
        assert.isBelow(
            txResHint.cumulativeGasUsed,
            txResNoHint.cumulativeGasUsed
        )
    })

    it("new transcoder joins the pool", async () => {
        const size = transcoders.length
        await approve(transcoders[size - 2], 1)
        await bondingManager
            .connect(transcoders[size - 2])
            .bond(1, transcoders[size - 2].address)
        await approve(transcoders[size - 1], 1)
        await bondingManager
            .connect(transcoders[size - 1])
            .bond(1, transcoders[size - 1].address)

        // Not enough stake to join pool
        await approve(newTranscoder, 2)
        await bondingManager
            .connect(newTranscoder)
            .bond(2, newTranscoder.address)

        // After this tx, the new transcoder should have enough stake to join pool
        await bondingManager.connect(transcoders[size - 1]).unbond(1)
        const dr = (await roundsManager.currentRound()).add(1)
        const testSnapshotId = await rpc.snapshot()

        // Pool ordering (descending)
        // (transcoders[size - 4], 4) -> (transcoders[size - 2], 3) -> (transcoders[size - 3], 3) -> (transcoders[size - 1], 2)

        // Get gas cost of transcoder()
        let tx = await bondingManager.connect(newTranscoder).transcoder(0, 0)
        const txResNoHint = await tx.wait()

        assert.equal(await transcoderAtPoolPos(size - 1), newTranscoder.address)
        await expect(tx)
            .to.emit(bondingManager, "TranscoderDeactivated")
            .withArgs(transcoders[size - 1].address, dr)

        await rpc.revert(testSnapshotId)

        // Get gas cost of transcoderWithHint()
        tx = await bondingManager
            .connect(newTranscoder)
            .transcoderWithHint(
                0,
                0,
                transcoders[size - 3].address,
                ethers.constants.AddressZero
            )

        const txResHint = await tx.wait()
        assert.equal(await transcoderAtPoolPos(size - 1), newTranscoder.address)
        await expect(tx)
            .to.emit(bondingManager, "TranscoderDeactivated")
            .withArgs(transcoders[size - 1].address, dr)

        // Gas cost of transcoderWithHint() should be less than gas cost of transcoder()
        assert.isBelow(
            txResHint.cumulativeGasUsed,
            txResNoHint.cumulativeGasUsed
        )
    })

    it("delegator bonds with hint", async () => {
        const size = transcoders.length
        await approve(delegator, 1)

        const testSnapshotId = await rpc.snapshot()

        // Pool ordering (descending)
        // (transcoders[size - 4], 4) -> (transcoders[size - 3], 3) -> (transcoders[size - 2], 2) -> (transcoders[size - 1], 1)

        // Get gas cost of bond()
        const txResNoHint = await (
            await bondingManager
                .connect(delegator)
                .bond(1, transcoders[size - 2].address)
        ).wait()
        // transcoders[size - 2] should have moved up one position
        assert.equal(
            await transcoderAtPoolPos(size - 3),
            transcoders[size - 2].address
        )

        await rpc.revert(testSnapshotId)

        // Get gas cost of bondWithHint()
        const txResHint = await (
            await bondingManager
                .connect(delegator)
                .bondWithHint(
                    1,
                    transcoders[size - 2].address,
                    ethers.constants.AddressZero,
                    ethers.constants.AddressZero,
                    transcoders[size - 4].address,
                    transcoders[size - 3].address
                )
        ).wait()
        // transcoders[size - 2] should have moved up one position
        assert.equal(
            await transcoderAtPoolPos(size - 3),
            transcoders[size - 2].address
        )

        // Gas cost of bondWithHint() should be less than gas cost of bond()
        assert.isBelow(
            txResHint.cumulativeGasUsed,
            txResNoHint.cumulativeGasUsed
        )
    })

    it("delegator changes delegation with hint", async () => {
        const size = transcoders.length
        await approve(delegator, 1)
        await bondingManager
            .connect(delegator)
            .bond(1, transcoders[size - 2].address)

        const testSnapshotId = await rpc.snapshot()

        // Pool ordering (descending)
        // Before:
        // (transcoders[size - 4], 4) -> (transcoders[size - 2], 3) -> (transcoders[size - 3], 3) -> (transcoders[size - 1], 1)
        // After (expected):
        // (transcoders[size - 4], 4) -> (transcoders[size - 3], 3) -> (transcoders[size - 1], 2) -> (transcoders[size - 2], 2)

        // Get gas cost of bond()
        const txResNoHint = await (
            await bondingManager
                .connect(delegator)
                .bond(0, transcoders[size - 1].address)
        ).wait()
        assert.equal(
            await transcoderAtPoolPos(size - 1),
            transcoders[size - 2].address
        )
        assert.equal(
            await transcoderAtPoolPos(size - 2),
            transcoders[size - 1].address
        )

        await rpc.revert(testSnapshotId)

        // Get gas cost of bondWithHint()
        const txResHint = await (
            await bondingManager
                .connect(delegator)
                .bondWithHint(
                    0,
                    transcoders[size - 1].address,
                    transcoders[size - 3].address,
                    transcoders[size - 1].address,
                    transcoders[size - 3].address,
                    transcoders[size - 2].address
                )
        ).wait()

        assert.equal(
            await transcoderAtPoolPos(size - 1),
            transcoders[size - 2].address
        )
        assert.equal(
            await transcoderAtPoolPos(size - 2),
            transcoders[size - 1].address
        )

        // Gas cost of bondWithHint() should be less than gas cost of bond()
        assert.isBelow(
            txResHint.cumulativeGasUsed,
            txResNoHint.cumulativeGasUsed
        )
    })

    it("transcoder partially unbonds and rebonds", async () => {
        const size = transcoders.length

        const testSnapshotId = await rpc.snapshot()

        // Pool ordering (descending)
        // Before:
        // (transcoders[size - 4], 4) -> (transcoders[size - 3], 3) -> (transcoders[size - 2], 2) -> (transcoders[size - 1], 1)

        const txResUnbondNoHint = await (
            await bondingManager.connect(transcoders[size - 4]).unbond(2)
        ).wait()
        // Should have dropped 1 position
        assert.equal(
            await transcoderAtPoolPos(size - 3),
            transcoders[size - 4].address
        )
        const txResRebondNoHint = await (
            await bondingManager.connect(transcoders[size - 4]).rebond(0)
        ).wait()
        // Should have gained 1 position
        assert.equal(
            await transcoderAtPoolPos(size - 4),
            transcoders[size - 4].address
        )

        await rpc.revert(testSnapshotId)

        const txResUnbondHint = await (
            await bondingManager
                .connect(transcoders[size - 4])
                .unbondWithHint(
                    2,
                    transcoders[size - 3].address,
                    transcoders[size - 2].address
                )
        ).wait()
        // Should have dropped 1 position
        assert.equal(
            await transcoderAtPoolPos(size - 3),
            transcoders[size - 4].address
        )
        const txResRebondHint = await (
            await bondingManager
                .connect(transcoders[size - 4])
                .rebondWithHint(
                    0,
                    transcoders[size - 5].address,
                    transcoders[size - 3].address
                )
        ).wait()
        // Should have gained 1 position
        assert.equal(
            await transcoderAtPoolPos(size - 4),
            transcoders[size - 4].address
        )

        assert.isBelow(
            txResUnbondHint.cumulativeGasUsed,
            txResUnbondNoHint.cumulativeGasUsed
        )
        assert.isBelow(
            txResRebondHint.cumulativeGasUsed,
            txResRebondNoHint.cumulativeGasUsed
        )
    })

    it("transcoder rebonds from unbonded", async () => {
        const size = transcoders.length
        await bondingManager.connect(transcoders[size - 4]).unbond(4)

        const testSnapshotId = await rpc.snapshot()

        // Pool ordering (descending)
        // Before:
        // (transcoders[size - 3], 3) -> (transcoders[size - 2], 2) -> (transcoders[size - 1], 1)
        // After (expected):
        // (transcoders[size - 4], 4) -> (transcoders[size - 3], 3) -> (transcoders[size - 2], 2) -> (transcoders[size - 1], 1)

        const txResNoHint = await (
            await bondingManager
                .connect(transcoders[size - 4])
                .rebondFromUnbonded(transcoders[size - 4].address, 0)
        ).wait()
        assert.equal(
            await transcoderAtPoolPos(size - 4),
            transcoders[size - 4].address
        )

        await rpc.revert(testSnapshotId)

        const txResHint = await (
            await bondingManager
                .connect(transcoders[size - 4])
                .rebondFromUnbondedWithHint(
                    transcoders[size - 4].address,
                    0,
                    transcoders[size - 5].address,
                    transcoders[size - 3].address
                )
        ).wait()
        assert.equal(
            await transcoderAtPoolPos(size - 4),
            transcoders[size - 4].address
        )

        assert.isBelow(
            txResHint.cumulativeGasUsed,
            txResNoHint.cumulativeGasUsed
        )
    })
})

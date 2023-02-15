import {constants} from "../../utils/constants"
import {deployments, ethers} from "hardhat"
import {BigNumber} from "ethers"
import chai, {expect, assert} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)
const {DelegatorStatus} = constants

describe("Delegation", () => {
    let controller
    let bondingManager
    let roundsManager
    let token

    let minterAddr

    let signers

    let transcoder1
    let transcoder2
    let delegator1
    let delegator2

    let roundLength

    before(async () => {
        signers = await ethers.getSigners()
        transcoder1 = signers[0]
        transcoder2 = signers[1]
        delegator1 = signers[2]
        delegator2 = signers[3]
        const fixture = await deployments.fixture(["Contracts"])
        controller = await ethers.getContractAt(
            "Controller",
            fixture.Controller.address
        )
        await controller.unpause()

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

        minterAddr = await ethers.getContractAt(
            "Minter",
            fixture.Minter.address
        )

        const transferAmount = ethers.utils.parseEther("10")
        await token.transfer(transcoder1.address, transferAmount)
        await token.transfer(transcoder2.address, transferAmount)
        await token.transfer(delegator1.address, transferAmount)
        await token.transfer(delegator2.address, transferAmount)

        roundLength = await roundsManager.roundLength()
        await roundsManager.mineBlocks(roundLength.toNumber() * 1000)
        await roundsManager.initializeRound()
    })

    it("next total stake starts off at 0", async () => {
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            0,
            "wrong next total stake"
        )
    })

    it("registers transcoder 1 that self bonds", async () => {
        await token.connect(transcoder1).approve(bondingManager.address, 1000)
        await bondingManager
            .connect(transcoder1)
            .bond(1000, transcoder1.address)
        await bondingManager.connect(transcoder1).transcoder(0, 5)
        assert.isTrue(
            await bondingManager.isRegisteredTranscoder(transcoder1.address),
            "wrong transcoder status"
        )
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            1000,
            "wrong next total stake"
        )
    })

    it("registers transcoder 2 that self bonds", async () => {
        await token.connect(transcoder2).approve(bondingManager.address, 1000)
        await bondingManager
            .connect(transcoder2)
            .bond(1000, transcoder2.address)
        await bondingManager.connect(transcoder2).transcoder(0, 5)
        assert.isTrue(
            await bondingManager.isRegisteredTranscoder(transcoder2.address),
            "wrong transcoder status"
        )
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            2000,
            "wrong next total stake"
        )
    })

    it("delegator 1 bonds to transcoder 1", async () => {
        await token.connect(delegator1).approve(bondingManager.address, 1000)
        await bondingManager.connect(delegator1).bond(1000, transcoder1.address)

        // Stake counted (+1000) since transcoder is in pool
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            3000,
            "wrong next total stake"
        )

        const bond = (await bondingManager.getDelegator(delegator1.address))[0]
        assert.equal(bond, 1000, "delegator 1 bonded amount incorrect")
    })

    it("delegator 2 bonds to transcoder 1", async () => {
        await token.connect(delegator2).approve(bondingManager.address, 1000)
        await bondingManager.connect(delegator2).bond(1000, transcoder1.address)

        // Stake counted (+1000) since transcoder is in pool
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            4000,
            "wrong next total stake"
        )

        const bond = (await bondingManager.getDelegator(delegator2.address))[0]
        assert.equal(bond, 1000, "delegator 2 bonded amount incorrect")
    })

    it("delegator 1 delegates to transcoder 2", async () => {
        await bondingManager.connect(delegator1).bond(0, transcoder2.address)

        // Moving stake doesn't change next total stake
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            4000,
            "wrong next total stake"
        )

        const delegate = (
            await bondingManager.getDelegator(delegator1.address)
        )[2]
        assert.equal(
            delegate,
            transcoder2.address,
            "delegator 1 delegate incorrect"
        )
        const delegatedStake = (
            await bondingManager.getDelegator(transcoder2.address)
        )[3]
        assert.equal(delegatedStake, 2000, "wrong delegated stake")
    })

    it("delegator 2 delegates to transcoder 2", async () => {
        await bondingManager.connect(delegator2).bond(0, transcoder2.address)

        // Moving stake doesn't change next total stake
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            4000,
            "wrong next total stake"
        )

        const delegate = (
            await bondingManager.getDelegator(delegator2.address)
        )[2]
        assert.equal(
            delegate,
            transcoder2.address,
            "delegator 2 delegate incorrect"
        )
        const delegatedStake = (
            await bondingManager.getDelegator(transcoder2.address)
        )[3]
        assert.equal(delegatedStake, 3000, "wrong delegated stake")
    })

    it("delegator 1 delegates more to transcoder 2", async () => {
        const startBond = (
            await bondingManager.getDelegator(delegator1.address)
        )[0]

        await token.connect(delegator1).approve(bondingManager.address, 1000)
        await bondingManager.connect(delegator1).bond(1000, transcoder2.address)

        // Stake counted (+1000) since transcoder is in pool
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            5000,
            "wrong next total stake"
        )

        const endBond = (
            await bondingManager.getDelegator(delegator1.address)
        )[0]
        assert.equal(
            endBond.sub(startBond),
            1000,
            "delegator 1 bonded amount did not increase correctly"
        )
    })

    it("transcoder 1 tries to bond to transcoder 2 and fails", async () => {
        await expect(
            bondingManager.connect(transcoder1).bond(0, transcoder2.address)
        ).to.be.reverted
    })

    it("delegator 1 partially unbonds twice (at different times), rebonds with one unbonding lock and withdraws with the other", async () => {
        await roundsManager.mineBlocks(roundLength)
        await roundsManager.initializeRound()

        const unbondingPeriod = await bondingManager.unbondingPeriod()
        const startDelegatorBondedAmount = (
            await bondingManager.getDelegator(delegator1.address)
        )[0].toNumber()
        const startDelegatorTokenBalance = await token.balanceOf(
            delegator1.address
        )
        const startMinterTokenBalance = await token.balanceOf(
            minterAddr.address
        )
        const startTranscoderDelegatedAmount = (
            await bondingManager.getDelegator(transcoder2.address)
        )[3].toNumber()
        const startNextTotalStake = (
            await bondingManager.nextRoundTotalActiveStake()
        ).toNumber()

        const unbondingLockID0 = 0
        const unbondingLockID1 = 1

        // Delegator 1 partially unbonds from transcoder 2
        // unbondingLockID = 0
        await bondingManager.connect(delegator1).unbond(500)

        // Test state after unbond 0
        let lock0 = await bondingManager.getDelegatorUnbondingLock(
            delegator1.address,
            unbondingLockID0
        )
        assert.equal(lock0[0], 500, "wrong amount for unbonding lock 0")
        assert.equal(
            lock0[1],
            (await roundsManager.currentRound())
                .add(unbondingPeriod)
                .toNumber(),
            "wrong withdrawRound for unbonding lock 0"
        )

        let dInfo = await bondingManager.getDelegator(delegator1.address)
        assert.equal(
            dInfo[0],
            startDelegatorBondedAmount - 500,
            "wrong delegator bonded amount after unbond 0"
        )
        assert.equal(
            dInfo[6],
            1,
            "wrong delegator unbondingLockId after unbond 0"
        )

        let tDInfo = await bondingManager.getDelegator(transcoder2.address)
        assert.equal(
            tDInfo[3],
            startTranscoderDelegatedAmount - 500,
            "wrong transcoder delegated amount after unbond 0"
        )

        assert.equal(
            await bondingManager.transcoderTotalStake(transcoder2.address),
            startTranscoderDelegatedAmount - 500,
            "wrong transcoder delegated stake after unbond 0"
        )
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            startNextTotalStake - 500,
            "wrong next total stake after unbond 0"
        )

        await roundsManager.mineBlocks(roundLength)
        await roundsManager.initializeRound()

        // Delegator 1 partially unbonds from transcoder 2
        // unbondingLockID = 1
        await bondingManager.connect(delegator1).unbond(700)

        // Test state after unbond 1
        let lock1 = await bondingManager.getDelegatorUnbondingLock(
            delegator1.address,
            unbondingLockID1
        )
        assert.equal(lock1[0], 700, "wrong amount for unbonding lock 1")
        assert.equal(
            lock1[1],
            (await roundsManager.currentRound())
                .add(unbondingPeriod)
                .toNumber(),
            "wrong withdrawRound for unbonding lock 1"
        )

        dInfo = await bondingManager.getDelegator(delegator1.address)
        assert.equal(
            dInfo[0],
            startDelegatorBondedAmount - 1200,
            "wrong delegator bonded amount after unbond 1"
        )
        assert.equal(
            dInfo[6],
            2,
            "wrong delegator unbondingLockId after unbond 1"
        )

        tDInfo = await bondingManager.getDelegator(transcoder2.address)
        assert.equal(
            tDInfo[3],
            startTranscoderDelegatedAmount - 1200,
            "wrong transcoder delegated amount after unbond 1"
        )

        assert.equal(
            await bondingManager.transcoderTotalStake(transcoder2.address),
            startTranscoderDelegatedAmount - 1200,
            "wrong transcoder delegated stake after unbond 1"
        )
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            startNextTotalStake - 1200,
            "wrong next total stake after unbond 1"
        )

        await roundsManager.mineBlocks(roundLength)
        await roundsManager.initializeRound()

        // Delegator 1 rebonds with unbonding lock 0 to transcoder 2
        await bondingManager.connect(delegator1).rebond(unbondingLockID0)

        // Test state after rebond
        dInfo = await bondingManager.getDelegator(delegator1.address)
        assert.equal(
            dInfo[0],
            startDelegatorBondedAmount - 700,
            "wrong delegator bonded amount after rebond"
        )

        tDInfo = await bondingManager.getDelegator(transcoder2.address)
        assert.equal(
            tDInfo[3],
            startTranscoderDelegatedAmount - 700,
            "wrong transcoder delegated amount after rebond"
        )

        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            startNextTotalStake - 700,
            "wrong next total stake after rebond"
        )
        assert.equal(
            await bondingManager.transcoderTotalStake(transcoder2.address),
            startTranscoderDelegatedAmount - 700,
            "wrong transcoder delegated stake after rebond"
        )

        lock0 = await bondingManager.getDelegatorUnbondingLock(
            delegator1.address,
            unbondingLockID0
        )
        assert.equal(
            lock0[0],
            0,
            "wrong amount for unbonding lock 0 - should be 0"
        )
        assert.equal(
            lock0[1],
            0,
            "wrong withdrawRound for unbonding lock 0 - should be 0"
        )

        await roundsManager.mineBlocks(unbondingPeriod.toNumber() * roundLength)
        await roundsManager.initializeRound()

        // Delegator 1 withdraws with unbonding lock 1
        await bondingManager.connect(delegator1).withdrawStake(unbondingLockID1)

        // Test state after withdrawStake
        lock1 = await bondingManager.getDelegatorUnbondingLock(
            delegator1.address,
            unbondingLockID1
        )
        assert.equal(
            lock1[0],
            0,
            "wrong amount for unbonding lock 1 - shoud be 0"
        )
        assert.equal(
            lock1[1],
            0,
            "wrong withdrawRound for unbonding lock 1 - should be 0"
        )

        assert.equal(
            (await token.balanceOf(delegator1.address)).toString(),
            startDelegatorTokenBalance.add(BigNumber.from(700)).toString(),
            "wrong delegator token balance after withdrawStake"
        )
        assert.equal(
            (await token.balanceOf(minterAddr.address)).toString(),
            startMinterTokenBalance.sub(BigNumber.from(700)).toString(),
            "wrong minter token balance after withdrawStake"
        )
    })

    it("delegator 2 fully unbonds, bonds to transcoder 1 and also rebonds with existing unbonding lock", async () => {
        await roundsManager.mineBlocks(roundLength)
        await roundsManager.initializeRound()

        const unbondingPeriod = await bondingManager.unbondingPeriod()
        const startDelegatorBondedAmount = (
            await bondingManager.getDelegator(delegator2.address)
        )[0].toNumber()
        const startDelegatorTokenBalance = await token.balanceOf(
            delegator2.address
        )
        const startTranscoder1DelegatedAmount = (
            await bondingManager.getDelegator(transcoder1.address)
        )[3].toNumber()
        const startTranscoder2DelegatedAmount = (
            await bondingManager.getDelegator(transcoder2.address)
        )[3].toNumber()
        const startNextTotalStake = (
            await bondingManager.nextRoundTotalActiveStake()
        ).toNumber()

        const unbondingLockID = 0

        // Delegator 2 fully unbonds from transcoder 2
        // unbondingLockID = 0
        await bondingManager
            .connect(delegator2)
            .unbond(startDelegatorBondedAmount)

        // Test state after unbond
        let lock = await bondingManager.getDelegatorUnbondingLock(
            delegator2.address,
            unbondingLockID
        )
        assert.equal(
            lock[0],
            startDelegatorBondedAmount,
            "wrong amount for unbonding lock"
        )
        assert.equal(
            lock[1],
            (await roundsManager.currentRound())
                .add(unbondingPeriod)
                .toNumber(),
            "wrong withdrawRound for unbonding lock"
        )

        let dInfo = await bondingManager.getDelegator(delegator2.address)
        assert.equal(dInfo[0], 0, "wrong delegator bonded amount after unbond")
        assert.equal(
            dInfo[2],
            constants.NULL_ADDRESS,
            "wrong delegator delegate after unbond"
        )
        assert.equal(dInfo[4], 0, "wrong delegator start round after unbond")
        assert.equal(
            dInfo[6],
            1,
            "wrong delegator unbondingLockId after unbond"
        )
        assert.equal(
            await bondingManager.delegatorStatus(delegator2.address),
            DelegatorStatus.Unbonded,
            "wrong delegator status after unbond"
        )

        let tDInfo = await bondingManager.getDelegator(transcoder2.address)
        assert.equal(
            tDInfo[3],
            startTranscoder2DelegatedAmount - startDelegatorBondedAmount,
            "wrong transcoder delegated amount after unbond"
        )

        assert.equal(
            await bondingManager.transcoderTotalStake(transcoder2.address),
            startTranscoder2DelegatedAmount - startDelegatorBondedAmount,
            "wrong transcoder delegated stake after unbond"
        )
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            startNextTotalStake - startDelegatorBondedAmount,
            "wrong next total stake after unbond"
        )

        // Delegator 2 tries to rebond and fails because it is no longer bonded
        await expect(bondingManager.connect(delegator2).rebond(unbondingLockID))
            .to.be.reverted

        // Delegator 2 bonds to transcoder 1
        await token.connect(delegator2).approve(bondingManager.address, 500)
        await bondingManager.connect(delegator2).bond(500, transcoder1.address)

        // Test state after bond
        const currentRound = (await roundsManager.currentRound()).toNumber()

        assert.equal(
            (await token.balanceOf(delegator2.address)).toString(),
            startDelegatorTokenBalance.sub(BigNumber.from(500)).toString(),
            "wrong delegator token balance after bond"
        )

        dInfo = await bondingManager.getDelegator(delegator2.address)
        assert.equal(dInfo[0], 500, "wrong delegator bonded amount after bond")
        assert.equal(
            dInfo[2],
            transcoder1.address,
            "wrong delegator delegate after bond"
        )
        assert.equal(
            dInfo[4],
            currentRound + 1,
            "wrong delegator start round after bond"
        )
        assert.equal(
            dInfo[5],
            currentRound,
            "wrong delegator last claim round after bond"
        )

        tDInfo = await bondingManager.getDelegator(transcoder1.address)
        assert.equal(
            tDInfo[3],
            startTranscoder1DelegatedAmount + 500,
            "wrong transcoder delegated amount after bond"
        )

        assert.equal(
            await bondingManager.transcoderTotalStake(transcoder1.address),
            startTranscoder1DelegatedAmount + 500,
            "wrong transcoder delegated stake after bond"
        )
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            startNextTotalStake - startDelegatorBondedAmount + 500,
            "wrong next total stake after bond"
        )

        // Delegator 2 rebonds with unbonding lock to transcoder 1
        await bondingManager.connect(delegator2).rebond(unbondingLockID)

        // Test state after rebond
        dInfo = await bondingManager.getDelegator(delegator2.address)
        assert.equal(
            dInfo[0],
            startDelegatorBondedAmount + 500,
            "wrong delegator bonded amount after rebond"
        )

        tDInfo = await bondingManager.getDelegator(transcoder1.address)
        assert.equal(
            tDInfo[3],
            startTranscoder1DelegatedAmount + startDelegatorBondedAmount + 500,
            "wrong transcoder delegated amount after rebond"
        )

        assert.equal(
            await bondingManager.transcoderTotalStake(transcoder1.address),
            startTranscoder1DelegatedAmount + startDelegatorBondedAmount + 500,
            "wrong transcoder delegated stake after rebond"
        )
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            startNextTotalStake + 500,
            "wrong next total stake after rebond"
        )

        lock = await bondingManager.getDelegatorUnbondingLock(
            delegator2.address,
            unbondingLockID
        )
        assert.equal(
            lock[0],
            0,
            "wrong amount for unbonding lock - should be 0"
        )
        assert.equal(
            lock[1],
            0,
            "wrong withdrawRound for unbonding lock - should be 0"
        )
    })

    it("delegator 2 fully unbonds, rebonds from unbonded to transcoder 2 and then rebonds (while not unbonded) with existing unbonding locks", async () => {
        await roundsManager.mineBlocks(roundLength)
        await roundsManager.initializeRound()

        const unbondingPeriod = await bondingManager.unbondingPeriod()
        const startDelegatorBondedAmount = (
            await bondingManager.getDelegator(delegator2.address)
        )[0].toNumber()
        const startTranscoder1DelegatedAmount = (
            await bondingManager.getDelegator(transcoder1.address)
        )[3].toNumber()
        const startTranscoder2DelegatedAmount = (
            await bondingManager.getDelegator(transcoder2.address)
        )[3].toNumber()
        const startNextTotalStake = (
            await bondingManager.nextRoundTotalActiveStake()
        ).toNumber()

        const unbondingLockID0 = 1
        const lockAmount0 = Math.floor(startDelegatorBondedAmount / 2)
        const unbondingLockID1 = 2
        const lockAmount1 = startDelegatorBondedAmount - lockAmount0

        // Delegator 2 partially unbonds from transcoder 1
        // unbondingLockID = 1
        await bondingManager.connect(delegator2).unbond(lockAmount0)

        // Test state after unbond
        let lock = await bondingManager.getDelegatorUnbondingLock(
            delegator2.address,
            unbondingLockID0
        )
        assert.equal(lock[0], lockAmount0, "wrong amount for unbonding lock")
        assert.equal(
            lock[1],
            (await roundsManager.currentRound())
                .add(unbondingPeriod)
                .toNumber(),
            "wrong withdrawRound for unbonding lock"
        )

        let dInfo = await bondingManager.getDelegator(delegator2.address)
        assert.equal(
            dInfo[0],
            startDelegatorBondedAmount - lockAmount0,
            "wrong delegator bonded amount after unbond"
        )
        assert.equal(
            dInfo[6],
            2,
            "wrong delegator unbondingLockId after unbond"
        )

        let tDInfo = await bondingManager.getDelegator(transcoder1.address)
        assert.equal(
            tDInfo[3],
            startTranscoder1DelegatedAmount - lockAmount0,
            "wrong transcoder delegated amount after unbond"
        )

        assert.equal(
            await bondingManager.transcoderTotalStake(transcoder1.address),
            startTranscoder1DelegatedAmount - lockAmount0,
            "wrong transcoder delegated stake after unbond"
        )
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            startNextTotalStake - lockAmount0,
            "wrong next total stake after unbond"
        )

        // Delegator 2 fully unbonds from transcoder 2
        // unbondingLockID = 2
        await bondingManager.connect(delegator2).unbond(lockAmount1)

        // Test state after unbond
        lock = await bondingManager.getDelegatorUnbondingLock(
            delegator2.address,
            unbondingLockID1
        )
        assert.equal(lock[0], lockAmount1, "wrong amount for unbonding lock")
        assert.equal(
            lock[1],
            (await roundsManager.currentRound())
                .add(unbondingPeriod)
                .toNumber(),
            "wrong withdrawRound for unbonding lock"
        )

        dInfo = await bondingManager.getDelegator(delegator2.address)
        assert.equal(dInfo[0], 0, "wrong delegator bonded amount after unbond")
        assert.equal(
            dInfo[2],
            constants.NULL_ADDRESS,
            "wrong delegator delegate after unbond"
        )
        assert.equal(dInfo[4], 0, "wrong delegator start round after unbond")
        assert.equal(
            dInfo[6],
            3,
            "wrong delegator unbondingLockId after unbond"
        )
        assert.equal(
            await bondingManager.delegatorStatus(delegator2.address),
            DelegatorStatus.Unbonded,
            "wrong delegator status after unbond"
        )

        tDInfo = await bondingManager.getDelegator(transcoder1.address)
        assert.equal(
            tDInfo[3],
            startTranscoder1DelegatedAmount - startDelegatorBondedAmount,
            "wrong transcoder delegated amount after unbond"
        )

        assert.equal(
            await bondingManager.transcoderTotalStake(transcoder1.address),
            startTranscoder1DelegatedAmount - startDelegatorBondedAmount,
            "wrong transcoder delegated stake after unbond"
        )
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            startNextTotalStake - startDelegatorBondedAmount,
            "wrong next total stake after unbond"
        )

        // Delegator 2 tries to call rebond() and fails because it is no longer bonded
        await expect(
            bondingManager.connect(delegator2).rebond(unbondingLockID0)
        ).to.be.reverted

        // Delegator 2 rebonds from unbonded to transcoder 2
        await bondingManager
            .connect(delegator2)
            .rebondFromUnbonded(transcoder2.address, unbondingLockID0)

        // Test state after rebond from unbonded
        const currentRound = (await roundsManager.currentRound()).toNumber()

        dInfo = await bondingManager.getDelegator(delegator2.address)
        assert.equal(
            dInfo[0],
            lockAmount0,
            "wrong delegator bonded amount after rebond from unbonded"
        )
        assert.equal(
            dInfo[2],
            transcoder2.address,
            "wrong delegator delegate after rebond from unbonded"
        )
        assert.equal(
            dInfo[4],
            currentRound + 1,
            "wrong delegator start round after rebond from unbonded"
        )

        tDInfo = await bondingManager.getDelegator(transcoder2.address)
        assert.equal(
            tDInfo[3],
            startTranscoder2DelegatedAmount + lockAmount0,
            "wrong transcoder delegated amount after rebond from unbonded"
        )

        assert.equal(
            await bondingManager.transcoderTotalStake(transcoder2.address),
            startTranscoder2DelegatedAmount + lockAmount0,
            "wrong transcoder delegated stake after rebond from unbonded"
        )
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            startNextTotalStake - startDelegatorBondedAmount + lockAmount0,
            "wrong next total stake after rebond from unbonded"
        )

        lock = await bondingManager.getDelegatorUnbondingLock(
            delegator2.address,
            unbondingLockID0
        )
        assert.equal(
            lock[0],
            0,
            "wrong amount for unbonding lock - should be 0"
        )
        assert.equal(
            lock[1],
            0,
            "wrong withdrawRound for unbonding lock - should be 0"
        )

        // Delegator 2 rebonds (while not unbonded) with unbonding lock to transcoder 2
        await bondingManager.connect(delegator2).rebond(unbondingLockID1)

        // Test state after rebond
        dInfo = await bondingManager.getDelegator(delegator2.address)
        assert.equal(
            dInfo[0],
            startDelegatorBondedAmount,
            "wrong delegator bonded amount after rebond"
        )

        tDInfo = await bondingManager.getDelegator(transcoder2.address)
        assert.equal(
            tDInfo[3],
            startTranscoder2DelegatedAmount + startDelegatorBondedAmount,
            "wrong transcoder delegated amount after rebond"
        )

        assert.equal(
            await bondingManager.transcoderTotalStake(transcoder2.address),
            startTranscoder2DelegatedAmount + startDelegatorBondedAmount,
            "wrong transcoder delegated stake after rebond"
        )
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            startNextTotalStake,
            "wrong next total stake after rebond"
        )

        lock = await bondingManager.getDelegatorUnbondingLock(
            delegator2.address,
            unbondingLockID1
        )
        assert.equal(
            lock[0],
            0,
            "wrong amount for unbonding lock - should be 0"
        )
        assert.equal(
            lock[1],
            0,
            "wrong withdrawRound for unbonding lock - should be 0"
        )
    })

    it("delegator 1 partially unbonds, earns rewards for 1 round, and rebonds using an unbonding lock", async () => {
        const acceptableDelta = BigNumber.from(1000)

        await roundsManager.mineBlocks(roundLength)
        await roundsManager.initializeRound()

        const unbondingLockID = 2
        let currTotalBonded = await bondingManager.nextRoundTotalActiveStake()

        // Delegator 1 partially unbonds from transcoder 2
        await bondingManager.connect(delegator1).unbond(500)

        // Stake subtracted (-500) since transcoder is in pool
        currTotalBonded = currTotalBonded.sub(BigNumber.from(500))
        assert.equal(
            (await bondingManager.nextRoundTotalActiveStake()).toString(),
            currTotalBonded.toString(),
            "wrong next total stake"
        )

        // Finish current round
        await roundsManager.mineBlocks(roundLength)
        await roundsManager.initializeRound()

        // Transcoder 2 calls reward
        await bondingManager.connect(transcoder2).reward()

        const rewardRound = await roundsManager.currentRound()
        const endRewardFactor = (
            await bondingManager.getTranscoderEarningsPoolForRound(
                transcoder2.address,
                rewardRound
            )
        ).cumulativeRewardFactor
        const bondedAmount = (
            await bondingManager.getTranscoderEarningsPoolForRound(
                transcoder2.address,
                rewardRound
            )
        ).totalStake
        const rewardAmount = bondedAmount.mul(
            endRewardFactor.div(constants.PERC_DIVISOR_PRECISE.toString())
        )
        // Newly minted rewards added
        currTotalBonded = currTotalBonded.add(rewardAmount)
        assert.isTrue(
            (await bondingManager.nextRoundTotalActiveStake())
                .sub(currTotalBonded)
                .abs()
                .lte(acceptableDelta),
            "wrong next total stake"
        )

        // Finish current round - delegator 1 has reward shares for this round
        await roundsManager.mineBlocks(roundLength)
        await roundsManager.initializeRound()

        const startDelegator1BondedAmount = (
            await bondingManager.getDelegator(delegator1.address)
        )[0]
        const startTranscoder2DelegatedAmount = (
            await bondingManager.getDelegator(transcoder2.address)
        )[3]

        // Delegator 1 rebonds with an unbonding lock to transcoder 2
        await bondingManager.connect(delegator1).rebond(unbondingLockID)

        // Test state after rebond
        // Verify reward claiming logic
        const dInfo = await bondingManager.getDelegator(delegator1.address)
        assert.isTrue(
            dInfo[0]
                .sub(
                    startDelegator1BondedAmount
                        .mul(
                            endRewardFactor.div(
                                constants.PERC_DIVISOR_PRECISE.toString()
                            )
                        )
                        .add(BigNumber.from(500))
                )
                .abs()
                .lte(acceptableDelta),
            "wrong delegator bonded amount with claimed rewards and rebond amount"
        )
        assert.equal(
            dInfo[5],
            (await roundsManager.currentRound()).toNumber(),
            "wrong delegator last claim round after rebond"
        )

        const tDInfo = await bondingManager.getDelegator(transcoder2.address)
        assert.equal(
            tDInfo[3].toString(),
            startTranscoder2DelegatedAmount.add(BigNumber.from(500)).toString(),
            "wrong transcoder delegated amount after rebond"
        )

        assert.equal(
            (
                await bondingManager.transcoderTotalStake(transcoder2.address)
            ).toString(),
            startTranscoder2DelegatedAmount.add(BigNumber.from(500)).toString(),
            "wrong transcoder delegated stake after rebond"
        )

        // Stake counted (+500) since transcoder is in pool
        currTotalBonded = currTotalBonded.add(BigNumber.from(500))
        assert.isTrue(
            (await bondingManager.nextRoundTotalActiveStake())
                .sub(currTotalBonded)
                .abs()
                .lte(acceptableDelta),
            "wrong next total stake after rebond"
        )

        const lock = await bondingManager.getDelegatorUnbondingLock(
            delegator1.address,
            unbondingLockID
        )
        assert.equal(
            lock[0],
            0,
            "wrong amount for unbonding lock - should be 0"
        )
        assert.equal(
            lock[1],
            0,
            "wrong withdrawRound for unbonding lock - should be 0"
        )
    })
})

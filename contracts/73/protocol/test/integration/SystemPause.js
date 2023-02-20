import {constants} from "../../utils/constants"

import chai, {assert, expect} from "chai"
import {solidity} from "ethereum-waffle"
import {ethers} from "hardhat"
chai.use(solidity)

describe("System Pause", () => {
    let controller
    let bondingManager
    let roundsManager
    let token

    let transcoder1
    let delegator1
    let delegator2

    let roundLength

    before(async () => {
        const signers = await ethers.getSigners()

        transcoder1 = signers[0]
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

        const transferAmount = ethers.BigNumber.from(10).mul(
            constants.TOKEN_UNIT.toString()
        )
        await token
            .connect(signers[0])
            .transfer(transcoder1.address, transferAmount)
        await token
            .connect(signers[0])
            .transfer(delegator1.address, transferAmount)
        await token
            .connect(signers[0])
            .transfer(delegator2.address, transferAmount)

        roundLength = await roundsManager.roundLength()
        await roundsManager.mineBlocks(roundLength.mul(1000))
        await roundsManager.initializeRound()
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
    })

    it("delegator 1 bonds to transcoder 1", async () => {
        await token.connect(delegator1).approve(bondingManager.address, 1000)
        await bondingManager.connect(delegator1).bond(500, transcoder1.address)

        const bond = (await bondingManager.getDelegator(delegator1.address))[0]
        assert.equal(bond, 500, "delegator 1 bonded amount incorrect")
    })

    it("delegator 2 bonds to transcoder 1", async () => {
        await token.connect(delegator2).approve(bondingManager.address, 1000)
        await bondingManager.connect(delegator2).bond(500, transcoder1.address)

        const bond = (await bondingManager.getDelegator(delegator2.address))[0]
        assert.equal(bond, 500, "delegator 2 bonded amount incorrect")
    })

    it("transcoder calls reward, system is paused and resumed 5 rounds later", async () => {
        await roundsManager.mineBlocks(roundLength)
        await roundsManager.initializeRound()

        await bondingManager.connect(transcoder1).reward()

        await controller.pause()
        await roundsManager.mineBlocks(roundLength * 5)
        await controller.unpause()
        await roundsManager.initializeRound()

        const currentRound = await roundsManager.currentRound()

        const t1Pending = await bondingManager.pendingStake(
            transcoder1.address,
            currentRound
        )
        await bondingManager.connect(transcoder1).claimEarnings(currentRound)
        const endT1Info = await bondingManager.getDelegator(transcoder1.address)
        expect(t1Pending).to.equal(
            endT1Info.bondedAmount,
            "wrong bonded amount for transcoder 1"
        )

        const d1Pending = await bondingManager.pendingStake(
            delegator1.address,
            currentRound
        )
        await bondingManager.connect(delegator1).claimEarnings(currentRound)
        const endD1Info = await bondingManager.getDelegator(delegator1.address)
        expect(d1Pending).to.equal(
            endD1Info.bondedAmount,
            "wrong bonded amount for delegator 1"
        )

        const d2Pending = await bondingManager.pendingStake(
            delegator2.address,
            currentRound
        )
        await bondingManager.connect(delegator2).claimEarnings(currentRound)
        const endD2Info = await bondingManager.getDelegator(delegator2.address)
        expect(d2Pending).to.equal(
            endD2Info.bondedAmount,
            "wrong bonded amount for delegator 2"
        )
    })
})

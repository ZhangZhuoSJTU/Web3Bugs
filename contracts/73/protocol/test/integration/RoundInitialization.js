import {constants} from "../../utils/constants"

import chai, {expect} from "chai"
import {solidity} from "ethereum-waffle"
import {ethers} from "hardhat"

chai.use(solidity)

describe("RoundInitialization", () => {
    let signers
    let controller
    let bondingManager
    let roundsManager
    let token

    let bondAmount

    const mineAndInitializeRound = async roundsManager => {
        const roundLength = await roundsManager.roundLength()
        await roundsManager.mineBlocks(roundLength)
        await roundsManager.initializeRound()
    }

    const registerTranscodersAndInitializeRound = async (
        amount,
        transcoders,
        bondingManager,
        token,
        roundsManager
    ) => {
        for (const tr of transcoders) {
            await token.transfer(tr.address, amount)
            await token.connect(tr).approve(bondingManager.address, amount)
            await bondingManager.connect(tr).bond(amount, tr.address)
            await bondingManager.connect(tr).transcoder(0, 100)
        }

        await mineAndInitializeRound(roundsManager)
    }

    before(async () => {
        signers = await ethers.getSigners()

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

        bondAmount = ethers.BigNumber.from(10).mul(
            constants.TOKEN_UNIT.toString()
        )
        await mineAndInitializeRound(roundsManager)
    })

    it("initializes a round with numActiveTranscoders = 10", async () => {
        const newTranscoders = signers.slice(1, 11)
        await registerTranscodersAndInitializeRound(
            bondAmount,
            newTranscoders,
            bondingManager,
            token,
            roundsManager
        )

        expect(await bondingManager.currentRoundTotalActiveStake()).to.equal(
            bondAmount.mul(10),
            "wrong total active stake"
        )
    })

    it("initializes a round with numActiveTranscoders = 15", async () => {
        const newTranscoders = signers.slice(11, 16)
        await bondingManager.setNumActiveTranscoders(15)
        expect(await bondingManager.getTranscoderPoolMaxSize()).to.equal(
            15,
            "wrong max # of active transcoders"
        )
        await registerTranscodersAndInitializeRound(
            bondAmount,
            newTranscoders,
            bondingManager,
            token,
            roundsManager
        )

        expect(await bondingManager.currentRoundTotalActiveStake()).to.equal(
            bondAmount.mul(15),
            "wrong total active stake"
        )
    })

    it("initializes a round with numActiveTranscoders = 20", async () => {
        const newTranscoders = signers.slice(16, 21)

        await bondingManager.setNumActiveTranscoders(20)
        expect(await bondingManager.getTranscoderPoolMaxSize()).to.equal(
            20,
            "wrong max # of active transcoders"
        )

        await registerTranscodersAndInitializeRound(
            bondAmount,
            newTranscoders,
            bondingManager,
            token,
            roundsManager
        )

        expect(await bondingManager.currentRoundTotalActiveStake()).to.equal(
            bondAmount.mul(20),
            "wrong total active stake"
        )
    })

    it("initializes a round with numActiveTranscoders = 30", async () => {
        const newTranscoders = signers.slice(21, 31)

        await bondingManager.setNumActiveTranscoders(30)
        expect(await bondingManager.getTranscoderPoolMaxSize()).to.equal(
            30,
            "wrong max # of active transcoders"
        )
        await registerTranscodersAndInitializeRound(
            bondAmount,
            newTranscoders,
            bondingManager,
            token,
            roundsManager
        )

        await mineAndInitializeRound(roundsManager)

        expect(await bondingManager.currentRoundTotalActiveStake()).to.equal(
            bondAmount.mul(30),
            "wrong total active stake"
        )
    })

    it("initializes a round with numActiveTranscoders = 40", async () => {
        const newTranscoders = signers.slice(31, 41)
        await bondingManager.setNumActiveTranscoders(40)
        expect(await bondingManager.getTranscoderPoolMaxSize()).to.equal(
            40,
            "wrong max # of active transcoders"
        )

        await registerTranscodersAndInitializeRound(
            bondAmount,
            newTranscoders,
            bondingManager,
            token,
            roundsManager
        )

        expect(await bondingManager.currentRoundTotalActiveStake()).to.equal(
            bondAmount.mul(40),
            "wrong total active stake"
        )
    })
})

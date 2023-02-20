import {constants} from "../../utils/constants"
import {createWinningTicket, getTicketHash} from "../helpers/ticket"
import signMsg from "../helpers/signMsg"

import chai, {expect} from "chai"
import {solidity} from "ethereum-waffle"
import {ethers} from "hardhat"

chai.use(solidity)

describe("TicketFlow", () => {
    let transcoder
    let broadcaster

    let controller
    let broker
    let bondingManager
    let roundsManager
    let minter
    let token

    let roundLength

    before(async () => {
        const signers = await ethers.getSigners()
        transcoder = signers[0]
        broadcaster = signers[1]

        const fixture = await deployments.fixture(["Contracts"])

        broker = await ethers.getContractAt(
            "TicketBroker",
            fixture.TicketBroker.address
        )

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
        minter = await ethers.getContractAt("Minter", fixture.Minter.address)

        const amount = ethers.BigNumber.from(10).mul(
            constants.TOKEN_UNIT.toString()
        )
        await token.connect(signers[0]).transfer(transcoder.address, amount)

        // Register transcoder
        await token.connect(transcoder).approve(bondingManager.address, amount)
        await bondingManager
            .connect(transcoder)
            .bond(amount, transcoder.address)
        await bondingManager.connect(transcoder).transcoder(0, 0)

        roundLength = await roundsManager.roundLength()
        await roundsManager.mineBlocks(roundLength.mul(1000))
        await roundsManager.setBlockHash(
            ethers.utils.solidityKeccak256(["string"], ["foo"])
        )
        await roundsManager.initializeRound()
    })

    it("broadcaster funds deposit and penalty escrow", async () => {
        const deposit = ethers.utils.parseEther("1")
        await broker.connect(broadcaster).fundDeposit({value: deposit})
        expect(await ethers.provider.getBalance(minter.address)).to.equal(
            deposit
        )

        const reserve = ethers.utils.parseEther("1")
        await broker.connect(broadcaster).fundReserve({value: reserve})
        expect(await ethers.provider.getBalance(minter.address)).to.equal(
            deposit.add(reserve)
        )
    })

    it("broadcaster sends a winning ticket and transcoder redeems it", async () => {
        const block = await roundsManager.blockNum()
        const creationRound = await roundsManager.currentRound()
        const creationRoundBlockHash = await roundsManager.blockHash(block)
        const auxData = ethers.utils.solidityPack(
            ["uint256", "bytes32"],
            [creationRound, creationRoundBlockHash]
        )
        const deposit = (await broker.getSenderInfo(broadcaster.address)).sender
            .deposit
        const recipientRand = 5
        const faceValue = 1000
        const ticket = createWinningTicket(
            transcoder.address,
            broadcaster.address,
            recipientRand,
            faceValue,
            auxData
        )
        const senderSig = await signMsg(
            getTicketHash(ticket),
            broadcaster.address
        )

        await broker
            .connect(transcoder)
            .redeemWinningTicket(ticket, senderSig, recipientRand)

        const endDeposit = (await broker.getSenderInfo(broadcaster.address))
            .sender.deposit

        expect(endDeposit).to.equal(deposit.sub(faceValue))

        const round = await roundsManager.currentRound()

        // there are no delegators so pendingFees(transcoder, currentRound) will include all fees
        expect(
            await bondingManager.pendingFees(transcoder.address, round)
        ).to.equal(faceValue)
    })

    it("broadcaster double spends by over spending with its deposit", async () => {
        await roundsManager.mineBlocks(roundLength)
        await roundsManager.initializeRound()

        const startSenderInfo = await broker.getSenderInfo(broadcaster.address)
        const startReserve = startSenderInfo.reserve.fundsRemaining
        const block = await roundsManager.blockNum()
        const creationRound = await roundsManager.currentRound()
        const creationRoundBlockHash = await roundsManager.blockHash(block)
        const auxData = ethers.utils.solidityPack(
            ["uint256", "bytes32"],
            [creationRound, creationRoundBlockHash]
        )
        const recipientRand = 6
        const faceValue = startSenderInfo.sender.deposit.add(100)

        // claim earnings to reset fee count for the next test
        const round = await roundsManager.currentRound()
        await bondingManager.connect(transcoder).claimEarnings(round)
        const ticket = createWinningTicket(
            transcoder.address,
            broadcaster.address,
            recipientRand,
            faceValue,
            auxData
        )
        const senderSig = await signMsg(
            getTicketHash(ticket),
            broadcaster.address
        )

        await broker
            .connect(transcoder)
            .redeemWinningTicket(ticket, senderSig, recipientRand)

        const endSenderInfo = await broker.getSenderInfo(broadcaster.address)
        const endReserve = endSenderInfo.reserve.fundsRemaining
        const reserveDiff = startReserve.sub(endReserve)

        expect(endSenderInfo.sender.deposit).to.equal(ethers.BigNumber.from(0))
        expect(reserveDiff).to.equal(ethers.BigNumber.from(100))

        // substract the faceValue from the previous test
        expect(
            (await bondingManager.pendingFees(transcoder.address, round)).sub(
                1000
            )
        ).to.equal(ticket.faceValue)
    })
})

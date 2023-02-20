import {constants} from "../../utils/constants"
import {createWinningTicket, getTicketHash} from "../helpers/ticket"
import signMsg from "../helpers/signMsg"

import chai, {assert, expect} from "chai"
import {solidity} from "ethereum-waffle"
import {deployments, ethers} from "hardhat"

chai.use(solidity)

describe("TicketFrontRun", () => {
    let deployer
    let broadcaster
    let evilSybilAccount
    let evilNonActiveTranscoder
    let evilActiveTranscoder
    let honestTranscoder
    let otherAccounts

    let controller
    let broker
    let bondingManager
    let roundsManager
    let token

    let deposit
    let reserve
    let reserveAlloc

    const newWinningTicket = async (
        recipient,
        sender,
        faceValue,
        recipientRand
    ) => {
        const block = await roundsManager.blockNum()
        const creationRound = (await roundsManager.currentRound()).toString()
        const creationRoundBlockHash = await roundsManager.blockHash(block)
        const auxData = ethers.utils.solidityPack(
            ["uint256", "bytes32"],
            [creationRound, creationRoundBlockHash]
        )

        return createWinningTicket(
            recipient,
            sender,
            recipientRand,
            faceValue,
            auxData
        )
    }

    beforeEach(async () => {
        const signers = await ethers.getSigners()

        ;[
            deployer,
            broadcaster,
            evilSybilAccount,
            evilNonActiveTranscoder,
            evilActiveTranscoder,
            ...otherAccounts
        ] = signers

        honestTranscoder = otherAccounts[0]

        const fixture = await deployments.fixture(["Contracts"])

        controller = await ethers.getContractAt(
            "Controller",
            fixture.Controller.address
        )
        await controller.unpause()

        broker = await ethers.getContractAt(
            "TicketBroker",
            fixture.TicketBroker.address
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

        const registerTranscoder = async transcoder => {
            const amount = ethers.BigNumber.from(10).mul(
                constants.TOKEN_UNIT.toString()
            )
            await token.connect(deployer).transfer(transcoder.address, amount)
            await token
                .connect(transcoder)
                .approve(bondingManager.address, amount)
            await bondingManager
                .connect(transcoder)
                .bond(amount, transcoder.address)
            await bondingManager.connect(transcoder).transcoder(0, 0)
        }

        const maxActive = (
            await bondingManager.getTranscoderPoolMaxSize()
        ).toNumber()

        // Register transcoders
        // For this test, we want 1 evil active transcoder and 1 evil non-active transcoder
        // First we'll fill up the active set and leave one slot for the evil active transcoder
        const otherTranscoders = otherAccounts.slice(0, maxActive - 1)
        for (const tr of otherTranscoders) {
            await registerTranscoder(tr)
        }

        // evilActiveTranscoder will represent an active transcoder owned by the malicious broadcaster
        await registerTranscoder(evilActiveTranscoder)

        // evilNonActiveTranscoder will represent a non-active transcoder owned by the malicious broadcaster
        // The active set will be full at this point so evilNonActiveTranscoder will not join the active set
        await registerTranscoder(evilNonActiveTranscoder)

        // Fund the broadcaster
        deposit = 1000000
        reserve = 100000
        reserveAlloc =
            reserve / (await bondingManager.getTranscoderPoolSize()).toNumber()

        await broker
            .connect(broadcaster)
            .fundDepositAndReserve(deposit, reserve, {
                value: deposit + reserve
            })

        const roundLength = await roundsManager.roundLength()
        await roundsManager.mineBlocks(roundLength.mul(1000))
        await roundsManager.setBlockHash(
            ethers.utils.solidityKeccak256(["string"], ["foo"])
        )
        await roundsManager.initializeRound()
    })

    it("broadcaster tries to send a winning ticket to its own Sybil account", async () => {
        // Use the same recipientRand for both tickets for ease of testing
        const recipientRand = 5

        // honestTranscoder receives a winning ticket
        // Since honestTranscoder sets the required faceValue, it sets the faceValue to
        // reserveAlloc which is its max allocation from the broadcaster's reserve
        const firstTicket = await newWinningTicket(
            honestTranscoder.address,
            broadcaster.address,
            reserveAlloc,
            recipientRand
        )
        const firstTicketSig = await signMsg(
            getTicketHash(firstTicket),
            broadcaster.address
        )

        // The malicious broadcaster sends a winning ticket to its own Sybil account and
        // front runs honestTranscoder's transaction to empty the broadcaster's deposit/reserve so that
        // there are insufficient funds to pay honestTranscoder
        // The face value for this ticket is the broadcaster's deposit AND reserve
        const secondTicket = await newWinningTicket(
            evilSybilAccount.address,
            broadcaster.address,
            deposit + reserve,
            recipientRand
        )
        const secondTicketSig = await signMsg(
            getTicketHash(secondTicket),
            broadcaster.address
        )

        // Ticket redemption by evilSybilAccount fails because it is not a registered transcoder
        await expect(
            broker
                .connect(evilSybilAccount)
                .redeemWinningTicket(
                    secondTicket,
                    secondTicketSig,
                    recipientRand
                )
        ).to.be.revertedWith("transcoder must be registered")

        // Ticket redemption by honestTranscoder confirms on-chain
        await broker
            .connect(honestTranscoder)
            .redeemWinningTicket(firstTicket, firstTicketSig, recipientRand)

        const currentRound = await roundsManager.currentRound()
        const info = await broker.getSenderInfo(broadcaster.address)

        // honestTranscoder's ticket should be fully covered by the the broadcaster's deposit
        expect(info.sender.deposit).to.equal(deposit - reserveAlloc)
        expect(info.reserve.fundsRemaining).to.equal(reserve)
        const pendingFees = await bondingManager.pendingFees(
            honestTranscoder.address,
            currentRound
        )
        expect(pendingFees).to.equal(reserveAlloc)
    })

    it("broadcaster tries to send a winning ticket to its own non-active transcoder, results in division by zero", async () => {
        // Use the same recipientRand for both tickets for ease of testing
        const recipientRand = 5
        const currentRound = await roundsManager.currentRound()

        // honestTranscoder receives a winning ticket
        // Since honestTranscoder sets the required faceValue, it sets the faceValue to
        // reserveAlloc which is its max allocation from the broadcaster's reserve
        const firstTicket = await newWinningTicket(
            honestTranscoder.address,
            broadcaster.address,
            reserveAlloc,
            recipientRand
        )
        const firstTicketSig = await signMsg(
            getTicketHash(firstTicket),
            broadcaster.address
        )

        // The malicious broadcaster sends a winning ticket to its own non-active transcoder and
        // front runs honestTranscoder's transaction to empty the broadcaster's deposit/reserve so that
        // there are insufficeint funds to pay honestTranscoder
        // The face value for this ticket is the broadcaster's deposit AND reserve
        const secondTicket = await newWinningTicket(
            evilNonActiveTranscoder.address,
            broadcaster.address,
            deposit + reserve,
            recipientRand
        )
        const secondTicketSig = await signMsg(
            getTicketHash(secondTicket),
            broadcaster.address
        )

        // Ticket redemption by evilNonActiveTranscoder fails because a non-active transcoder has no totalStake on it's earningsPool
        // This results in division by zero when calculating earnings cumulatively (LIP-36)
        await expect(
            broker
                .connect(evilNonActiveTranscoder)
                .redeemWinningTicket(
                    secondTicket,
                    secondTicketSig,
                    recipientRand
                )
        ).to.be.revertedWith("SafeMath: division by zero")

        let info = await broker.getSenderInfo(broadcaster.address)

        // evilNonActiveTranscoder's ticket should not be able to empty the broadcaster's deposit
        assert.equal(info.sender.deposit.toString(), deposit.toString())
        assert.equal(info.reserve.fundsRemaining.toString(), reserve.toString())

        const honestTPendingFeesBefore = await bondingManager.pendingFees(
            honestTranscoder.address,
            currentRound
        )
        // Ticket redemption by honestTranscoder confirms on-chain
        await broker
            .connect(honestTranscoder)
            .redeemWinningTicket(firstTicket, firstTicketSig, recipientRand)

        info = await broker.getSenderInfo(broadcaster.address)

        const honestTPendingFeesAfter = await bondingManager.pendingFees(
            honestTranscoder.address,
            currentRound
        )
        assert.equal(
            honestTPendingFeesAfter.sub(honestTPendingFeesBefore).toString(),
            reserveAlloc.toString()
        )
    })

    it("broadcaster tries to send a winning ticket to its own active transcoder", async () => {
        // Use the same recipientRand for both tickets for ease of testing
        const recipientRand = 5
        const currentRound = await roundsManager.currentRound()

        // honestTranscoder receives a winning ticket
        // Since honestTranscoder sets the required faceValue, it sets the faceValue to
        // reserveAlloc which is its max allocation from the broadcaster's reserve
        const firstTicket = await newWinningTicket(
            honestTranscoder.address,
            broadcaster.address,
            reserveAlloc,
            recipientRand
        )
        const firstTicketSig = await signMsg(
            getTicketHash(firstTicket),
            broadcaster.address
        )

        // The malicious broadcaster sends a winning ticket to its own active transcoder and
        // front runs honestTranscoder's transaction to empty the broadcaster's deposit/reserve so that
        // there are insufficient funds to pay honestTranscoder
        // The face value for this ticket is the broadcaster's deposit AND reserve
        const secondTicket = await newWinningTicket(
            evilActiveTranscoder.address,
            broadcaster.address,
            deposit + reserve,
            recipientRand
        )
        const secondTicketSig = await signMsg(
            getTicketHash(secondTicket),
            broadcaster.address
        )

        // Ticket redemption by evilActiveTranscoder confirms on-chain
        await broker
            .connect(evilActiveTranscoder)
            .redeemWinningTicket(secondTicket, secondTicketSig, recipientRand)

        let info = await broker.getSenderInfo(broadcaster.address)

        // evilNonActiveTranscoder's ticket should empty the broadcaster's deposit, but only decrease the reserve by reserveAlloc since
        // evilNonActiveTranscoder cannot claim more than that
        assert.equal(info.sender.deposit.toString(), "0")
        assert.equal(
            info.reserve.fundsRemaining.toString(),
            (reserve - reserveAlloc).toString()
        )

        assert.equal(
            (
                await bondingManager.pendingFees(
                    evilActiveTranscoder.address,
                    currentRound
                )
            ).toString(),
            (deposit + reserveAlloc).toString()
        )

        // Ticket redemption by honestTranscoder confirms on-chain
        await broker
            .connect(honestTranscoder)
            .redeemWinningTicket(firstTicket, firstTicketSig, recipientRand)

        info = await broker.getSenderInfo(broadcaster.address)

        // honestTranscoder's ticket should still still receive the full reserveAlloc amount from the broadcaster's reserve
        assert.equal(
            info.reserve.fundsRemaining.toString(),
            (reserve - 2 * reserveAlloc).toString()
        )

        assert.equal(
            (
                await bondingManager.pendingFees(
                    honestTranscoder.address,
                    currentRound
                )
            ).toString(),
            reserveAlloc.toString()
        )
    })
})

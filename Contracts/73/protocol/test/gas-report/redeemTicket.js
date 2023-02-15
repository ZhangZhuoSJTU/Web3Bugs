import RPC from "../../utils/rpc"
import {
    DUMMY_TICKET_CREATION_ROUND_BLOCK_HASH,
    createAuxData,
    createWinningTicket,
    getTicketHash
} from "../helpers/ticket"
import signMsg from "../helpers/signMsg"

import {deployments, ethers} from "hardhat"

import chai from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("redeem ticket gas report", () => {
    let rpc
    let snapshotId

    let controller
    let bondingManager
    let roundsManager
    let token
    let broker

    let transcoder
    let broadcaster

    let ticketAuxData

    const deposit = 1000

    let signers

    before(async () => {
        rpc = new RPC(web3)
        signers = await ethers.getSigners()
        transcoder = signers[0]
        broadcaster = signers[1]

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

        broker = await ethers.getContractAt(
            "TicketBroker",
            fixture.TicketBroker.address
        )

        roundLength = await roundsManager.roundLength()

        await controller.unpause()

        // Register transcoder
        const stake = 100
        await token.transfer(transcoder.address, stake)
        await token.approve(bondingManager.address, stake)
        await bondingManager.bond(stake, transcoder.address)

        // Deposit funds for broadcaster
        await broker
            .connect(broadcaster)
            .fundDepositAndReserve(deposit, 1000, {value: deposit + 1000})

        // Fast forward to start of new round to lock in active set
        const roundLength = await roundsManager.roundLength()
        await roundsManager.mineBlocks(roundLength.toNumber())
        // Set mock block hash
        await roundsManager.setBlockHash(DUMMY_TICKET_CREATION_ROUND_BLOCK_HASH)
        await roundsManager.initializeRound()

        // Construct ticketAuxData (creation round + creation round block hash)
        const currentRound = await roundsManager.currentRound()
        ticketAuxData = createAuxData(
            currentRound.toNumber(),
            DUMMY_TICKET_CREATION_ROUND_BLOCK_HASH
        )
    })

    beforeEach(async () => {
        snapshotId = await rpc.snapshot()
    })

    afterEach(async () => {
        await rpc.revert(snapshotId)
    })

    it("redeem ticket and only draw from deposit", async () => {
        const recipientRand = 5
        // Set faceValue equal to broadcaster's deposit
        const faceValue = deposit
        const ticket = createWinningTicket(
            transcoder.address,
            broadcaster.address,
            recipientRand,
            faceValue,
            ticketAuxData
        )
        const senderSig = await signMsg(
            getTicketHash(ticket),
            broadcaster.address
        )

        // Ticket faceValue is equal to broadcaster's deposit so will only draw from deposit
        await broker.redeemWinningTicket(ticket, senderSig, recipientRand)
    })

    it("redeem ticket and draw from deposit and reserve", async () => {
        const recipientRand = 5
        // Set faceValue greater than broadcaster's current deposit
        const faceValue = deposit + 500
        const ticket = createWinningTicket(
            transcoder.address,
            broadcaster.address,
            recipientRand,
            faceValue,
            ticketAuxData
        )
        const senderSig = await signMsg(
            getTicketHash(ticket),
            broadcaster.address
        )

        // Ticket faceValue is greater than broadcaster's deposit so will draw from both deposit and reserve
        await broker.redeemWinningTicket(ticket, senderSig, recipientRand)
    })
})

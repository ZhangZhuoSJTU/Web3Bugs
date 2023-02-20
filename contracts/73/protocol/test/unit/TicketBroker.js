import calcTxCost from "../helpers/calcTxCost"
import {
    DUMMY_TICKET_CREATION_ROUND,
    DUMMY_TICKET_CREATION_ROUND_BLOCK_HASH,
    createAuxData,
    createTicket,
    createWinningTicket,
    getTicketHash
} from "../helpers/ticket"
import signMsg from "../helpers/signMsg"
import Fixture from "./helpers/Fixture"
import {functionSig} from "../../utils/helpers"
import {constants} from "../../utils/constants"

import {web3, ethers} from "hardhat"
const BigNumber = ethers.BigNumber

import chai, {expect, assert} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("TicketBroker", () => {
    let broker
    let fixture

    let signers
    let sender
    let recipient

    const unlockPeriod = 20
    const ticketValidityPeriod = 2

    const currentRound = DUMMY_TICKET_CREATION_ROUND

    before(async () => {
        signers = await ethers.getSigners()
        sender = signers[0].address
        recipient = signers[1].address
        fixture = new Fixture(web3)
        await fixture.deploy()

        broker = await (
            await ethers.getContractFactory("TicketBroker")
        ).deploy(fixture.controller.address)
        await broker.setUnlockPeriod(unlockPeriod)
        await broker.setTicketValidityPeriod(ticketValidityPeriod)

        await fixture.roundsManager.setMockUint256(
            functionSig("currentRound()"),
            currentRound
        )
        await fixture.roundsManager.setMockBytes32(
            functionSig("blockHashForRound(uint256)"),
            DUMMY_TICKET_CREATION_ROUND_BLOCK_HASH
        )
    })

    beforeEach(async () => {
        await fixture.setUp()
        await fixture.roundsManager.setMockBool(
            functionSig("currentRoundInitialized()"),
            true
        )
    })

    afterEach(async () => {
        await fixture.tearDown()
    })

    describe("setUnlockPeriod", () => {
        it("should fail if caller is not Controller owner", async () => {
            await expect(
                broker.connect(signers[1]).setUnlockPeriod(200)
            ).to.be.revertedWith("caller must be Controller owner")
        })

        it("sets unlockPeriod", async () => {
            await broker.setUnlockPeriod(200)

            assert.equal("200", (await broker.unlockPeriod()).toString())
        })
    })

    describe("setTicketValidityPeriod", () => {
        it("should fail if caller is not Controller owner", async () => {
            await expect(
                broker.connect(signers[1]).setTicketValidityPeriod(200)
            ).to.be.revertedWith("caller must be Controller owner")
        })

        it("should fail if provided value is 0", async () => {
            await expect(broker.setTicketValidityPeriod(0)).to.be.revertedWith(
                "ticketValidityPeriod must be greater than 0"
            )
        })

        it("sets ticketValidityPeriod", async () => {
            await broker.setTicketValidityPeriod(200)

            assert.equal(
                "200",
                (await broker.ticketValidityPeriod()).toString()
            )
        })
    })

    describe("fundDeposit", () => {
        it("should fail if the system is paused", async () => {
            await fixture.controller.pause()
            await expect(
                broker.fundDeposit({value: 1000})
            ).to.be.revertedWith("system is paused")
        })

        it("grows the Minter ETH balance", async () => {
            await broker.fundDeposit({value: 1000})

            const balance = await web3.eth.getBalance(fixture.minter.address)

            assert.equal(balance, "1000")
        })

        it("reduces the sender's ETH balance", async () => {
            const startBalance = BigNumber.from(
                await web3.eth.getBalance(sender)
            )

            const txResult = await broker.fundDeposit({value: 1000})

            const endBalance = BigNumber.from(await web3.eth.getBalance(sender))
            const txCost = await calcTxCost(txResult)
            assert.equal(
                startBalance.sub(endBalance).sub(txCost).toString(),
                "1000"
            )
        })

        it("tracks the sender's ETH deposit amount", async () => {
            await broker.fundDeposit({value: 1000})

            const deposit = (
                await broker.getSenderInfo(sender)
            ).sender.deposit.toString()

            assert.equal(deposit, "1000")
        })

        it("tracks sender's multiple deposits", async () => {
            await broker.fundDeposit({value: 1000})
            await broker.fundDeposit({value: 500})

            const deposit = (
                await broker.getSenderInfo(sender)
            ).sender.deposit.toString()

            assert.equal(deposit, "1500")
        })

        it("track multiple sender's deposits", async () => {
            const sender2 = signers[2]
            await broker.fundDeposit({value: 1000})
            await broker.connect(sender2).fundDeposit({value: 500})

            const deposit = (
                await broker.getSenderInfo(sender)
            ).sender.deposit.toString()
            const deposit2 = (
                await broker.getSenderInfo(sender2.address)
            ).sender.deposit.toString()

            assert.equal(deposit, "1000")
            assert.equal(deposit2, "500")
        })

        it("resets an unlock request in progress", async () => {
            await broker.fundDeposit({value: 1000})
            await broker.unlock()

            await broker.fundDeposit({value: 500})

            const isUnlockInProgress = await broker.isUnlockInProgress(sender)
            assert(!isUnlockInProgress)
        })

        it("emits a DepositFunded event", async () => {
            const tx = broker.fundDeposit({value: 1000})
            await expect(tx)
                .to.emit(broker, "DepositFunded")
                .withArgs(sender, "1000")
        })

        it("emits a DepositFunded event with indexed sender", async () => {
            const sender2 = signers[2]
            const fromBlock = (await web3.eth.getBlock("latest")).number
            await broker.fundDeposit({value: 1000})
            await broker.connect(sender2).fundDeposit({value: 1000})

            const filter = broker.filters.DepositFunded(sender)
            const events = await broker.queryFilter(filter, fromBlock, "latest")

            assert.equal(events.length, 1)
            assert.equal(events[0].args.sender, sender)
            assert.equal(events[0].args.amount.toString(), "1000")
        })
    })

    describe("fundReserve", () => {
        it("should fail if the system is paused", async () => {
            await fixture.controller.pause()
            await expect(
                broker.fundReserve({value: 1000})
            ).to.be.revertedWith("system is paused")
        })

        it("grows the Minter ETH balance", async () => {
            await broker.fundReserve({value: 1000})

            const balance = await web3.eth.getBalance(fixture.minter.address)

            assert.equal(balance, "1000")
        })

        it("reduces the sender's ETH balance", async () => {
            const startBalance = BigNumber.from(
                await web3.eth.getBalance(sender)
            )

            const txRes = await broker.fundReserve({value: 1000})

            const endBalance = BigNumber.from(await web3.eth.getBalance(sender))
            const txCost = await calcTxCost(txRes)

            assert.equal(
                startBalance.sub(endBalance).sub(txCost).toString(),
                "1000"
            )
        })

        it("tracks the sender's ETH reserve", async () => {
            await broker.fundReserve({value: 1000})

            const reserve = (
                await broker.getSenderInfo(sender)
            ).reserve.fundsRemaining.toString()

            assert.equal(reserve, "1000")
        })

        it("tracks sender's multiple reserve fundings", async () => {
            await broker.fundReserve({value: 1000})
            await broker.fundReserve({value: 500})

            const reserve = (
                await broker.getSenderInfo(sender)
            ).reserve.fundsRemaining.toString()

            assert.equal(reserve, "1500")
        })

        it("track multiple sender's reserves", async () => {
            const sender2 = signers[2]
            await broker.fundReserve({value: 1000})
            await broker.connect(sender2).fundReserve({value: 500})

            const reserve = (
                await broker.getSenderInfo(sender)
            ).reserve.fundsRemaining.toString()
            const reserve2 = (
                await broker.getSenderInfo(sender2.address)
            ).reserve.fundsRemaining.toString()

            assert.equal(reserve, "1000")
            assert.equal(reserve2, "500")
        })

        it("preserves remaining funds when reserve was claimed from", async () => {
            const numRecipients = 10
            const reserve = 1000
            const allocation = reserve / numRecipients
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await fixture.bondingManager.setMockUint256(
                functionSig("getTranscoderPoolSize()"),
                numRecipients
            )
            await fixture.bondingManager.setMockBool(
                functionSig("isActiveTranscoder(address)"),
                true
            )
            await broker.fundReserve({value: reserve})

            const recipientRand = 5
            const faceValue = 1000
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)

            // Deposit is 0 so this will claim from the reserve
            await broker
                .connect(signers[1])
                .redeemWinningTicket(ticket, senderSig, recipientRand)

            // No additional funds so this should not increase the reserve
            await broker.fundReserve()

            const remainingReserve = reserve - allocation
            assert.equal(
                (
                    await broker.getSenderInfo(sender)
                ).reserve.fundsRemaining.toString(),
                remainingReserve.toString()
            )
        })

        it("preserves remaining funds when reserve was claimed from and adds additional funds", async () => {
            const numRecipients = 10
            const reserve = 1000
            const allocation = reserve / numRecipients
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await fixture.bondingManager.setMockUint256(
                functionSig("getTranscoderPoolSize()"),
                numRecipients
            )
            await fixture.bondingManager.setMockBool(
                functionSig("isActiveTranscoder(address)"),
                true
            )
            await broker.fundReserve({value: reserve})

            const recipientRand = 5
            const faceValue = 1000
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)

            // Deposit is 0 so this will claim from the reserve
            await broker
                .connect(signers[1])
                .redeemWinningTicket(ticket, senderSig, recipientRand)

            const additionalFunds = 100
            await broker.fundReserve({value: additionalFunds})

            const remainingReserve = reserve - allocation
            assert.equal(
                (
                    await broker.getSenderInfo(sender)
                ).reserve.fundsRemaining.toString(),
                (remainingReserve + additionalFunds).toString()
            )
        })

        it("resets an unlock request in progress", async () => {
            await broker.fundReserve({value: 1000})
            await broker.unlock()

            await broker.fundReserve({value: 500})

            const isUnlockInProgress = await broker.isUnlockInProgress(sender)
            assert(!isUnlockInProgress)
        })

        it("emits a ReserveFunded event", async () => {
            const tx = broker.fundReserve({value: 1000})

            await expect(tx)
                .to.emit(broker, "ReserveFunded")
                .withArgs(sender, "1000")
        })

        it("emits a ReserveFunded event with indexed sender", async () => {
            const sender2 = signers[2]
            const fromBlock = (await web3.eth.getBlock("latest")).number
            await broker.fundReserve({value: 1000})
            await broker.connect(sender2).fundReserve({value: 1000})

            const filter = broker.filters.ReserveFunded(sender)
            const events = await broker.queryFilter(filter, fromBlock, "latest")

            assert.equal(events.length, 1)
            assert.equal(events[0].args.reserveHolder, sender)
            assert.equal(events[0].args.amount.toString(), "1000")
        })
    })

    describe("fundDepositAndReserve", () => {
        it("should fail if the system is paused", async () => {
            const deposit = 500
            const reserve = 1000
            await fixture.controller.pause()
            await expect(
                broker.fundDepositAndReserve(deposit, reserve, {value: 1000})
            ).to.be.revertedWith("system is paused")
        })

        it("reverts if msg.value < sum of deposit amount and reserve amount", async () => {
            const deposit = 500
            const reserve = 1000

            await expect(
                broker.fundDepositAndReserve(deposit, reserve, {
                    value: deposit + reserve - 1
                })
            ).to.be.revertedWith(
                "msg.value does not equal sum of deposit amount and reserve amount"
            )
        })

        it("reverts if msg.value > sum of deposit amount and reserve amount", async () => {
            const deposit = 500
            const reserve = 1000

            await expect(
                broker.fundDepositAndReserve(deposit, reserve, {
                    value: deposit + reserve + 1
                })
            ).to.be.revertedWith(
                "msg.value does not equal sum of deposit amount and reserve amount"
            )
        })

        it("grows the Minter's ETH balance by sum of deposit and reserve amounts", async () => {
            const deposit = 500
            const reserve = 1000
            const startMinterBalance = BigNumber.from(
                await web3.eth.getBalance(fixture.minter.address)
            )

            await broker.fundDepositAndReserve(deposit, reserve, {
                value: deposit + reserve
            })

            const endMinterBalance = BigNumber.from(
                await web3.eth.getBalance(fixture.minter.address)
            )

            assert.equal(
                endMinterBalance.sub(startMinterBalance).toString(),
                (deposit + reserve).toString()
            )
        })

        it("reduces the sender's ETH balance by sum of deposit and reserve amounts", async () => {
            const deposit = 500
            const reserve = 1000
            const startSenderBalance = BigNumber.from(
                await web3.eth.getBalance(sender)
            )

            const txResult = await broker.fundDepositAndReserve(
                deposit,
                reserve,
                {value: deposit + reserve}
            )

            const endSenderBalance = BigNumber.from(
                await web3.eth.getBalance(sender)
            )
            const txCost = await calcTxCost(txResult)

            assert.equal(
                startSenderBalance.sub(endSenderBalance).sub(txCost).toString(),
                (deposit + reserve).toString()
            )
        })

        it("tracks sender's ETH deposit and reserve", async () => {
            const deposit = 500
            const reserve = 1000

            await broker.fundDepositAndReserve(deposit, reserve, {
                value: deposit + reserve
            })

            const endSenderInfo = await broker.getSenderInfo(sender)
            const endReserve = endSenderInfo.reserve.fundsRemaining

            assert.equal(
                endSenderInfo.sender.deposit.toString(),
                deposit.toString()
            )
            assert.equal(endReserve.toString(), reserve.toString())
        })

        it("preserves remaining funds when reserve was claimed from", async () => {
            const numRecipients = 10
            const reserve = 1000
            const allocation = reserve / numRecipients
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await fixture.bondingManager.setMockUint256(
                functionSig("getTranscoderPoolSize()"),
                numRecipients
            )
            await fixture.bondingManager.setMockBool(
                functionSig("isActiveTranscoder(address)"),
                true
            )
            await broker.fundReserve({value: reserve})

            const recipientRand = 5
            const faceValue = 1000
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)

            // Deposit is 0 so this will claim from the reserve
            await broker
                .connect(signers[1])
                .redeemWinningTicket(ticket, senderSig, recipientRand)

            // No additional reserve funds so this should not increase reserve
            await broker.fundDepositAndReserve(100, 0, {value: 100})

            const remainingReserve = reserve - allocation
            assert.equal(
                (
                    await broker.getSenderInfo(sender)
                ).reserve.fundsRemaining.toString(),
                remainingReserve.toString()
            )
        })

        it("preserves remaining funds when reserve was claimed from and adds additional funds", async () => {
            const numRecipients = 10
            const reserve = 1000
            const allocation = reserve / numRecipients
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await fixture.bondingManager.setMockUint256(
                functionSig("getTranscoderPoolSize()"),
                numRecipients
            )
            await fixture.bondingManager.setMockBool(
                functionSig("isActiveTranscoder(address)"),
                true
            )
            await broker.fundReserve({value: reserve})

            const recipientRand = 5
            const faceValue = 1000
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)

            // Deposit is 0 so this will claim from the reserve
            await broker
                .connect(signers[1])
                .redeemWinningTicket(ticket, senderSig, recipientRand)

            const additionalFunds = 100
            await broker.fundDepositAndReserve(100, additionalFunds, {
                value: 100 + additionalFunds
            })

            const remainingReserve = reserve - allocation
            assert.equal(
                (
                    await broker.getSenderInfo(sender)
                ).reserve.fundsRemaining.toString(),
                (remainingReserve + additionalFunds).toString()
            )
        })
    })

    describe("redeemWinningTicket", () => {
        it("should fail if the system is paused", async () => {
            const deposit = 1500
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await broker.fundDeposit({value: deposit})

            const recipientRand = 5
            const faceValue = deposit
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)

            await fixture.controller.pause()

            await expect(
                broker
                    .connect(signers[1])
                    .redeemWinningTicket(ticket, senderSig, recipientRand)
            ).to.be.revertedWith("system is paused")
        })

        it("should fail if the current round is not initialized", async () => {
            const deposit = 1500
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await broker.fundDeposit({value: deposit})

            const recipientRand = 5
            const faceValue = deposit
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)

            await fixture.roundsManager.setMockBool(
                functionSig("currentRoundInitialized()"),
                false
            )

            await expect(
                broker
                    .connect(signers[1])
                    .redeemWinningTicket(ticket, senderSig, recipientRand)
            ).to.be.revertedWith("current round is not initialized")
        })

        it("reverts if ticket's recipient is null address", async () => {
            await expect(
                broker.redeemWinningTicket(
                    createTicket(),
                    web3.utils.asciiToHex("sig"),
                    5
                )
            ).to.be.revertedWith("ticket recipient is null address")
        })

        it("reverts if ticket sender is null address", async () => {
            await expect(
                broker.redeemWinningTicket(
                    createTicket({recipient}),
                    web3.utils.asciiToHex("sig"),
                    5
                )
            ).to.be.revertedWith("ticket sender is null address")
        })

        it("reverts if ticket auxData != 64 bytes", async () => {
            const auxData = ethers.constants.HashZero

            await expect(
                broker.redeemWinningTicket(
                    createTicket({
                        recipient,
                        sender,
                        auxData
                    }),
                    web3.utils.asciiToHex("sig"),
                    5
                )
            ).to.be.revertedWith(
                "invalid length for ticket auxData: must be 64 bytes"
            )
        })

        it("reverts if block hash for ticket creationRound is null", async () => {
            await fixture.roundsManager.setMockBytes32(
                functionSig("blockHashForRound(uint256)"),
                constants.NULL_BYTES
            )

            await expect(
                broker.redeemWinningTicket(
                    createTicket({
                        recipient,
                        sender
                    }),
                    web3.utils.asciiToHex("sig"),
                    5
                )
            ).to.be.revertedWith(
                "ticket creationRound does not have a block hash"
            )
        })

        it("reverts if ticket creationRoundBlockHash is invalid for ticket creationRound", async () => {
            await fixture.roundsManager.setMockBytes32(
                functionSig("blockHashForRound(uint256)"),
                web3.utils.keccak256("bar")
            )

            await expect(
                broker.redeemWinningTicket(
                    createTicket({
                        recipient,
                        sender
                    }),
                    web3.utils.asciiToHex("sig"),
                    5
                )
            ).to.be.revertedWith(
                "ticket creationRoundBlockHash invalid for creationRound"
            )
        })

        it("reverts if ticket is expired based on ticket creationRound", async () => {
            const expirationRound = currentRound + ticketValidityPeriod
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                expirationRound
            )

            await expect(
                broker.redeemWinningTicket(
                    createTicket({
                        recipient,
                        sender
                    }),
                    web3.utils.asciiToHex("sig"),
                    5
                )
            ).to.be.revertedWith("ticket is expired")
        })

        it("reverts if recipientRand is not the preimage for the ticket's recipientRandHash", async () => {
            await expect(
                broker.redeemWinningTicket(
                    createTicket({
                        recipient,
                        sender
                    }),
                    web3.utils.asciiToHex("sig"),
                    5
                )
            ).to.be.revertedWith(
                "recipientRand does not match recipientRandHash"
            )
        })

        it("reverts if sender is unlocked", async () => {
            // Unlock the sender
            await broker.fundDeposit({value: 100})
            await broker.unlock()
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound + unlockPeriod
            )

            const recipientRand = 5
            const auxData = createAuxData(
                currentRound + unlockPeriod,
                DUMMY_TICKET_CREATION_ROUND_BLOCK_HASH
            )
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                0,
                auxData
            )
            const ticketHash = getTicketHash(ticket)
            const senderSig = await signMsg(ticketHash, sender)

            await expect(
                broker.redeemWinningTicket(ticket, senderSig, recipientRand)
            ).to.be.revertedWith("sender is unlocked")
        })

        it("reverts if ticket is used", async () => {
            await broker.fundDeposit({value: 1000})

            const recipientRand = 5
            const ticket = createWinningTicket(recipient, sender, recipientRand)
            const ticketHash = getTicketHash(ticket)
            const senderSig = await signMsg(ticketHash, sender)

            await broker.redeemWinningTicket(ticket, senderSig, recipientRand)

            assert.isOk(await broker.usedTickets(ticketHash))

            await expect(
                broker.redeemWinningTicket(ticket, senderSig, recipientRand)
            ).to.be.revertedWith("ticket is used")
        })

        it("reverts if sender signature over ticket hash is invalid", async () => {
            const recipientRand = 5
            const recipientRandHash = web3.utils.soliditySha3(recipientRand)

            await expect(
                broker.redeemWinningTicket(
                    createTicket({
                        recipient,
                        sender,
                        recipientRandHash
                    }),
                    web3.utils.asciiToHex("sig"),
                    recipientRand
                )
            ).to.be.revertedWith("invalid signature over ticket hash")
        })

        it("reverts if the ticket did not win", async () => {
            const recipientRand = 5
            const recipientRandHash = web3.utils.soliditySha3(recipientRand)
            const ticket = createTicket({
                recipient,
                sender,
                recipientRandHash
            })
            const senderSig = await signMsg(getTicketHash(ticket), sender)

            await expect(
                broker.redeemWinningTicket(ticket, senderSig, recipientRand)
            ).to.be.revertedWith("ticket did not win")
        })

        it("reverts if sender's deposit and reserve are zero", async () => {
            const recipientRand = 5
            const ticket = createWinningTicket(recipient, sender, recipientRand)
            const senderSig = await signMsg(getTicketHash(ticket), sender)

            await expect(
                broker.redeemWinningTicket(ticket, senderSig, recipientRand)
            ).to.be.revertedWith("sender deposit and reserve are zero")
        })

        describe("deposit < faceValue", () => {
            describe("sender.deposit is zero", () => {
                it("does not allow a claim if there are no registered recipients", async () => {
                    await fixture.roundsManager.setMockUint256(
                        functionSig("currentRound()"),
                        currentRound
                    )
                    // Set the number of registered recipients to 0
                    await fixture.bondingManager.setMockUint256(
                        functionSig("getTranscoderPoolSize()"),
                        0
                    )
                    await fixture.bondingManager.setMockBool(
                        functionSig("isActiveTranscoder(address)"),
                        false
                    )
                    await broker.fundReserve({value: 1000})

                    const recipientRand = 5
                    const faceValue = 10
                    const ticket = createWinningTicket(
                        recipient,
                        sender,
                        recipientRand,
                        faceValue
                    )
                    const senderSig = await signMsg(
                        getTicketHash(ticket),
                        sender
                    )

                    // There are no registered recipients so the recipients should not be able to claim
                    const tx = broker
                        .connect(signers[1])
                        .redeemWinningTicket(ticket, senderSig, recipientRand)
                    await expect(tx).to.emit(broker, "WinningTicketRedeemed")
                    await expect(tx).to.not.emit(broker, "ReserveClaimed")
                    assert.equal(
                        (
                            await broker.claimedReserve(sender, recipient)
                        ).toString(),
                        "0"
                    )
                })

                it("does not allow a claim for an unregistered recipient", async () => {
                    const numRecipients = 10
                    await fixture.roundsManager.setMockUint256(
                        functionSig("currentRound()"),
                        currentRound
                    )
                    await fixture.bondingManager.setMockUint256(
                        functionSig("getTranscoderPoolSize()"),
                        numRecipients
                    )
                    await fixture.bondingManager.setMockBool(
                        functionSig("isActiveTranscoder(address)"),
                        false
                    )
                    await broker.fundReserve({value: 1000})

                    const recipientRand = 5
                    const faceValue = 10
                    const ticket = createWinningTicket(
                        recipient,
                        sender,
                        recipientRand,
                        faceValue
                    )
                    const senderSig = await signMsg(
                        getTicketHash(ticket),
                        sender
                    )

                    // Recipient is not registered so it should not be able to claim from the reserve
                    const tx = broker
                        .connect(signers[1])
                        .redeemWinningTicket(ticket, senderSig, recipientRand)
                    await expect(tx).to.emit(broker, "WinningTicketRedeemed")
                    await expect(tx).to.not.emit(broker, "ReserveClaimed")
                    assert.equal(
                        (
                            await broker.claimedReserve(sender, recipient)
                        ).toString(),
                        "0"
                    )
                })

                it("does not allow a claim for a registered recipient that has claimed the max allocation", async () => {
                    const numRecipients = 10
                    const reserve = 1000
                    const allocation = reserve / numRecipients
                    await fixture.roundsManager.setMockUint256(
                        functionSig("currentRound()"),
                        currentRound
                    )
                    await fixture.bondingManager.setMockUint256(
                        functionSig("getTranscoderPoolSize()"),
                        numRecipients
                    )
                    await fixture.bondingManager.setMockBool(
                        functionSig("isActiveTranscoder(address)"),
                        true
                    )
                    await broker.fundReserve({value: reserve})

                    const recipientRand = 5
                    const faceValue = allocation
                    const ticket = createWinningTicket(
                        recipient,
                        sender,
                        recipientRand,
                        faceValue
                    )
                    const senderSig = await signMsg(
                        getTicketHash(ticket),
                        sender
                    )

                    // Claim with faceValue = max allocation
                    await broker
                        .connect(signers[1])
                        .redeemWinningTicket(ticket, senderSig, recipientRand)

                    const ticket2 = createWinningTicket(
                        recipient,
                        sender,
                        recipientRand,
                        faceValue
                    )
                    ticket2.senderNonce++
                    const senderSig2 = await signMsg(
                        getTicketHash(ticket2),
                        sender
                    )

                    // Should not claim anything because recipient has already claimed the max allocation
                    const tx = broker
                        .connect(signers[1])
                        .redeemWinningTicket(ticket2, senderSig2, recipientRand)

                    await expect(tx).to.not.emit(broker, "ReserveClaimed")
                })

                it("allows a partial claim for a registered recipient trying to claim an amount that would exceed the max allocation", async () => {
                    const numRecipients = 10
                    const reserve = 1000
                    const allocation = reserve / numRecipients
                    const partialAmount = 10
                    await fixture.roundsManager.setMockUint256(
                        functionSig("currentRound()"),
                        currentRound
                    )
                    await fixture.bondingManager.setMockUint256(
                        functionSig("getTranscoderPoolSize()"),
                        numRecipients
                    )
                    await fixture.bondingManager.setMockBool(
                        functionSig("isActiveTranscoder(address)"),
                        true
                    )
                    await broker.fundReserve({value: reserve})

                    const recipientRand = 5
                    const faceValue = allocation - partialAmount
                    const ticket = createWinningTicket(
                        recipient,
                        sender,
                        recipientRand,
                        faceValue
                    )
                    const senderSig = await signMsg(
                        getTicketHash(ticket),
                        sender
                    )

                    // Leave partialAmount unclaimed
                    await broker
                        .connect(signers[1])
                        .redeemWinningTicket(ticket, senderSig, recipientRand)

                    const ticket2 = createWinningTicket(
                        recipient,
                        sender,
                        recipientRand,
                        faceValue
                    )
                    ticket2.senderNonce++
                    const senderSig2 = await signMsg(
                        getTicketHash(ticket2),
                        sender
                    )

                    // Claim the remaining partialAmount
                    const tx = broker
                        .connect(signers[1])
                        .redeemWinningTicket(ticket2, senderSig2, recipientRand)

                    await expect(tx)
                        .to.emit(broker, "ReserveClaimed")
                        .withArgs(sender, recipient, partialAmount)
                })

                it("allows a claim from a registered recipient", async () => {
                    const fromBlock = (await web3.eth.getBlock("latest")).number
                    const numRecipients = 10
                    await fixture.roundsManager.setMockUint256(
                        functionSig("currentRound()"),
                        currentRound
                    )
                    await fixture.bondingManager.setMockUint256(
                        functionSig("getTranscoderPoolSize()"),
                        numRecipients
                    )
                    await fixture.bondingManager.setMockBool(
                        functionSig("isActiveTranscoder(address)"),
                        true
                    )
                    await broker.fundReserve({value: 1000})

                    const recipientRand = 5
                    const faceValue = 10
                    const ticket = createWinningTicket(
                        recipient,
                        sender,
                        recipientRand,
                        faceValue
                    )
                    const senderSig = await signMsg(
                        getTicketHash(ticket),
                        sender
                    )

                    const tx = broker
                        .connect(signers[1])
                        .redeemWinningTicket(ticket, senderSig, recipientRand)

                    await expect(tx)
                        .to.emit(broker, "ReserveClaimed")
                        .withArgs(
                            sender,
                            recipient,
                            ticket.faceValue.toString()
                        )

                    // Check that fee pool in BondingManager is updated
                    const filter =
                        await fixture.bondingManager.filters.UpdateTranscoderWithFees()
                    const events = await fixture.bondingManager.queryFilter(
                        filter,
                        fromBlock,
                        "latest"
                    )

                    assert.equal(events.length, 1)
                    const event = events[0]
                    assert.equal(event.args.transcoder, recipient)
                    assert.equal(event.args.fees, faceValue)
                    assert.equal(event.args.round, currentRound)
                })

                it("allows multiple claims from a registered recipient", async () => {
                    const numRecipients = 10
                    await fixture.roundsManager.setMockUint256(
                        functionSig("currentRound()"),
                        currentRound
                    )
                    await fixture.bondingManager.setMockUint256(
                        functionSig("getTranscoderPoolSize()"),
                        numRecipients
                    )
                    await fixture.bondingManager.setMockBool(
                        functionSig("isActiveTranscoder(address)"),
                        true
                    )
                    await broker.fundReserve({value: 1000})

                    const recipientRand = 5
                    const faceValue = 10
                    const ticket = createWinningTicket(
                        recipient,
                        sender,
                        recipientRand,
                        faceValue
                    )
                    const senderSig = await signMsg(
                        getTicketHash(ticket),
                        sender
                    )

                    await broker
                        .connect(signers[1])
                        .redeemWinningTicket(ticket, senderSig, recipientRand)

                    const ticket2 = createWinningTicket(
                        recipient,
                        sender,
                        recipientRand,
                        faceValue + 15
                    )
                    ticket2.senderNonce++
                    const senderSig2 = await signMsg(
                        getTicketHash(ticket2),
                        sender
                    )

                    const tx = broker
                        .connect(signers[1])
                        .redeemWinningTicket(ticket2, senderSig2, recipientRand)
                    await expect(tx)
                        .to.emit(broker, "ReserveClaimed")
                        .withArgs(
                            sender,
                            recipient,
                            ticket2.faceValue.toString()
                        )

                    assert.equal(
                        (
                            await broker.claimedReserve(sender, recipient)
                        ).toString(),
                        (ticket.faceValue + ticket2.faceValue).toString()
                    )
                })

                it("allows claims from multiple registered recipients", async () => {
                    const recipient2 = signers[2]
                    const numRecipients = 10
                    await fixture.roundsManager.setMockUint256(
                        functionSig("currentRound()"),
                        currentRound
                    )
                    await fixture.bondingManager.setMockUint256(
                        functionSig("getTranscoderPoolSize()"),
                        numRecipients
                    )
                    await fixture.bondingManager.setMockBool(
                        functionSig("isActiveTranscoder(address)"),
                        true
                    )
                    await broker.fundReserve({value: 1000})

                    const recipientRand = 5
                    const faceValue = 10
                    const ticket = createWinningTicket(
                        recipient,
                        sender,
                        recipientRand,
                        faceValue
                    )
                    const senderSig = await signMsg(
                        getTicketHash(ticket),
                        sender
                    )

                    await broker
                        .connect(signers[1])
                        .redeemWinningTicket(ticket, senderSig, recipientRand)

                    const ticket2 = createWinningTicket(
                        recipient2.address,
                        sender,
                        recipientRand,
                        faceValue + 15
                    )
                    const senderSig2 = await signMsg(
                        getTicketHash(ticket2),
                        sender
                    )

                    const tx = broker
                        .connect(recipient2)
                        .redeemWinningTicket(ticket2, senderSig2, recipientRand)

                    await expect(tx)
                        .to.emit(broker, "ReserveClaimed")
                        .withArgs(
                            sender,
                            recipient2.address,
                            ticket2.faceValue.toString()
                        )

                    assert.equal(
                        (
                            await broker.claimedReserve(sender, recipient)
                        ).toString(),
                        ticket.faceValue.toString()
                    )
                    assert.equal(
                        (
                            await broker.claimedReserve(
                                sender,
                                recipient2.address
                            )
                        ).toString(),
                        ticket2.faceValue.toString()
                    )
                })

                it("allows claims from all registered recipients for their full reserve allocations", async () => {
                    const recipient2 = signers[2]
                    const numRecipients = 2
                    const reserve = 1000
                    const allocation = reserve / numRecipients
                    const fromBlock = (await web3.eth.getBlock("latest")).number
                    await fixture.roundsManager.setMockUint256(
                        functionSig("currentRound()"),
                        currentRound
                    )
                    await fixture.bondingManager.setMockUint256(
                        functionSig("getTranscoderPoolSize()"),
                        numRecipients
                    )
                    await fixture.bondingManager.setMockBool(
                        functionSig("isActiveTranscoder(address)"),
                        true
                    )
                    await broker.fundReserve({value: reserve})

                    const recipientRand = 5
                    const faceValue = allocation * 2
                    const ticket = createWinningTicket(
                        recipient,
                        sender,
                        recipientRand,
                        faceValue
                    )
                    const senderSig = await signMsg(
                        getTicketHash(ticket),
                        sender
                    )

                    await broker
                        .connect(signers[1])
                        .redeemWinningTicket(ticket, senderSig, recipientRand)

                    const ticket2 = createWinningTicket(
                        recipient2.address,
                        sender,
                        recipientRand,
                        faceValue + 15
                    )
                    const senderSig2 = await signMsg(
                        getTicketHash(ticket2),
                        sender
                    )

                    await broker
                        .connect(recipient2)
                        .redeemWinningTicket(ticket2, senderSig2, recipientRand)

                    const filter = await broker.filters.ReserveClaimed()
                    const events = await broker.queryFilter(
                        filter,
                        fromBlock,
                        "latest"
                    )

                    assert.equal(events.length, 2)
                    const event = events[0]
                    assert.equal(event.args.reserveHolder, sender)
                    assert.equal(event.args.claimant, recipient)
                    assert.equal(event.args.amount, allocation.toString())
                    const event2 = events[1]
                    assert.equal(event2.args.reserveHolder, sender)
                    assert.equal(event2.args.claimant, recipient2.address)
                    assert.equal(event2.args.amount, allocation.toString())
                    assert.equal(
                        (
                            await broker.getSenderInfo(sender)
                        ).reserve.fundsRemaining.toString(),
                        "0"
                    )
                    assert.equal(
                        (
                            await broker.claimedReserve(sender, recipient)
                        ).toString(),
                        allocation.toString()
                    )
                    assert.equal(
                        (
                            await broker.claimedReserve(
                                sender,
                                recipient2.address
                            )
                        ).toString(),
                        allocation.toString()
                    )
                })
            })

            describe("sender.deposit is not zero", () => {
                describe("sender.reserve is zero", () => {
                    it("transfers deposit and updates recipient's fee pool in BondingManager", async () => {
                        const fromBlock = (await web3.eth.getBlock("latest"))
                            .number
                        const numRecipients = 10
                        const deposit = 500
                        await fixture.roundsManager.setMockUint256(
                            functionSig("currentRound()"),
                            currentRound
                        )
                        await fixture.bondingManager.setMockUint256(
                            functionSig("getTranscoderPoolSize()"),
                            numRecipients
                        )
                        await fixture.bondingManager.setMockBool(
                            functionSig("isActiveTranscoder(address)"),
                            true
                        )
                        await broker.fundDeposit({value: deposit})

                        const recipientRand = 5
                        const faceValue = 1000
                        const ticket = createWinningTicket(
                            recipient,
                            sender,
                            recipientRand,
                            faceValue
                        )
                        const senderSig = await signMsg(
                            getTicketHash(ticket),
                            sender
                        )

                        await broker
                            .connect(signers[1])
                            .redeemWinningTicket(
                                ticket,
                                senderSig,
                                recipientRand
                            )

                        const filter =
                            await fixture.bondingManager.filters.UpdateTranscoderWithFees()
                        const events = await fixture.bondingManager.queryFilter(
                            filter,
                            fromBlock,
                            "latest"
                        )

                        assert.equal(events.length, 1)
                        const event = events[0]
                        assert.equal(event.args.transcoder, recipient)
                        assert.equal(event.args.fees, deposit.toString())
                        assert.equal(event.args.round, currentRound)
                        const endDeposit = (
                            await broker.getSenderInfo(sender)
                        ).sender.deposit.toString()
                        assert.equal(endDeposit, "0")
                    })
                })

                describe("sender.reserve is not zero", () => {
                    it("transfers deposit, claims from reserve and updates recipient's fee pool in BondingManager", async () => {
                        const fromBlock = (await web3.eth.getBlock("latest"))
                            .number
                        const numRecipients = 10
                        const deposit = 500
                        const reserve = 50000
                        await fixture.roundsManager.setMockUint256(
                            functionSig("currentRound()"),
                            currentRound
                        )
                        await fixture.bondingManager.setMockUint256(
                            functionSig("getTranscoderPoolSize()"),
                            numRecipients
                        )
                        await fixture.bondingManager.setMockBool(
                            functionSig("isActiveTranscoder(address)"),
                            true
                        )
                        await broker.fundDeposit({value: deposit})
                        await broker.fundReserve({value: reserve})

                        const recipientRand = 5
                        // Should be covered by deposit = 500 and reserve allocation = 50000 / 10 = 500
                        const faceValue = 1000
                        const ticket = createWinningTicket(
                            recipient,
                            sender,
                            recipientRand,
                            faceValue
                        )
                        const senderSig = await signMsg(
                            getTicketHash(ticket),
                            sender
                        )

                        await broker
                            .connect(signers[1])
                            .redeemWinningTicket(
                                ticket,
                                senderSig,
                                recipientRand
                            )

                        const filter =
                            await fixture.bondingManager.filters.UpdateTranscoderWithFees()
                        const events = await fixture.bondingManager.queryFilter(
                            filter,
                            fromBlock,
                            "latest"
                        )

                        assert.equal(events.length, 1)
                        const event = events[0]
                        assert.equal(event.args.transcoder, recipient)
                        assert.equal(
                            event.args.fees,
                            ticket.faceValue.toString()
                        )
                        assert.equal(event.args.round, currentRound)
                        const endDeposit = (
                            await broker.getSenderInfo(sender)
                        ).sender.deposit.toString()
                        assert.equal(endDeposit, "0")
                    })
                })
            })
        })

        it("does not transfer sender.deposit to recipient when faceValue is zero", async () => {
            const deposit = 1500
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await broker.fundDeposit({value: deposit})

            const recipientRand = 5
            const ticket = createWinningTicket(recipient, sender, recipientRand)
            const senderSig = await signMsg(getTicketHash(ticket), sender)

            // Redeem with ticket faceValue = 0
            const tx = broker
                .connect(signers[1])
                .redeemWinningTicket(ticket, senderSig, recipientRand)

            await expect(tx).to.not.emit(broker, "WinningTicketTransfer")
            await expect(tx).to.not.emit(
                fixture.bondingManager,
                "UpdateTranscoderWithFees"
            )
            const endDeposit = (
                await broker.getSenderInfo(sender)
            ).sender.deposit.toString()
            assert.equal(endDeposit, deposit)
        })

        it("updates recipient's fee pool in BondingManager with faceValue when deposit = faceValue", async () => {
            const fromBlock = (await web3.eth.getBlock("latest")).number
            const deposit = 1500
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await broker.fundDeposit({value: deposit})

            const recipientRand = 5
            const faceValue = deposit
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)

            // Redeem with ticket faceValue = deposit
            await broker
                .connect(signers[1])
                .redeemWinningTicket(ticket, senderSig, recipientRand)

            const filter =
                await fixture.bondingManager.filters.UpdateTranscoderWithFees()
            const events = await fixture.bondingManager.queryFilter(
                filter,
                fromBlock,
                "latest"
            )

            assert.equal(events.length, 1)
            const event = events[0]
            assert.equal(event.args.transcoder, recipient)
            assert.equal(event.args.fees, faceValue.toString())
            assert.equal(event.args.round, currentRound)
            const endDeposit = (
                await broker.getSenderInfo(sender)
            ).sender.deposit.toString()
            assert.equal(endDeposit, "0")
        })

        it("updates recipient's fee pool in BondingManager with faceValue when deposit > faceValue", async () => {
            const fromBlock = (await web3.eth.getBlock("latest")).number
            const deposit = 1500
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await broker.fundDeposit({value: deposit})

            const recipientRand = 5
            const faceValue = deposit - 100
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)

            // Redeem with ticket faceValue < deposit
            await broker
                .connect(signers[1])
                .redeemWinningTicket(ticket, senderSig, recipientRand)

            const filter =
                await fixture.bondingManager.filters.UpdateTranscoderWithFees()
            const events = await fixture.bondingManager.queryFilter(
                filter,
                fromBlock,
                "latest"
            )

            assert.equal(events.length, 1)
            const event = events[0]
            assert.equal(event.args.transcoder, recipient)
            assert.equal(event.args.fees, faceValue.toString())
            assert.equal(event.args.round, currentRound)
            const endDeposit = (
                await broker.getSenderInfo(sender)
            ).sender.deposit.toString()
            assert.equal(endDeposit, (deposit - faceValue).toString())
        })

        it("can be called by an account that is not the recipient", async () => {
            const thirdParty = signers[2]
            const deposit = 1500
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await broker.fundDeposit({value: deposit})

            const recipientRand = 5
            const faceValue = 1000
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)

            // Third party redeems the ticket
            await broker
                .connect(thirdParty)
                .redeemWinningTicket(ticket, senderSig, recipientRand)

            const endDeposit = (
                await broker.getSenderInfo(sender)
            ).sender.deposit.toString()
            assert.equal(endDeposit, (deposit - faceValue).toString())
        })

        it("emits a WinningTicketRedeemed event", async () => {
            const deposit = 1500
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await broker.fundDeposit({value: deposit})

            const recipientRand = 5
            const faceValue = 1500
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)

            const tx = broker
                .connect(signers[1])
                .redeemWinningTicket(ticket, senderSig, recipientRand)
            await expect(tx)
                .to.emit(broker, "WinningTicketRedeemed")
                .withArgs(
                    sender,
                    recipient,
                    ticket.faceValue.toString(),
                    ticket.winProb.toString(),
                    ticket.senderNonce.toString(),
                    recipientRand.toString(),
                    ticket.auxData
                )
        })

        it("emits a WinningTicketRedeemed event with indexed sender", async () => {
            const sender2 = signers[2]
            const deposit = 1500
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await broker.fundDeposit({value: deposit})
            await broker.connect(sender2).fundDeposit({value: deposit})

            const recipientRand = 5
            const faceValue = 1500
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const ticket2 = createWinningTicket(
                recipient,
                sender2.address,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)
            const senderSig2 = await signMsg(
                getTicketHash(ticket2),
                sender2.address
            )
            const fromBlock = (await web3.eth.getBlock("latest")).number

            await broker
                .connect(signers[1])
                .redeemWinningTicket(ticket, senderSig, recipientRand)
            await broker
                .connect(signers[1])
                .redeemWinningTicket(ticket2, senderSig2, recipientRand)

            const filter = await broker.filters.WinningTicketRedeemed(sender)
            const events = await broker.queryFilter(filter, fromBlock, "latest")

            assert.equal(events.length, 1)
            assert.equal(events[0].args.sender, sender)
        })

        it("emits a WinningTicketRedeemed event with indexed recipient", async () => {
            const recipient2 = signers[2]
            const deposit = 1500
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await broker.fundDeposit({value: deposit})

            const recipientRand = 5
            const faceValue = 200
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const ticket2 = createWinningTicket(
                recipient2.address,
                sender,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)
            const senderSig2 = await signMsg(getTicketHash(ticket2), sender)
            const fromBlock = (await web3.eth.getBlock("latest")).number

            await broker
                .connect(signers[1])
                .redeemWinningTicket(ticket, senderSig, recipientRand)
            await broker
                .connect(recipient2)
                .redeemWinningTicket(ticket2, senderSig2, recipientRand)

            const filter = await broker.filters.WinningTicketRedeemed(
                sender,
                recipient
            )
            const events = await broker.queryFilter(filter, fromBlock, "latest")

            assert.equal(events.length, 1)
            assert.equal(events[0].args.recipient, recipient)
        })
    })

    describe("batchRedeemWinningTickets", () => {
        it("should fail if the system is paused", async () => {
            const deposit = 1500
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await broker.fundDeposit({value: deposit})

            const recipientRand = 5
            const faceValue = 500
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const ticket2 = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            ticket2.senderNonce++
            const senderSig = await signMsg(getTicketHash(ticket), sender)
            const senderSig2 = await signMsg(getTicketHash(ticket2), sender)

            await fixture.controller.pause()

            await expect(
                broker
                    .connect(signers[1])
                    .batchRedeemWinningTickets(
                        [ticket, ticket2],
                        [senderSig, senderSig2],
                        [recipientRand, recipientRand]
                    )
            ).to.be.revertedWith("system is paused")
        })

        it("should fail if the current round is not initialized", async () => {
            const deposit = 1500
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await broker.fundDeposit({value: deposit})

            const recipientRand = 5
            const faceValue = 500
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const ticket2 = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            ticket2.senderNonce++
            const senderSig = await signMsg(getTicketHash(ticket), sender)
            const senderSig2 = await signMsg(getTicketHash(ticket2), sender)

            await fixture.roundsManager.setMockBool(
                functionSig("currentRoundInitialized()"),
                false
            )

            await expect(
                broker
                    .connect(signers[1])
                    .batchRedeemWinningTickets(
                        [ticket, ticket2],
                        [senderSig, senderSig2],
                        [recipientRand, recipientRand]
                    )
            ).to.be.revertedWith("current round is not initialized")
        })

        it("redeems 2 tickets from the same sender", async () => {
            const deposit = 1500
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await broker.fundDeposit({value: deposit})

            const fromBlock = (await web3.eth.getBlock("latest")).number
            const recipientRand = 5
            const faceValue = 500
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const ticket2 = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            ticket2.senderNonce++
            const senderSig = await signMsg(getTicketHash(ticket), sender)
            const senderSig2 = await signMsg(getTicketHash(ticket2), sender)

            await broker
                .connect(signers[1])
                .batchRedeemWinningTickets(
                    [ticket, ticket2],
                    [senderSig, senderSig2],
                    [recipientRand, recipientRand]
                )

            const filter = await broker.filters.WinningTicketRedeemed(
                sender,
                recipient
            )
            const events = await broker.queryFilter(filter, fromBlock, "latest")

            assert.equal(events.length, 2)
        })

        it("redeems 2 tickets from different senders", async () => {
            const sender2 = signers[2]
            const deposit = 1500
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await broker.fundDeposit({value: deposit})
            await broker.connect(sender2).fundDeposit({value: deposit})

            const fromBlock = (await web3.eth.getBlock("latest")).number
            const recipientRand = 5
            const faceValue = 500
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const ticket2 = createWinningTicket(
                recipient,
                sender2.address,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)
            const senderSig2 = await signMsg(
                getTicketHash(ticket2),
                sender2.address
            )

            await broker
                .connect(signers[1])
                .batchRedeemWinningTickets(
                    [ticket, ticket2],
                    [senderSig, senderSig2],
                    [recipientRand, recipientRand]
                )

            let filter = await broker.filters.WinningTicketRedeemed(
                sender,
                recipient
            )
            const sender1Events = await broker.queryFilter(
                filter,
                fromBlock,
                "latest"
            )
            filter = await broker.filters.WinningTicketRedeemed(
                sender2.address,
                recipient
            )
            const sender2Events = await broker.queryFilter(
                filter,
                fromBlock,
                "latest"
            )

            assert.equal(sender1Events.length, 1)
            assert.equal(sender2Events.length, 1)
        })

        it("redeems 2 tickets with 1 failure", async () => {
            const deposit = 1500
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await broker.fundDeposit({value: deposit})

            const fromBlock = (await web3.eth.getBlock("latest")).number
            const recipientRand = 5
            const faceValue = 500
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const ticket2 = createWinningTicket(
                constants.NULL_ADDRESS,
                sender,
                recipientRand,
                faceValue
            )
            ticket2.senderNonce++
            const senderSig = await signMsg(getTicketHash(ticket), sender)
            const senderSig2 = await signMsg(getTicketHash(ticket2), sender)

            await broker
                .connect(signers[1])
                .batchRedeemWinningTickets(
                    [ticket, ticket2],
                    [senderSig, senderSig2],
                    [recipientRand, recipientRand]
                )

            const filter = await broker.filters.WinningTicketRedeemed(
                sender,
                recipient
            )
            const events = await broker.queryFilter(filter, fromBlock, "latest")

            assert.equal(events.length, 1)
            // The ticket with a valid recipient should be the only one redeemed
            assert.equal(events[0].args.recipient, recipient)
        })

        it("redeems 2 tickets with 1 failure because the 2nd ticket is a replay of the 1st", async () => {
            const deposit = 1500
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await broker.fundDeposit({value: deposit})

            const fromBlock = (await web3.eth.getBlock("latest")).number
            const recipientRand = 5
            const faceValue = 500
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)

            await broker
                .connect(signers[1])
                .batchRedeemWinningTickets(
                    [ticket, ticket],
                    [senderSig, senderSig],
                    [recipientRand, recipientRand]
                )

            const filter = await broker.filters.WinningTicketRedeemed(
                sender,
                recipient
            )
            const events = await broker.queryFilter(filter, fromBlock, "latest")

            // There should have been only one ticket redeemed because the second one is a replay
            assert.equal(events.length, 1)
        })

        it("redeems 2 tickets with 2 failures", async () => {
            const deposit = 1500
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await broker.fundDeposit({value: deposit})

            const recipientRand = 5
            const faceValue = 500
            const ticket = createWinningTicket(
                constants.NULL_ADDRESS,
                sender,
                recipientRand,
                faceValue
            )
            const ticket2 = createWinningTicket(
                constants.NULL_ADDRESS,
                sender,
                recipientRand,
                faceValue
            )
            ticket2.senderNonce++
            const senderSig = await signMsg(getTicketHash(ticket), sender)
            const senderSig2 = await signMsg(getTicketHash(ticket2), sender)

            const tx = broker
                .connect(signers[1])
                .batchRedeemWinningTickets(
                    [ticket, ticket2],
                    [senderSig, senderSig2],
                    [recipientRand, recipientRand]
                )

            await expect(tx).to.not.emit(broker, "WinningTicketRedeemed")
        })
    })

    describe("unlock", () => {
        it("fails if the system is paused", async () => {
            await broker.fundDeposit({value: 1000})
            await fixture.controller.pause()
            await expect(broker.unlock()).to.be.revertedWith("system is paused")
        })

        it("reverts when both deposit and reserve are zero", async () => {
            await expect(broker.unlock()).to.be.revertedWith(
                "sender deposit and reserve are zero"
            )
        })

        it("reverts when called twice", async () => {
            await broker.fundDeposit({value: 1000})
            await broker.unlock()

            await expect(broker.unlock()).to.be.revertedWith(
                "unlock already initiated"
            )
        })

        it("reverts when called twice by multiple senders", async () => {
            const sender2 = signers[2]
            await broker.fundDeposit({value: 1000})
            await broker.connect(sender2).fundDeposit({value: 2000})
            await broker.unlock()
            await broker.connect(sender2).unlock()

            await expect(broker.unlock()).to.be.revertedWith(
                "unlock already initiated"
            )
            await expect(broker.connect(sender2).unlock()).to.be.revertedWith(
                "unlock already initiated"
            )
        })

        it("sets withdrawRound according to constructor config", async () => {
            await broker.fundDeposit({value: 1000})

            await broker.unlock()

            const expectedWithdrawRound = currentRound + unlockPeriod
            const withdrawRound = (
                await broker.getSenderInfo(sender)
            ).sender.withdrawRound.toString()
            assert.equal(withdrawRound, expectedWithdrawRound.toString())
        })

        it("sets isUnlockInProgress to true", async () => {
            await broker.fundDeposit({value: 1000})

            await broker.unlock()

            const isUnlockInProgress = await broker.isUnlockInProgress(sender)
            assert(isUnlockInProgress)
        })

        it("emits an Unlock event", async () => {
            await broker.fundDeposit({value: 1000})
            const expectedStartRound = currentRound
            const expectedEndRound = expectedStartRound + unlockPeriod

            const tx = broker.unlock()

            await expect(tx)
                .to.emit(broker, "Unlock")
                .withArgs(
                    sender,
                    expectedStartRound.toString(),
                    expectedEndRound.toString()
                )
        })

        it("emits an Unlock event indexed by sender", async () => {
            const fromBlock = (await web3.eth.getBlock("latest")).number
            await broker.fundDeposit({value: 1000})

            await broker.unlock()

            const filter = await broker.filters.Unlock(sender)
            const events = await broker.queryFilter(filter, fromBlock, "latest")

            assert.equal(events.length, 1)
            const event = events[0]
            assert.equal(event.args.sender, sender)
        })
    })

    describe("cancelUnlock", () => {
        it("fails if the system is paused", async () => {
            await broker.fundDeposit({value: 1000})
            await broker.unlock()
            await fixture.controller.pause()
            await expect(broker.cancelUnlock()).to.be.revertedWith(
                "system is paused"
            )
        })

        it("reverts if sender is not in an unlocking state", async () => {
            await expect(broker.cancelUnlock()).to.be.revertedWith(
                "no unlock request in progress"
            )
        })

        it("sets isUnlockInProgress to false", async () => {
            await broker.fundDeposit({value: 1000})
            await broker.unlock()

            await broker.cancelUnlock()

            const isUnlockInProgress = await broker.isUnlockInProgress(sender)
            assert(!isUnlockInProgress)
        })

        it("prevents withdrawal", async () => {
            await broker.fundDeposit({value: 1000})
            await broker.unlock()
            await fixture.rpc.wait(unlockPeriod)

            await broker.cancelUnlock()
            await expect(broker.withdraw()).to.be.revertedWith(
                "no unlock request in progress"
            )
        })

        it("emits an UnlockCancelled event", async () => {
            await broker.fundDeposit({value: 1000})
            await broker.unlock()

            const tx = broker.cancelUnlock()

            await expect(tx).to.emit(broker, "UnlockCancelled").withArgs(sender)
        })

        it("emits an UnlockCancelled event with an indexed sender", async () => {
            await broker.fundDeposit({value: 1000})
            const fromBlock = (await web3.eth.getBlock("latest")).number
            await broker.unlock()

            await broker.cancelUnlock()

            const filter = await broker.filters.UnlockCancelled(sender)
            const events = await broker.queryFilter(filter, fromBlock, "latest")

            assert.equal(events.length, 1)
            const event = events[0]
            assert.equal(event.args.sender, sender)
        })
    })

    describe("withdraw", () => {
        it("fails if the system is paused", async () => {
            await broker.fundDeposit({value: 1000})
            await broker.unlock()
            await fixture.rpc.wait(unlockPeriod)
            await fixture.controller.pause()
            await expect(broker.withdraw()).to.be.revertedWith(
                "system is paused"
            )
        })

        it("reverts when both deposit and reserve are zero", async () => {
            await expect(broker.withdraw()).to.be.revertedWith(
                "sender deposit and reserve are zero"
            )
        })

        it("reverts when no unlock request has been started", async () => {
            await broker.fundDeposit({value: 1000})

            await expect(broker.withdraw()).to.be.revertedWith(
                "no unlock request in progress"
            )
        })

        it("reverts when account is locked", async () => {
            await broker.fundDeposit({value: 1000})
            await broker.unlock()

            await expect(broker.withdraw()).to.be.revertedWith(
                "account is locked"
            )
        })

        it("sets deposit and reserve to zero", async () => {
            await broker.fundDeposit({value: 1000})
            await broker.fundReserve({value: 2000})
            await broker.unlock()
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound + unlockPeriod
            )

            await broker.withdraw()

            const senderInfo = await broker.getSenderInfo(sender)
            const deposit = senderInfo.sender.deposit
            const reserve = senderInfo.reserve.fundsRemaining
            assert.equal(deposit, "0")
            assert.equal(reserve, "0")
        })

        it("transfers the sum of deposit and reserve to sender", async () => {
            const fromBlock = (await web3.eth.getBlock("latest")).number
            const deposit = 1000
            const reserve = 2000
            await broker.fundDeposit({value: deposit})
            await broker.fundReserve({value: reserve})
            await broker.unlock()
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound + unlockPeriod
            )

            await broker.withdraw()

            const filter = await fixture.minter.filters.TrustedWithdrawETH()
            const events = await fixture.minter.queryFilter(
                filter,
                fromBlock,
                "latest"
            )

            assert.equal(events.length, 1)
            const event = events[0]
            assert.equal(event.args.to, sender)
            assert.equal(
                event.args.amount.toString(),
                (deposit + reserve).toString()
            )
        })

        it("completes withdrawal when deposit == 0", async () => {
            const fromBlock = (await web3.eth.getBlock("latest")).number
            const reserve = 2000
            await broker.fundReserve({value: reserve})
            await broker.unlock()
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound + unlockPeriod
            )

            await broker.withdraw()

            const filter = await fixture.minter.filters.TrustedWithdrawETH()
            const events = await fixture.minter.queryFilter(
                filter,
                fromBlock,
                "latest"
            )

            assert.equal(events.length, 1)
            const event = events[0]
            assert.equal(event.args.to, sender)
            assert.equal(event.args.amount.toString(), reserve.toString())
        })

        it("completes withdrawal when reserve == 0", async () => {
            const fromBlock = (await web3.eth.getBlock("latest")).number
            const deposit = 1000
            await broker.fundDeposit({value: deposit})
            await broker.unlock()
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound + unlockPeriod
            )

            await broker.withdraw()

            const filter = await fixture.minter.filters.TrustedWithdrawETH()
            const events = await fixture.minter.queryFilter(
                filter,
                fromBlock,
                "latest"
            )

            assert.equal(events.length, 1)
            const event = events[0]
            assert.equal(event.args.to, sender)
            assert.equal(event.args.amount.toString(), deposit.toString())
        })

        it("emits a Withdrawal event", async () => {
            const deposit = 1000
            const reserve = 2000
            await broker.fundDeposit({value: deposit})
            await broker.fundReserve({value: reserve})
            await broker.unlock()
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound + unlockPeriod
            )

            const tx = broker.withdraw()

            await expect(tx)
                .to.emit(broker, "Withdrawal")
                .withArgs(sender, deposit.toString(), reserve.toString())
        })

        it("emits a Withdrawal event with indexed sender", async () => {
            const fromBlock = (await web3.eth.getBlock("latest")).number
            const deposit = 1000
            const reserve = 2000
            await broker.fundDeposit({value: deposit})
            await broker.fundReserve({value: reserve})
            await broker.unlock()
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound + unlockPeriod
            )

            await broker.withdraw()

            const filter = await broker.filters.Withdrawal(sender)
            const events = await broker.queryFilter(filter, fromBlock, "latest")

            assert.equal(events.length, 1)
            const event = events[0]
            assert.equal(event.args.sender, sender)
            assert.equal(event.args.deposit.toString(), deposit.toString())
            assert.equal(event.args.reserve.toString(), reserve.toString())
        })
    })

    describe("claimableReserve", () => {
        it("returns 0 when the reserveHolder does not have a reserve", async () => {
            const numRecipients = 10
            await fixture.bondingManager.setMockUint256(
                functionSig("getTranscoderPoolSize()"),
                numRecipients
            )
            assert.equal(
                (
                    await broker.claimableReserve(
                        constants.NULL_ADDRESS,
                        constants.NULL_ADDRESS
                    )
                ).toString(),
                "0"
            )
        })

        it("returns 0 if claimant is not active in the current round", async () => {
            const reserve = 1000
            await broker.fundReserve({value: reserve})
            assert.equal(
                (
                    await broker.claimableReserve(
                        sender,
                        constants.NULL_ADDRESS
                    )
                ).toString(),
                "0"
            )
        })

        it("returns 0 when the active transcoder pool size is 0", async () => {
            await fixture.bondingManager.setMockBool(
                functionSig("isActiveTranscoder(address)"),
                true
            )
            await fixture.bondingManager.setMockUint256(
                functionSig("getTranscoderPoolSize()"),
                0
            )

            const reserve = 1000
            await broker.fundReserve({value: reserve})
            assert.equal(
                (
                    await broker.claimableReserve(
                        sender,
                        constants.NULL_ADDRESS
                    )
                ).toString(),
                "0"
            )
        })

        it("returns claimable reserve for a claimaint if reserve was not claimed from", async () => {
            const numRecipients = 10
            const deposit = 1000
            const reserve = 1000
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await fixture.bondingManager.setMockUint256(
                functionSig("getTranscoderPoolSize()"),
                numRecipients
            )
            await fixture.bondingManager.setMockBool(
                functionSig("isActiveTranscoder(address)"),
                true
            )
            await broker.fundDepositAndReserve(deposit, reserve, {
                value: deposit + reserve
            })
            assert.equal(
                (await broker.claimableReserve(sender, recipient)).toString(),
                (reserve / numRecipients).toString()
            )
            const recipientRand = 5
            const faceValue = 10
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)
            // Redeem a winning ticket
            await broker
                .connect(signers[1])
                .redeemWinningTicket(ticket, senderSig, recipientRand)
            // Reserve allocated for recipient should still be 100 since ticket was drawn from deposit
            assert.equal(
                (await broker.claimableReserve(sender, recipient)).toString(),
                "100"
            )
            // Ticket faceValue should be substracted from deposit
            assert.equal(
                (deposit - faceValue).toString(),
                (await broker.getSenderInfo(sender)).sender.deposit.toString()
            )
        })

        it("returns claimable reserve for a claimant when reserve was claimed from", async () => {
            const numRecipients = 10
            const reserve = 1000
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await fixture.bondingManager.setMockUint256(
                functionSig("getTranscoderPoolSize()"),
                numRecipients
            )
            await fixture.bondingManager.setMockBool(
                functionSig("isActiveTranscoder(address)"),
                true
            )
            await broker.fundReserve({value: reserve})

            const recipientRand = 5
            const faceValue = 10
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)
            // Claim winning ticket - will claim from reserve (deposit = 0)
            await broker
                .connect(signers[1])
                .redeemWinningTicket(ticket, senderSig, recipientRand)
            // claimableReserve should be equal to reserve/numRecipients - faceValue
            assert.equal(
                (await broker.claimableReserve(sender, recipient)).toString(),
                (reserve / numRecipients - faceValue).toString()
            )
        })

        it("returns 0 if claimant has claimed all of his claimableReserve", async () => {
            const numRecipients = 10
            await fixture.roundsManager.setMockUint256(
                functionSig("currentRound()"),
                currentRound
            )
            await fixture.bondingManager.setMockUint256(
                functionSig("getTranscoderPoolSize()"),
                numRecipients
            )
            await fixture.bondingManager.setMockBool(
                functionSig("isActiveTranscoder(address)"),
                true
            )
            await broker.fundReserve({value: 1000})

            const recipientRand = 5
            const faceValue = 100
            const ticket = createWinningTicket(
                recipient,
                sender,
                recipientRand,
                faceValue
            )
            const senderSig = await signMsg(getTicketHash(ticket), sender)

            // Claim winning ticket - will freeze reserve (deposit = 0)
            await broker
                .connect(signers[1])
                .redeemWinningTicket(ticket, senderSig, recipientRand)
            assert.equal(
                (await broker.claimableReserve(sender, recipient)).toString(),
                "0"
            )
        })
    })

    describe("getTicketHash", () => {
        it("returns the hash of the ticket", async () => {
            // Check that web3.utils.soliditySHA3() outputs the same value

            let ticket = createTicket()
            let web3TicketHash = getTicketHash(ticket)
            assert.equal(await broker.getTicketHash(ticket), web3TicketHash)

            ticket = createTicket({
                faceValue: 777,
                winProb: 666
            })
            web3TicketHash = getTicketHash(ticket)
            assert.equal(await broker.getTicketHash(ticket), web3TicketHash)
        })
    })
})

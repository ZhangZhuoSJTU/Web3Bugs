import calcTxCost from "../helpers/calcTxCost"

import {deployments, ethers} from "hardhat"

import chai, {expect} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("BroadcasterWithdrawalFlow", () => {
    let signers
    let broadcaster

    let broker
    let minter
    let roundsManager

    const unlockPeriod = 100

    before(async () => {
        signers = await ethers.getSigners()
        broadcaster = signers[0].address
        const fixture = await deployments.fixture(["Contracts"])
        broker = await ethers.getContractAt(
            "TicketBroker",
            fixture.TicketBroker.address
        )
        minter = await ethers.getContractAt("Minter", fixture.Minter.address)
        roundsManager = await ethers.getContractAt(
            "AdjustableRoundsManager",
            fixture.AdjustableRoundsManager.address
        )
        const controller = await ethers.getContractAt(
            "Controller",
            fixture.Controller.address
        )

        await controller.unpause()

        // The reason for this intervention is that fast-forwarding the current default
        // unlockPeriod takes a very long time
        await broker.setUnlockPeriod(unlockPeriod)
    })

    it("broadcaster withdraws deposit and penalty escrow", async () => {
        const deposit = ethers.utils.parseEther("1")
        const reserve = ethers.utils.parseEther("1")

        await broker.fundDeposit({value: deposit})
        await broker.fundReserve({value: reserve})
        const withdrawalAmount = deposit.add(reserve)

        await broker.unlock()
        const unlockPeriod = (await broker.unlockPeriod.call()).toNumber()
        const currentRound = (await roundsManager.currentRound()).toNumber()
        const roundLength = (await roundsManager.roundLength()).toNumber()
        await roundsManager.setBlockNum(
            currentRound * roundLength + unlockPeriod * roundLength
        )

        const startBroadcasterBalance = await ethers.provider.getBalance(
            broadcaster
        )
        const startMinterBalance = await ethers.provider.getBalance(
            minter.address
        )

        const withdrawResult = await broker.withdraw()

        const endMinterBalance = await ethers.provider.getBalance(
            minter.address
        )
        expect(startMinterBalance.sub(endMinterBalance)).to.equal(
            withdrawalAmount
        )

        const txCost = await calcTxCost(withdrawResult)
        const endBroadcasterBalance = await ethers.provider.getBalance(
            broadcaster
        )
        expect(
            endBroadcasterBalance
                .sub(startBroadcasterBalance)
                .add(txCost.toString())
        ).to.equal(withdrawalAmount)
    })
})

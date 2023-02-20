import Fixture from "./helpers/Fixture"

import {web3, ethers} from "hardhat"

import chai, {expect} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("Refunder", () => {
    let fixture
    let signers

    let refunder
    let jobsManager

    before(async () => {
        signers = await ethers.getSigners()
        fixture = new Fixture(web3)

        await fixture.deploy()

        jobsManager = await (
            await ethers.getContractFactory("AlphaJobsManagerMock")
        ).deploy()

        refunder = await (
            await ethers.getContractFactory("Refunder")
        ).deploy(jobsManager.address)
    })

    beforeEach(async () => {
        await fixture.setUp()
    })

    afterEach(async () => {
        await fixture.tearDown()
    })

    describe("constructor", () => {
        it("sets alpha JobsManager", async () => {
            expect(await refunder.alphaJobsManager()).to.equal(
                jobsManager.address
            )
        })
    })

    describe("fallback", () => {
        it("receives ETH", async () => {
            const txRes = await signers[0].sendTransaction({
                to: refunder.address,
                value: 1000
            })
            expect(txRes)
                .to.emit(refunder, "FundsReceived")
                .withArgs(signers[0].address, "1000")

            expect(await ethers.provider.getBalance(refunder.address)).to.equal(
                ethers.BigNumber.from("1000")
            )
        })
    })

    describe("withdraw", () => {
        it("should revert if address does not have a deposit with alpha JobsManager", async () => {
            await expect(
                refunder.withdraw(signers[1].address)
            ).to.be.revertedWith(
                "address does not have a deposit with alpha JobsManager"
            )
        })

        it("should send refund to address", async () => {
            const addr1 = signers[1].address
            const addr2 = signers[2].address

            // Make sure that addresses have not withdrawn
            expect(await refunder.withdrawn(addr1)).to.be.false
            expect(await refunder.withdrawn(addr2)).to.be.false

            // Send funds to refunder
            await signers[0].sendTransaction({
                to: refunder.address,
                value: 1000
            })

            await jobsManager.setBroadcaster(addr1, 700, 99)
            await jobsManager.setBroadcaster(addr2, 300, 99)

            let startRefunderBalance = await ethers.provider.getBalance(
                refunder.address
            )
            const startAddr1Balance = await ethers.provider.getBalance(addr1)

            let txRes = await refunder.withdraw(addr1)
            expect(txRes)
                .to.emit(refunder, "RefundWithdrawn")
                .withArgs(addr1, "700")

            let endRefunderBalance = await ethers.provider.getBalance(
                refunder.address
            )
            const endAddr1Balance = await ethers.provider.getBalance(addr1)

            expect(startRefunderBalance.sub(endRefunderBalance)).to.equal(
                ethers.BigNumber.from("700")
            )
            expect(endAddr1Balance.sub(startAddr1Balance)).to.equal(
                ethers.BigNumber.from("700")
            )

            expect(await refunder.withdrawn(addr1)).to.be.true

            startRefunderBalance = endRefunderBalance
            const startAddr2Balance = await ethers.provider.getBalance(addr2)

            txRes = await refunder.withdraw(addr2)
            expect(txRes)
                .to.emit(refunder, "RefundWithdrawn")
                .withArgs(addr2, "300")

            endRefunderBalance = await ethers.provider.getBalance(
                refunder.address
            )
            const endAddr2Balance = await ethers.provider.getBalance(addr2)

            expect(startRefunderBalance.sub(endRefunderBalance)).to.equal(
                ethers.BigNumber.from("300")
            )
            expect(endAddr2Balance.sub(startAddr2Balance)).to.equal(
                ethers.BigNumber.from("300")
            )
            expect(await refunder.withdrawn(addr2)).to.be.true
        })

        it("should revert if address has withdrawn", async () => {
            const addr1 = signers[1].address

            // Send funds to refunder
            await signers[0].sendTransaction({
                to: refunder.address,
                value: 1000
            })

            await jobsManager.setBroadcaster(addr1, 700, 99)

            await refunder.withdraw(addr1)

            await expect(refunder.withdraw(addr1)).to.be.revertedWith(
                "address has already withdrawn alpha JobsManager refund"
            )
        })
    })
})

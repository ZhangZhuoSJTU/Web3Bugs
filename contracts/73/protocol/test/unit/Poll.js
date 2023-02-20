import Fixture from "./helpers/Fixture"

import {web3, ethers} from "hardhat"

import chai, {expect, assert} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("Poll", () => {
    let fixture
    let poll
    let startBlock
    let endBlock
    let signers

    before(async () => {
        signers = await ethers.getSigners()
        fixture = new Fixture(web3)
    })

    beforeEach(async () => {
        await fixture.setUp()
        startBlock = await fixture.rpc.getBlockNumberAsync()
        endBlock = startBlock + 10
        poll = await (await ethers.getContractFactory("Poll")).deploy(endBlock)
    })

    afterEach(async () => {
        await fixture.tearDown()
    })

    describe("constructor", () => {
        it("initialize state: endBlock", async () => {
            assert.equal((await poll.endBlock()).toNumber(), endBlock)
        })
    })

    describe("vote", () => {
        it("emit \"Vote\" event when poll is active", async () => {
            let tx = poll.vote(0)
            await expect(tx)
                .to.emit(poll, "Vote")
                .withArgs(signers[0].address, 0)
            tx = poll.connect(signers[1]).vote(1)
            await expect(tx)
                .to.emit(poll, "Vote")
                .withArgs(signers[1].address, 1)
        })

        it("revert when poll is inactive", async () => {
            await fixture.rpc.waitUntilBlock(endBlock + 1)
            await expect(poll.vote(0)).to.be.revertedWith("poll is over")
        })
    })

    describe("destroy", () => {
        it("revert when poll is active", async () => {
            await expect(poll.destroy()).to.be.revertedWith("poll is active")
        })

        it("destroy the contract when poll has ended", async () => {
            await fixture.rpc.waitUntilBlock(endBlock + 1)
            const tx = await poll.destroy()
            assert.equal(await web3.eth.getCode(poll.address), "0x")
            assert.equal((await tx.wait()).status, 1)
        })
    })
})

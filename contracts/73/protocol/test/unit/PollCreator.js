import Fixture from "./helpers/Fixture"
import {functionSig} from "../../utils/helpers"
import {web3, ethers} from "hardhat"

import chai, {expect, assert} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

const QUORUM = 333300
const QUOTA = 500000
const POLL_PERIOD = 10 * 5760

describe("PollCreator", () => {
    let fixture
    let token
    let pollCreator

    before(async () => {
        fixture = new Fixture(web3)
        token = await (await ethers.getContractFactory("GenericMock")).deploy()
    })

    beforeEach(async () => {
        await fixture.setUp()
    })

    afterEach(async () => {
        await fixture.tearDown()
    })

    describe("constructor", () => {
        before(async () => {
            pollCreator = await (
                await ethers.getContractFactory("PollCreator")
            ).deploy(token.address)
        })

        it("initialize state: token", async () => {
            assert.equal(await pollCreator.token(), token.address)
        })
    })

    describe("createPoll", () => {
        const hash = "0x1230000000000000000000000000000000000000"

        before(async () => {
            pollCreator = await (
                await ethers.getContractFactory("PollCreator")
            ).deploy(token.address)
        })

        it("revert when not enough tokens approved", async () => {
            await expect(pollCreator.createPoll(hash)).to.be.revertedWith(
                "LivepeerToken transferFrom failed"
            )
        })

        it("creates a poll", async () => {
            await token.setMockBool(
                functionSig("transferFrom(address,address,uint256)"),
                true
            )
            const start = await fixture.rpc.getBlockNumberAsync()
            const end = start + POLL_PERIOD + 1 // + 1 because createPoll tx will mine a new block
            const tx = await pollCreator.createPoll(hash)
            const receipt = await tx.wait()
            await expect(tx.hash)
                .to.emit(pollCreator, "PollCreated")
                .withArgs(receipt.events[0].args[0], hash, end, QUORUM, QUOTA)
        })
    })
})

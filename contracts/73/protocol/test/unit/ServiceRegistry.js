import Fixture from "./helpers/Fixture"
import {web3, ethers} from "hardhat"

import chai, {expect, assert} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("ServiceRegistry", () => {
    let fixture
    let registry
    let signers
    let controller
    before(async () => {
        signers = await ethers.getSigners()
        fixture = new Fixture(web3)
        // Use dummy Controller in these unit tests
        // We are testing the logic of ServiceRegistry directly so we do not
        // interact with the contract via a proxy
        // Thus, we do not need an actual Controller for the tests
        controller = signers[0].address

        registry = await (
            await ethers.getContractFactory("ServiceRegistry")
        ).deploy(controller)
    })

    beforeEach(async () => {
        await fixture.setUp()
    })

    afterEach(async () => {
        await fixture.tearDown()
    })

    describe("constructor", () => {
        it("invokes base Manager contract constructor", async () => {
            assert.equal(
                await registry.controller(),
                controller,
                "wrong Controller address"
            )
        })
    })

    describe("setServiceURI", () => {
        it("stores service URI endpoint for caller", async () => {
            await registry.setServiceURI("foo")
            await registry.connect(signers[1]).setServiceURI("bar")

            assert.equal(
                await registry.getServiceURI(signers[0].address),
                "foo",
                "wrong service URI stored for caller 1"
            )
            assert.equal(
                await registry.getServiceURI(signers[1].address),
                "bar",
                "wrong service URI stored for caller 2"
            )
        })

        it("fires ServiceURIUpdate event", async () => {
            const tx = registry.setServiceURI("foo")
            await expect(tx)
                .to.emit(registry, "ServiceURIUpdate")
                .withArgs(signers[0].address, "foo")
        })
    })

    describe("getServiceURI", () => {
        it("returns service URI endpoint for provided address", async () => {
            await registry.setServiceURI("foo")
            await registry.connect(signers[1]).setServiceURI("bar")

            assert.equal(
                await registry.getServiceURI(signers[0].address),
                "foo",
                "wrong service URI stored for caller 1"
            )
            assert.equal(
                await registry.getServiceURI(signers[1].address),
                "bar",
                "wrong service URI stored for caller 2"
            )
        })

        it("returns empty string for address without stored service URI endpoint", async () => {
            assert.equal(
                await registry.getServiceURI(signers[5].address),
                "",
                "should return empty string for address without service URI"
            )
        })
    })
})

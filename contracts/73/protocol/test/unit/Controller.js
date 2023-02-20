import Fixture from "./helpers/Fixture"
import {contractId} from "../../utils/helpers"
import {web3, ethers} from "hardhat"

import chai, {expect, assert} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("Controller", () => {
    let fixture
    let controller
    let signers
    let commitHash

    before(async () => {
        signers = await ethers.getSigners()
        fixture = new Fixture(web3)
        await fixture.deploy()
        controller = fixture.controller
        commitHash = fixture.commitHash
    })

    beforeEach(async () => {
        await fixture.setUp()
    })

    afterEach(async () => {
        await fixture.tearDown()
    })

    describe("constructor", () => {
        it("should create contract", async () => {
            assert.equal(
                await controller.owner(),
                signers[0].address,
                "did not set owner correctly"
            )
        })
    })

    describe("setContractInfo", () => {
        it("should throw when caller is not the owner", async () => {
            const randomAddress = "0x0000000000000000000000000000000000001234"
            await expect(
                controller
                    .connect(signers[1])
                    .setContractInfo(
                        contractId("Manager"),
                        randomAddress,
                        commitHash
                    )
            ).to.be.reverted
        })

        it("should set contract info", async () => {
            const id = contractId("Manager")
            const managerFac = await ethers.getContractFactory("Manager")
            const manager = await fixture.deployAndRegister(
                managerFac,
                "Manager",
                controller.address
            )

            const cInfo = await controller.getContractInfo(id)
            assert.equal(
                cInfo[0],
                manager.address,
                "did not register contract address correctly"
            )
            assert.equal(
                cInfo[1],
                commitHash,
                "did not register commit hash correctly"
            )
        })
    })

    describe("updateController", () => {
        let id
        let manager

        beforeEach(async () => {
            id = contractId("Manager")
            const managerFac = await ethers.getContractFactory("Manager")
            manager = await fixture.deployAndRegister(
                managerFac,
                "Manager",
                controller.address
            )
        })

        it("should throw when caller is not the owner", async () => {
            const randomAddress = "0x0000000000000000000000000000000000001234"
            await expect(
                controller
                    .connect(signers[1])
                    .updateController(id, randomAddress)
            ).to.be.reverted
        })

        it("should throw for invalid key", async () => {
            const randomAddress = "0x0000000000000000000000000000000000001234"
            const invalidId = "0x1230000000000000000000000000000000000000"
            await expect(controller.updateController(invalidId, randomAddress))
                .to.be.reverted
        })

        it("should update a manager's controller", async () => {
            const randomAddress = "0x0000000000000000000000000000000000001234"
            await controller.updateController(id, randomAddress)

            const newController = await manager.controller()
            assert.equal(
                newController,
                randomAddress,
                "controller for manager incorrect"
            )
        })
    })
})

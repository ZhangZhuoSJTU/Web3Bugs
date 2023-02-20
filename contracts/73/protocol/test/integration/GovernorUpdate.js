import {contractId} from "../../utils/helpers"

import {deployments, ethers} from "hardhat"

import chai, {assert, expect} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("Governor update", () => {
    let controller
    let bondingManager
    let governor
    let minter

    let signers

    before(async () => {
        signers = await ethers.getSigners()
        const fixture = await deployments.fixture(["Contracts"])
        controller = await ethers.getContractAt(
            "Controller",
            fixture.Controller.address
        )
        bondingManager = await ethers.getContractAt(
            "BondingManager",
            fixture.BondingManager.address
        )
        minter = await ethers.getContractAt("Minter", fixture.Minter.address)
        const governorFac = await ethers.getContractFactory("Governor")
        governor = await governorFac.deploy()

        await controller.unpause()
        // Transfer Controller ownership to Governor
        await controller.transferOwnership(governor.address)
    })

    it("controller is now owned by the governor", async () => {
        assert.equal(await controller.owner(), governor.address)
    })

    it("governor has the correct owner", async () => {
        assert.equal(await governor.owner(), signers[0].address)
    })

    describe("single param change", () => {
        it("reverts when the param change is not initiated through the governor", async () => {
            await expect(
                bondingManager.setNumActiveTranscoders(20)
            ).to.be.revertedWith("caller must be Controller owner")
        })

        it("reverts when the delay for the staged update has not expired", async () => {
            const data = await bondingManager.interface.encodeFunctionData(
                "setNumActiveTranscoders",
                [20]
            )
            const update = {
                target: [bondingManager.address],
                value: ["0"],
                data: [data],
                nonce: 0
            }
            await governor.stage(update, 10)

            await expect(governor.execute(update)).to.be.revertedWith(
                "delay for update not expired"
            )
        })

        it("succesfully executes a single param change", async () => {
            const data = await bondingManager.interface.encodeFunctionData(
                "setNumActiveTranscoders",
                [30]
            )
            const update = {
                target: [bondingManager.address],
                value: ["0"],
                data: [data],
                nonce: 0
            }
            await governor.stage(update, 0)

            const tx = governor.execute(update)
            await expect(tx)
                .to.emit(governor, "UpdateExecuted")
                .withArgs([...update])

            assert.equal(
                (await bondingManager.getTranscoderPoolMaxSize()).toNumber(),
                30
            )
        })
    })

    describe("complex update: migrate to new Minter", () => {
        // Minter upgrade steps
        // 1. Pause the protocol
        // 2. call migrateToNewMinter
        // 3. register the new Minter
        // 4. Unpause the protocol
        let newMinter

        let pauseData
        let pauseTarget
        let migrateData
        let migrateTarget
        let setInfoData
        let setInfoTarget
        let unpauseData
        let unpauseTarget

        before(async () => {
            const minterFac = await ethers.getContractFactory("Minter")
            newMinter = await minterFac.deploy(
                controller.address,
                "100",
                "1",
                "500000"
            )

            pauseData = controller.interface.encodeFunctionData("pause", [])
            pauseTarget = controller.address

            migrateData = minter.interface.encodeFunctionData(
                "migrateToNewMinter",
                [newMinter.address]
            )
            migrateTarget = minter.address

            setInfoData = controller.interface.encodeFunctionData(
                "setContractInfo",
                [
                    contractId("Minter"),
                    newMinter.address,
                    "0x3031323334353637383930313233343536373839"
                ]
            )
            setInfoTarget = controller.address

            unpauseData = controller.interface.encodeFunctionData("unpause", [])
            unpauseTarget = controller.address
        })

        it("step 1 'pause' fails: the protocol is already paused", async () => {
            // pause twice
            const update = {
                target: [
                    pauseTarget,
                    pauseTarget,
                    migrateTarget,
                    setInfoTarget,
                    unpauseTarget
                ],
                value: ["0", "0", "0", "0", "0"],
                data: [
                    pauseData,
                    pauseData,
                    migrateData,
                    setInfoData,
                    unpauseData
                ],
                nonce: 0
            }

            // run the migrate to new minter update
            await governor.stage(update, "0")
            await expect(governor.execute(update)).to.be.reverted
        })

        it("step 2 'migrateToNewMinter' fails: the protocol is not paused", async () => {
            // omit pausing from the update
            const update = {
                target: [
                    pauseTarget,
                    unpauseTarget,
                    migrateTarget,
                    setInfoTarget,
                    unpauseTarget
                ],
                value: ["0", "0", "0", "0", "0"],
                data: [
                    pauseData,
                    unpauseData,
                    migrateData,
                    setInfoData,
                    unpauseData
                ],
                nonce: 0
            }

            // run the migrate to new minter update
            await governor.stage(update, "0")
            await expect(governor.execute(update)).to.be.revertedWith(
                "system is not paused"
            )
        })

        it("step 2 'migrateToNewMinter' fails: new Minter cannot be current Minter", async () => {
            // the previous test should have reverted in it's entirety
            // so we should not run into an "already paused" error

            migrateData = minter.interface.encodeFunctionData(
                "migrateToNewMinter",
                [minter.address]
            )

            const update = {
                target: [
                    pauseTarget,
                    migrateTarget,
                    setInfoTarget,
                    unpauseTarget
                ],
                value: ["0", "0", "0", "0"],
                data: [pauseData, migrateData, setInfoData, unpauseData],
                nonce: 0
            }

            // run the migrate to new minter update
            await governor.stage(update, "0")
            await expect(governor.execute(update)).to.be.revertedWith(
                "new Minter cannot be current Minter"
            )
        })

        it("step 2 'migrateToNewMinter' fails: new Minter cannot be null address", async () => {
            migrateData = minter.interface.encodeFunctionData(
                "migrateToNewMinter",
                [ethers.constants.AddressZero]
            )

            const update = {
                target: [
                    pauseTarget,
                    migrateTarget,
                    setInfoTarget,
                    unpauseTarget
                ],
                value: ["0", "0", "0", "0"],
                data: [pauseData, migrateData, setInfoData, unpauseData],
                nonce: 0
            }

            // run the migrate to new minter update
            await governor.stage(update, "0")
            await expect(governor.execute(update)).to.be.revertedWith(
                "new Minter cannot be null address"
            )
        })

        it("step 3 'setContractInfo' fails: wrong target", async () => {
            migrateData = minter.interface.encodeFunctionData(
                "migrateToNewMinter",
                [newMinter.address]
            )

            const update = {
                target: [
                    pauseTarget,
                    migrateTarget,
                    migrateTarget,
                    unpauseTarget
                ],
                value: ["0", "0", "0", "0"],
                data: [pauseData, migrateData, setInfoData, unpauseData],
                nonce: 0
            }

            // run the migrate to new minter update
            await governor.stage(update, "0")
            await expect(governor.execute(update)).to.be.reverted
        })

        it("step 4 'unpause' fails: system is already unpaused", async () => {
            // call unpause twice in the update
            const update = {
                target: [
                    pauseTarget,
                    migrateTarget,
                    setInfoTarget,
                    unpauseTarget,
                    unpauseTarget
                ],
                value: ["0", "0", "0", "0", "0"],
                data: [
                    pauseData,
                    migrateData,
                    setInfoData,
                    unpauseData,
                    unpauseData
                ],
                nonce: 0
            }

            // run the migrate to new minter update
            await governor.stage(update, "0")
            await expect(governor.execute(update)).to.be.reverted
        })

        it("succesfully executes all updates", async () => {
            const update = {
                target: [
                    pauseTarget,
                    migrateTarget,
                    setInfoTarget,
                    unpauseTarget
                ],
                value: ["0", "0", "0", "0"],
                data: [pauseData, migrateData, setInfoData, unpauseData],
                nonce: 0
            }

            // run the migrate to new minter update
            await governor.stage(update, "0")
            await governor.execute(update)

            const actualNewMinterAddr = (
                await controller.getContractInfo(contractId("Minter"))
            )[0]
            assert.equal(actualNewMinterAddr, newMinter.address)
        })
    })
})

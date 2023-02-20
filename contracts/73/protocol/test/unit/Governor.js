import Fixture from "./helpers/Fixture"

import {utils, BigNumber, constants} from "ethers"

import {web3, ethers} from "hardhat"

import chai, {expect, assert} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("Governor", () => {
    let fixture
    let governor
    let setUint256
    let signers

    before(async () => {
        signers = await ethers.getSigners()
        fixture = new Fixture(web3)
        await fixture.deploy()
        const govFac = await ethers.getContractFactory("Governor")
        governor = await govFac.deploy()
        const setUintFac = await ethers.getContractFactory("SetUint256")
        setUint256 = await setUintFac.deploy()
    })

    beforeEach(async () => {
        await fixture.setUp()
    })

    afterEach(async () => {
        await fixture.tearDown()
    })

    const setUint256Tx = async (i, sender) => {
        return setUint256.interface.encodeFunctionData("setUint256", [
            BigNumber.from(i)
        ])
    }

    const getUpdateHash = update => {
        return utils.keccak256(
            utils.defaultAbiCoder.encode(
                [
                    "tuple(address[] target, uint[] value, bytes[] data, uint256 nonce)"
                ],
                [update]
            )
        )
    }

    describe("constructor", () => {
        it("initializes state: owner", async () => {
            assert.equal(await governor.owner(), signers[0].address)
        })
    })

    describe("transferOwnership", () => {
        it("reverts if not called by the contract itself, even if msg.sender is the owner", async () => {
            await expect(
                governor.transferOwnership(signers[1].address)
            ).to.be.revertedWith("unauthorized: msg.sender not Governor")
        })

        it("reverts if the new owner address is the zero-value for the address type", async () => {
            const txData = governor.interface.encodeFunctionData(
                "transferOwnership",
                [constants.AddressZero]
            )
            await governor.stage(
                {
                    target: [governor.address],
                    value: ["0"],
                    data: [txData],
                    nonce: 1
                },
                "0"
            )

            await expect(
                governor.execute({
                    target: [governor.address],
                    value: ["0"],
                    data: [txData],
                    nonce: 1
                })
            ).to.be.revertedWith("newOwner is a null address")
        })

        it("updates ownership to a new owner", async () => {
            const txData = governor.interface.encodeFunctionData(
                "transferOwnership",
                [signers[1].address]
            )
            await governor.stage(
                {
                    target: [governor.address],
                    value: ["0"],
                    data: [txData],
                    nonce: 1
                },
                "0"
            )

            const tx = governor.execute({
                target: [governor.address],
                value: ["0"],
                data: [txData],
                nonce: 1
            })

            await expect(tx)
                .to.emit(governor, "OwnershipTransferred")
                .withArgs(signers[0].address, signers[1].address)
            assert.equal(await governor.owner(), signers[1].address)
        })
    })

    describe("stageUpdate", () => {
        it("reverts when sender is not owner", async () => {
            const data = await setUint256Tx("0", signers[0].address)

            await expect(
                governor.connect(signers[1]).stage(
                    {
                        target: [setUint256.address],
                        value: ["0"],
                        data: [data],
                        nonce: 1
                    },
                    "0"
                )
            ).to.be.revertedWith("unauthorized: msg.sender not owner")
        })

        it("reverts when an update is already staged", async () => {
            // stage an update
            const data = await setUint256Tx("1", signers[0].address)

            await governor.stage(
                {
                    target: [setUint256.address],
                    value: ["0"],
                    data: [data],
                    nonce: 1
                },
                "5"
            )

            // try staging the same update (same hash)
            await expect(
                governor.stage(
                    {
                        target: [setUint256.address],
                        value: ["0"],
                        data: [data],
                        nonce: 1
                    },
                    "5"
                )
            ).to.be.revertedWith("update already staged")
        })

        it("reverts when the current block number added by the delay overflows", async () => {
            const data = await setUint256Tx("1", signers[0].address)

            await fixture.rpc.mine()

            await expect(
                governor.stage(
                    {
                        target: [setUint256.address],
                        value: ["0"],
                        data: [data],
                        nonce: 1
                    },
                    constants.MaxUint256
                )
            ).to.be.reverted
        })

        it("stage emits an UpdateStaged event", async () => {
            const data = await setUint256Tx("1", signers[0].address)
            const update = {
                target: [setUint256.address],
                value: ["0"],
                data: [data],
                nonce: 1
            }

            const updateHash = getUpdateHash(update)
            const blockNum = await fixture.rpc.getBlockNumberAsync()

            const tx = governor.stage(update, "5")

            await expect(tx)
                .to.emit(governor, "UpdateStaged")
                .withArgs([...update], 5)
            assert.equal(
                (await governor.updates(updateHash)).toNumber(),
                blockNum + 5 + 1
            ) // + 1 because stage() mines a block
        })
    })

    describe("batch stageUpdate", () => {
        it("reverts when sender is not owner", async () => {
            const data0 = await setUint256Tx("0", signers[0].address)
            const data1 = await setUint256Tx("1", signers[0].address)
            const data2 = await setUint256Tx("5", signers[0].address)

            await expect(
                governor.connect(signers[1]).stage(
                    {
                        target: [
                            setUint256.address,
                            setUint256.address,
                            setUint256.address
                        ],
                        value: ["0", "0", "0"],
                        data: [data0, data1, data2],
                        nonce: 1
                    },
                    "0"
                )
            ).to.be.revertedWith("unauthorized: msg.sender not owner")
        })

        it("reverts when an update is already staged", async () => {
            // stage a batch update
            const data0 = await setUint256Tx("0", signers[0].address)
            const data1 = await setUint256Tx("1", signers[0].address)
            const data2 = await setUint256Tx("5", signers[0].address)
            await governor.stage(
                {
                    target: [
                        setUint256.address,
                        setUint256.address,
                        setUint256.address
                    ],
                    value: ["0", "0", "0"],
                    data: [data0, data1, data2],
                    nonce: 1
                },
                "0"
            )

            // try staging the same batch update
            await expect(
                governor.stage(
                    {
                        target: [
                            setUint256.address,
                            setUint256.address,
                            setUint256.address
                        ],
                        value: ["0", "0", "0"],
                        data: [data0, data1, data2],
                        nonce: 1
                    },
                    "0"
                )
            ).to.be.revertedWith("update already staged")
        })

        it("stage emits an UpdateStaged event", async () => {
            const data0 = await setUint256Tx("0", signers[0].address)
            const data1 = await setUint256Tx("1", signers[0].address)
            const data2 = await setUint256Tx("5", signers[0].address)

            const update = {
                target: [
                    setUint256.address,
                    setUint256.address,
                    setUint256.address
                ],
                value: ["0", "0", "0"],
                data: [data0, data1, data2],
                nonce: 1
            }

            const updateHash = getUpdateHash(update)
            const blockNum = await fixture.rpc.getBlockNumberAsync()

            const tx = governor.stage(update, "5")

            await expect(tx)
                .to.emit(governor, "UpdateStaged")
                .withArgs([...update], 5)
            assert.equal(
                (await governor.updates(updateHash)).toNumber(),
                blockNum + 5 + 1
            ) // + 1 because stage() mines a block
        })
    })

    describe("cancelUpdate", async () => {
        it("reverts when msg.sender is not the owner", async () => {
            const data = await setUint256Tx("1", signers[0].address)

            await expect(
                governor.connect(signers[1]).cancel({
                    target: [setUint256.address],
                    value: ["0"],
                    data: [data],
                    nonce: 1
                })
            ).to.be.revertedWith("unauthorized: msg.sender not owner")
        })

        it("reverts when an update is not staged", async () => {
            const data = await setUint256Tx("1", signers[0].address)

            await expect(
                governor.cancel({
                    target: [setUint256.address],
                    value: ["0"],
                    data: [data],
                    nonce: 1
                })
            ).to.be.revertedWith("update is not staged")
        })

        it("cancels a staged update", async () => {
            const data = await setUint256Tx("1", signers[0].address)
            const update = {
                target: [setUint256.address],
                value: ["0"],
                data: [data],
                nonce: 1
            }
            const updateHash = getUpdateHash(update)
            const blockNum = await fixture.rpc.getBlockNumberAsync()

            let tx = governor.stage(update, "5")

            await expect(tx)
                .to.emit(governor, "UpdateStaged")
                .withArgs([...update], 5)
            assert.equal(
                (await governor.updates(updateHash)).toNumber(),
                blockNum + 5 + 1
            ) // + 1 because stage() mines a block

            tx = governor.cancel(update)

            await expect(tx)
                .to.emit(governor, "UpdateCancelled")
                .withArgs([...update])
            assert.equal((await governor.updates(updateHash)).toNumber(), 0)
        })
    })

    describe("batch cancelUpdate", async () => {
        it("reverts when msg.sender is not the owner", async () => {
            const data0 = await setUint256Tx("0", signers[0].address)
            const data1 = await setUint256Tx("1", signers[0].address)
            const data2 = await setUint256Tx("5", signers[0].address)

            await expect(
                governor.connect(signers[1]).cancel({
                    target: [
                        setUint256.address,
                        setUint256.address,
                        setUint256.address
                    ],
                    value: ["0", "0", "0"],
                    data: [data0, data1, data2],
                    nonce: 1
                })
            ).to.be.revertedWith("unauthorized: msg.sender not owner")
        })

        it("reverts when an update is not staged", async () => {
            const data0 = await setUint256Tx("0", signers[0].address)
            const data1 = await setUint256Tx("1", signers[0].address)
            const data2 = await setUint256Tx("5", signers[0].address)
            await expect(
                governor.cancel({
                    target: [
                        setUint256.address,
                        setUint256.address,
                        setUint256.address
                    ],
                    value: ["0", "0", "0"],
                    data: [data0, data1, data2],
                    nonce: 1
                })
            ).to.be.revertedWith("update is not staged")
        })

        it("cancels a batch of staged updates", async () => {
            const data0 = await setUint256Tx("0", signers[0].address)
            const data1 = await setUint256Tx("1", signers[0].address)
            const data2 = await setUint256Tx("5", signers[0].address)

            const update = {
                target: [
                    setUint256.address,
                    setUint256.address,
                    setUint256.address
                ],
                value: ["0", "0", "0"],
                data: [data0, data1, data2],
                nonce: 1
            }

            const updateHash = getUpdateHash(update)
            const blockNum = await fixture.rpc.getBlockNumberAsync()

            let tx = governor.stage(update, "5")

            await expect(tx)
                .to.emit(governor, "UpdateStaged")
                .withArgs([...update], 5)
            assert.equal(
                (await governor.updates(updateHash)).toNumber(),
                blockNum + 5 + 1
            ) // + 1 because stage() mines a block

            tx = governor.cancel(update)

            await expect(tx)
                .to.emit(governor, "UpdateCancelled")
                .withArgs([...update])
            assert.equal((await governor.updates(updateHash)).toNumber(), 0)
        })
    })

    describe("executeUpdate", () => {
        it("reverts when the update has not been staged", async () => {
            const data = await setUint256Tx("1", signers[0].address)

            await expect(
                governor.execute({
                    target: [setUint256.address],
                    value: ["0"],
                    data: [data],
                    nonce: 1
                })
            ).to.be.revertedWith("update is not staged")
        })

        it("reverts when delay for the staged update has not expired", async () => {
            const data = await setUint256Tx("1", signers[0].address)

            await governor.stage(
                {
                    target: [setUint256.address],
                    value: ["0"],
                    data: [data],
                    nonce: 1
                },
                "100"
            )

            await expect(
                governor.execute({
                    target: [setUint256.address],
                    value: ["0"],
                    data: [data],
                    nonce: 1
                })
            ).to.be.revertedWith("delay for update not expired")
        })

        it("reverts when one of the remote calls in the batch fails", async () => {
            const data = await setUint256Tx("1", signers[0].address)

            await governor.stage(
                {
                    target: [setUint256.address],
                    value: ["0"],
                    data: [data],
                    nonce: 1
                },
                "100"
            )

            await setUint256.setShouldFail(true)

            await fixture.rpc.wait(101)

            // test forwarded revert reason
            await expect(
                governor.execute({
                    target: [setUint256.address],
                    value: ["0"],
                    data: [data],
                    nonce: 1
                })
            ).to.be.revertedWith("I should fail")
        })

        it("executes an update: delete the update and emit an UpdateExecuted event", async () => {
            const data = await setUint256Tx("1", signers[0].address)
            const update = {
                target: [setUint256.address],
                value: ["1000"],
                data: [data],
                nonce: 1
            }
            const updateHash = getUpdateHash(update)

            await governor.stage(update, "100")

            await fixture.rpc.wait(100)

            const tx = governor
                .connect(signers[0])
                .execute(update, {value: BigNumber.from("1000")})

            await expect(tx)
                .to.emit(governor, "UpdateExecuted")
                .withArgs([...update])
            assert.equal((await governor.updates(updateHash)).toNumber(), 0)

            // check that ETH balance of target is updated
            assert.equal(
                (await web3.eth.getBalance(update.target[0])).toString(),
                update.value[0]
            )
        })
    })

    describe("batch executeUpdate", () => {
        it("reverts when the update has not been staged", async () => {
            const data0 = await setUint256Tx("0", signers[0].address)
            const data1 = await setUint256Tx("1", signers[0].address)
            const data2 = await setUint256Tx("5", signers[0].address)

            // stage the update partially
            await governor.stage(
                {
                    target: [setUint256.address],
                    value: ["0"],
                    data: [data0],
                    nonce: 1
                },
                "100"
            )

            await expect(
                governor.execute({
                    target: [
                        setUint256.address,
                        setUint256.address,
                        setUint256.address
                    ],
                    value: ["0", "0", "0"],
                    data: [data0, data1, data2],
                    nonce: 1
                })
            ).to.be.revertedWith("update is not staged")
        })

        it("reverts when delay for the staged update has not expired", async () => {
            const data0 = await setUint256Tx("0", signers[0].address)
            const data1 = await setUint256Tx("1", signers[0].address)
            const data2 = await setUint256Tx("5", signers[0].address)

            const update = {
                target: [
                    setUint256.address,
                    setUint256.address,
                    setUint256.address
                ],
                value: ["0", "0", "0"],
                data: [data0, data1, data2],
                nonce: 1
            }

            await governor.stage(update, "100")

            await expect(governor.execute(update)).to.be.revertedWith(
                "delay for update not expired"
            )
        })

        it("reverts when one of the remote calls in the batch fails", async () => {
            const data0 = await setUint256Tx("0", signers[0].address)
            const data1 = await setUint256Tx("1", signers[0].address)
            const data2 = await setUint256Tx("5", signers[0].address)

            const update = {
                target: [
                    setUint256.address,
                    setUint256.address,
                    setUint256.address
                ],
                value: ["0", "0", "0"],
                data: [data0, data1, data2],
                nonce: 1
            }

            await governor.stage(update, "100")

            await setUint256.setShouldFail(true)

            await fixture.rpc.wait(101)

            // test forwarded revert reason
            await expect(governor.execute(update)).to.be.revertedWith(
                "I should fail"
            )
        })

        it("executes an update: delete the update and emit an UpdateExecuted event", async () => {
            const data0 = await setUint256Tx("0", signers[0].address)
            const data1 = await setUint256Tx("1", signers[0].address)
            const data2 = await setUint256Tx("5", signers[0].address)

            const update = {
                target: [
                    setUint256.address,
                    setUint256.address,
                    setUint256.address
                ],
                value: ["0", "0", "0"],
                data: [data0, data1, data2],
                nonce: 1
            }
            const updateHash = getUpdateHash(update)

            await governor.stage(update, "100")

            await fixture.rpc.wait(100)

            const tx = governor.execute(update)

            await expect(tx)
                .to.emit(governor, "UpdateExecuted")
                .withArgs([...update])
            assert.equal(await governor.updates(updateHash), 0)
        })
    })
})

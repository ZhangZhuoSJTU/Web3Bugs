import Fixture from "./helpers/Fixture"
import {contractId} from "../../utils/helpers"
import {toBuffer, bufferToHex} from "ethereumjs-util"
import ethAbi from "ethereumjs-abi"

import {web3, ethers} from "hardhat"

import chai, {expect, assert} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("ManagerProxy", () => {
    let fixture
    let managerProxy
    let managerProxyFac
    let signers

    describe("constructor", () => {
        it("should create contract", async () => {
            const targetContractId = contractId("ManagerProxyTarget")
            const proxy = await managerProxyFac.deploy(
                signers[0].address,
                targetContractId
            )

            assert.equal(
                await proxy.controller(),
                signers[0].address,
                "should set Controller address"
            )
            assert.equal(
                await proxy.targetContractId(),
                targetContractId,
                "should set target contract ID"
            )
        })
    })

    before(async () => {
        signers = await ethers.getSigners()
        fixture = new Fixture(web3)
        await fixture.deploy()
        await fixture.deployAndRegister(
            await ethers.getContractFactory("ManagerProxyTargetMockV1"),
            "ManagerProxyTarget",
            fixture.controller.address
        )

        managerProxyFac = await ethers.getContractFactory("ManagerProxy")
        const proxy = await managerProxyFac.deploy(
            fixture.controller.address,
            contractId("ManagerProxyTarget")
        )
        managerProxy = await ethers.getContractAt(
            "ManagerProxyTargetMockV1",
            proxy.address
        )
    })

    beforeEach(async () => {
        await fixture.setUp()
    })

    afterEach(async () => {
        await fixture.tearDown()
    })

    describe("fallback function", () => {
        it("should fail if there is no valid contract address registered with the Controller for the target contract ID", async () => {
            const newProxy = await managerProxyFac.deploy(
                fixture.controller.address,
                contractId("foo")
            )
            const target = await ethers.getContractAt(
                "ManagerProxyTargetMockV1",
                newProxy.address
            )

            await expect(target.setUint64(5)).to.be.reverted
        })

        describe("setting and getting uint8", () => {
            it("should set a uint8", async () => {
                await managerProxy.setUint8(4)

                const value = await managerProxy.uint8Value()
                assert.equal(value, 4, "uint8 value incorrect")
            })
        })

        describe("setting and getting uint64", () => {
            it("should set a uint64", async () => {
                await managerProxy.setUint64(5)

                const value = await managerProxy.uint64Value()
                assert.equal(value, 5, "uint64 value incorrect")
            })
        })

        describe("setting and getting uint256", () => {
            it("should set a uint256", async () => {
                await managerProxy.setUint256(6)

                const value = await managerProxy.uint256Value()
                assert.equal(value, 6, "uint256 value incorrect")
            })
        })

        describe("setting and getting bytes32", () => {
            const hash = web3.utils.sha3("hello")

            it("should set a bytes32", async () => {
                await managerProxy.setBytes32(hash)

                const value = await managerProxy.bytes32Value()
                assert.equal(value, hash, "bytes32 value incorrect")
            })
        })

        describe("setting and getting address", () => {
            it("should set an address", async () => {
                const addr = signers[1].address
                await managerProxy.setAddress(addr)

                const value = await managerProxy.addressValue()
                assert.equal(value, addr, "address value incorrect")
            })
        })

        describe("setting and getting string", () => {
            const str = "hello"

            it("should set a string", async () => {
                await managerProxy.setString(str)

                const value = await managerProxy.stringValue()
                assert.equal(value, str, "string value incorrect")
            })
        })

        describe("setting and getting bytes", () => {
            const h = web3.utils.sha3("hello")

            it("should set a bytes", async () => {
                await managerProxy.setBytes(h)

                const value = await managerProxy.bytesValue()
                assert.equal(value, h, "bytes value incorrect")
            })
        })

        describe("setting and getting a tuple", () => {
            const v1 = 5
            const v2 = 6
            const v3 = web3.utils.sha3("hello")

            it("should set a tuple", async () => {
                await managerProxy.setTuple(v1, v2, v3)

                const values = await managerProxy.getTuple()
                assert.equal(values[0], v1, "tuple value 1 incorrect")
                assert.equal(values[1], v2, "tuple value 2 incorrect")
                assert.equal(values[2], v3, "tuple value 3 incorrect")
            })
        })
    })

    describe("non-storage upgrade", () => {
        beforeEach(async () => {
            await managerProxy.setUint8(4)
            await managerProxy.setUint64(5)
            await managerProxy.setUint256(6)
            await managerProxy.setBytes32(web3.utils.sha3("hello"))
            await managerProxy.setAddress(signers[1].address)
        })

        it("should preserve state in proxy contract", async () => {
            await fixture.deployAndRegister(
                await ethers.getContractFactory("ManagerProxyTargetMockV2"),
                "ManagerProxyTarget",
                fixture.controller.address
            )

            const uint8Value = await managerProxy.uint8Value()
            assert.equal(uint8Value, 4, "uint8 value incorrect")
            const uint64Value = await managerProxy.uint64Value()
            assert.equal(uint64Value, 5, "uint64 value incorrect")
            const uint256Value = await managerProxy.uint256Value()
            assert.equal(uint256Value, 6, "uint256 value incorrect")
            const bytes32Value = await managerProxy.bytes32Value()
            assert.equal(
                bytes32Value,
                web3.utils.sha3("hello"),
                "bytes32 value incorrect"
            )
            const addressValue = await managerProxy.addressValue()
            assert.equal(
                addressValue,
                signers[1].address,
                "address value incorrect"
            )
        })

        it("should set a uint8 and add 5", async () => {
            await fixture.deployAndRegister(
                await ethers.getContractFactory("ManagerProxyTargetMockV2"),
                "ManagerProxyTarget",
                fixture.controller.address
            )
            await managerProxy.setUint8(10)

            const value = await managerProxy.uint8Value()
            assert.equal(value, 10 + 5, "uint8 value incorrect")
        })

        it("should set a uint64 and add 5", async () => {
            await fixture.deployAndRegister(
                await ethers.getContractFactory("ManagerProxyTargetMockV2"),
                "ManagerProxyTarget",
                fixture.controller.address
            )
            await managerProxy.setUint64(10)

            const value = await managerProxy.uint64Value()
            assert.equal(value, 10 + 5, "uint64 value incorrect")
        })

        it("should set a uint256 and add 5", async () => {
            await fixture.deployAndRegister(
                await ethers.getContractFactory("ManagerProxyTargetMockV2"),
                "ManagerProxyTarget",
                fixture.controller.address
            )
            await managerProxy.setUint256(10)

            const value = await managerProxy.uint256Value()
            assert.equal(value, 10 + 5, "uint256 value incorrect")
        })

        it("should set a hashed bytes32", async () => {
            await fixture.deployAndRegister(
                await ethers.getContractFactory("ManagerProxyTargetMockV2"),
                "ManagerProxyTarget",
                fixture.controller.address
            )
            await managerProxy.setBytes32(web3.utils.sha3("bye"))

            const value = await managerProxy.bytes32Value()
            assert.equal(
                value,
                bufferToHex(
                    ethAbi.soliditySHA3(
                        ["bytes"],
                        [toBuffer(web3.utils.sha3("bye"))]
                    )
                ),
                "bytes32 value incorrect"
            )
        })

        it("should set a null address", async () => {
            await fixture.deployAndRegister(
                await ethers.getContractFactory("ManagerProxyTargetMockV2"),
                "ManagerProxyTarget",
                fixture.controller.address
            )
            await managerProxy.setAddress(signers[1].address)

            const value = await managerProxy.addressValue()
            assert.equal(
                value,
                "0x0000000000000000000000000000000000000000",
                "address value incorrect"
            )
        })
    })

    describe("storage upgrade with superset of original storage variables", () => {
        beforeEach(async () => {
            await managerProxy.setUint8(4)
            await managerProxy.setUint64(5)
            await managerProxy.setUint256(6)
            await managerProxy.setBytes32(web3.utils.sha3("hello"))
            await managerProxy.setAddress(signers[1].address)
        })

        it("should set a key value pair in mapping", async () => {
            await fixture.deployAndRegister(
                await ethers.getContractFactory("ManagerProxyTargetMockV3"),
                "ManagerProxyTarget",
                fixture.controller.address
            )
            // Need new contract binding since we added a new method
            const managerProxyV3 = await ethers.getContractAt(
                "ManagerProxyTargetMockV3",
                managerProxy.address
            )

            await managerProxyV3.setKv(5, 6)

            const value = await managerProxyV3.kvMap(5)
            assert.equal(value, 6, "value for key incorrect")
        })

        it("should preserve old state in proxy contract after an update to a new storage variable", async () => {
            await fixture.deployAndRegister(
                await ethers.getContractFactory("ManagerProxyTargetMockV3"),
                "ManagerProxyTarget",
                fixture.controller.address
            )
            // Need new contract binding since we added a new method
            const managerProxyV3 = await ethers.getContractAt(
                "ManagerProxyTargetMockV3",
                managerProxy.address
            )
            await managerProxyV3.setKv(5, 6)

            const uint8Value = await managerProxy.uint8Value()
            assert.equal(uint8Value, 4, "uint8 value incorrect")
            const uint64Value = await managerProxy.uint64Value()
            assert.equal(uint64Value, 5, "uint64 value incorrect")
            const uint256Value = await managerProxy.uint256Value()
            assert.equal(uint256Value, 6, "uint256 value incorrect")
            const bytes32Value = await managerProxy.bytes32Value()
            assert.equal(
                bytes32Value,
                web3.utils.sha3("hello"),
                "bytes32 value incorrect"
            )
            const addressValue = await managerProxy.addressValue()
            assert.equal(
                addressValue,
                signers[1].address,
                "address value incorrect"
            )
        })
    })
})

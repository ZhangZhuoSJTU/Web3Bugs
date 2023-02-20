import Fixture from "./helpers/Fixture"
import {constants} from "../../utils/constants"
import {
    contractId,
    functionSig,
    functionEncodedABI
} from "../../utils/helpers"

import {web3, ethers} from "hardhat"
const BigNumber = ethers.BigNumber
import chai, {expect, assert} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("Minter", () => {
    let fixture
    let minter
    let minterFac
    let signers
    const PERC_DIVISOR = 1000000000
    const PERC_MULTIPLIER = PERC_DIVISOR / 100

    const INFLATION = 26 * PERC_MULTIPLIER
    const INFLATION_CHANGE = 0.02 * PERC_MULTIPLIER
    const TARGET_BONDING_RATE = 50 * PERC_MULTIPLIER

    before(async () => {
        signers = await ethers.getSigners()
        minterFac = await ethers.getContractFactory("Minter")
    })
    describe("constructor", () => {
        it("should fail if provided inflation is invalid percentage > 100%", async () => {
            await expect(
                minterFac.deploy(
                    signers[0].address,
                    PERC_DIVISOR + 1,
                    INFLATION_CHANGE,
                    TARGET_BONDING_RATE
                )
            ).to.be.revertedWith("_inflation is invalid percentage")
        })

        it("should fail if provided inflationChange is invalid percentage > 100%", async () => {
            await expect(
                minterFac.deploy(
                    signers[0].address,
                    INFLATION,
                    PERC_DIVISOR + 1,
                    TARGET_BONDING_RATE
                )
            ).to.be.revertedWith("_inflationChange is invalid percentage")
        })

        it("should fail if provided targetBondingRate is invalid percentage > 100%", async () => {
            await expect(
                minterFac.deploy(
                    signers[0].address,
                    INFLATION,
                    INFLATION_CHANGE,
                    PERC_DIVISOR + 1
                )
            ).to.be.revertedWith("_targetBondingRate is invalid percentage")
        })

        it("should create contract", async () => {
            const minter = await minterFac.deploy(
                signers[0].address,
                INFLATION,
                INFLATION_CHANGE,
                TARGET_BONDING_RATE
            )

            assert.equal(
                await minter.controller(),
                signers[0].address,
                "should set Controller address"
            )
            assert.equal(
                await minter.inflation(),
                INFLATION,
                "should set inflation"
            )
            assert.equal(
                await minter.inflationChange(),
                INFLATION_CHANGE,
                "should set inflationChange"
            )
            assert.equal(
                await minter.targetBondingRate(),
                TARGET_BONDING_RATE,
                "should set targetBondingRate"
            )
        })
    })

    before(async () => {
        fixture = new Fixture(web3)
        await fixture.deploy()

        minter = await fixture.deployAndRegister(
            minterFac,
            "Minter",
            fixture.controller.address,
            INFLATION,
            INFLATION_CHANGE,
            TARGET_BONDING_RATE
        )
    })

    beforeEach(async () => {
        await fixture.setUp()
    })

    afterEach(async () => {
        await fixture.tearDown()
    })

    describe("setTargetBondingRate", () => {
        it("should fail if caller is not Controller owner", async () => {
            await expect(minter.connect(signers[1]).setTargetBondingRate(10)).to
                .be.reverted
        })

        it("should fail if provided targetBondingRate is not a valid percentage", async () => {
            await expect(
                minter.setTargetBondingRate(PERC_DIVISOR + 1)
            ).to.be.revertedWith("_targetBondingRate is invalid percentage")
        })

        it("should set targetBondingRate", async () => {
            await minter.setTargetBondingRate(10)

            assert.equal(
                await minter.targetBondingRate(),
                10,
                "wrong targetBondingRate"
            )
        })
    })

    describe("setInflationChange", () => {
        it("should fail if caller is not Controller owner", async () => {
            await expect(minter.connect(signers[1]).setInflationChange(5)).to.be
                .reverted
        })

        it("should fail if provided inflationChange is not a valid percentage", async () => {
            await expect(
                minter.setInflationChange(PERC_DIVISOR + 1)
            ).to.be.revertedWith("_inflationChange is invalid percentage")
        })

        it("should set inflationChange", async () => {
            await minter.setInflationChange(5)

            assert.equal(
                await minter.inflationChange(),
                5,
                "wrong inflationChange"
            )
        })
    })

    describe("migrateToNewMinter", () => {
        it("should fail if caller is not Controller owner", async () => {
            await fixture.controller.pause()
            await expect(
                minter
                    .connect(signers[1])
                    .migrateToNewMinter(signers[1].address)
            ).to.be.reverted
        })

        it("should fail if the system is not paused", async () => {
            await expect(minter.migrateToNewMinter(signers[1].address)).to.be
                .reverted
        })

        it("should fail if provided new minter is the current minter", async () => {
            await fixture.controller.pause()
            await expect(
                minter.migrateToNewMinter(minter.address)
            ).to.be.revertedWith("new Minter cannot be current Minter")
        })

        it("should fail if provided new minter is null address", async () => {
            await fixture.controller.pause()
            await expect(
                minter.migrateToNewMinter(constants.NULL_ADDRESS)
            ).to.be.revertedWith("new Minter cannot be null address")
        })

        it("should fail if provided new minter does not have a getController() function", async () => {
            await fixture.controller.pause()
            await expect(minter.migrateToNewMinter(signers[1].address)).to.be
                .reverted
        })

        it("should fail if provided new minter has a different controller", async () => {
            await fixture.controller.pause()
            const newMinter = await (
                await ethers.getContractFactory("GenericMock")
            ).deploy()
            await newMinter.setMockAddress(
                functionSig("getController()"),
                signers[1].address
            )

            await expect(
                minter.migrateToNewMinter(newMinter.address)
            ).to.be.revertedWith(
                "new Minter Controller must be current Controller"
            )
        })

        it("should fail if provided new minter's controller does not have current minter registered", async () => {
            await fixture.controller.pause()

            const newMinter = await (
                await ethers.getContractFactory("GenericMock")
            ).deploy()
            const controllerAddr = await minter.controller()
            await newMinter.setMockAddress(
                functionSig("getController()"),
                controllerAddr
            )
            await fixture.controller.setContractInfo(
                contractId("Minter"),
                signers[1].address,
                fixture.commitHash
            )

            await expect(
                minter.migrateToNewMinter(newMinter.address)
            ).to.be.revertedWith("new Minter must be registered")
        })

        it("should transfer ownership of the token, current token balance and current ETH balance to new minter", async () => {
            await fixture.ticketBroker
                .connect(signers[1])
                .execute(minter.address, functionSig("depositETH()"), {
                    value: 100
                })

            const newMinter = await (
                await ethers.getContractFactory("GenericMock")
            ).deploy()
            const controllerAddr = await minter.controller()
            await newMinter.setMockAddress(
                functionSig("getController()"),
                controllerAddr
            )
            await fixture.controller.pause()

            // Just make sure token ownership and token balance transfer do not fail
            await minter.migrateToNewMinter(newMinter.address)

            assert.equal(
                await web3.eth.getBalance(newMinter.address),
                100,
                "wrong new minter balance"
            )
            assert.equal(
                await web3.eth.getBalance(minter.address),
                0,
                "wrong old minter balance"
            )
        })
    })

    describe("createReward", () => {
        beforeEach(async () => {
            // Set current supply
            await fixture.token.setMockUint256(
                functionSig("totalSupply()"),
                1000
            )
            // Set current reward tokens
            await fixture.roundsManager.execute(
                minter.address,
                functionSig("setCurrentRewardTokens()")
            )
        })

        it("should fail if caller is not BondingManager", async () => {
            await expect(minter.createReward(10, 100)).to.be.revertedWith(
                "msg.sender not BondingManager"
            )
        })

        it("should fail if Controller is paused", async () => {
            await fixture.controller.pause()

            await expect(
                fixture.bondingManager.execute(
                    minter.address,
                    functionEncodedABI(
                        "createReward(uint256,uint256)",
                        ["uint256", "uint256"],
                        [10, 100]
                    )
                )
            ).to.be.reverted
        })

        it("should update currentMintedTokens with computed reward", async () => {
            // Set up reward call via BondingManager
            await fixture.bondingManager.execute(
                minter.address,
                functionEncodedABI(
                    "createReward(uint256,uint256)",
                    ["uint256", "uint256"],
                    [10, 100]
                )
            )
            const currentMintableTokens = await minter.currentMintableTokens()
            const expCurrentMintedTokens = Math.floor(
                (currentMintableTokens.toNumber() *
                    Math.floor((10 * PERC_DIVISOR) / 100)) /
                    PERC_DIVISOR
            )

            const currentMintedTokens = await minter.currentMintedTokens()
            assert.equal(
                currentMintedTokens,
                expCurrentMintedTokens,
                "wrong currentMintedTokens"
            )
        })

        it("should compute reward correctly for fraction = 1", async () => {
            // Set up reward call via BondingManager
            await fixture.bondingManager.execute(
                minter.address,
                functionEncodedABI(
                    "createReward(uint256,uint256)",
                    ["uint256", "uint256"],
                    [100, 100]
                )
            )
            const currentMintableTokens = await minter.currentMintableTokens()
            const expCurrentMintedTokens = Math.floor(
                (currentMintableTokens.toNumber() *
                    Math.floor((100 * PERC_DIVISOR) / 100)) /
                    PERC_DIVISOR
            )

            const currentMintedTokens = await minter.currentMintedTokens()
            assert.equal(
                currentMintedTokens.toNumber(),
                expCurrentMintedTokens,
                "wrong currentMintedTokens"
            )
        })

        it("should compute reward correctly for large fraction = 1", async () => {
            // If we compute the output of createReward as: (mintedTokens * fracNum) / fracDenom where all the values are bigAmount
            // we would overflow when we try to to do mintedTokens * fracNum
            // Instead we compute the output of createReward as: (mintedTokens * ((fracNum * PERC_DIVISOR) / fracDenom)) / PERC_DIVISOR
            // fracNum * PERC_DIVISOR has less of a chance of overflowing since PERC_DIVISOR is bounded in magnitude

            const bigAmount = BigNumber.from(
                "10000000000000000000000000000000000000000000000"
            )
            // Set up reward call via BondingManager
            await fixture.bondingManager.execute(
                minter.address,
                functionEncodedABI(
                    "createReward(uint256,uint256)",
                    ["uint256", "uint256"],
                    [bigAmount.toString(), bigAmount.toString()]
                )
            )
            const currentMintableTokens = await minter.currentMintableTokens()
            const expCurrentMintedTokens = BigNumber.from(
                currentMintableTokens.toString()
            )
                .mul(bigAmount.mul(BigNumber.from(PERC_DIVISOR)).div(bigAmount))
                .div(BigNumber.from(PERC_DIVISOR))
                .toNumber()

            const currentMintedTokens = await minter.currentMintedTokens()
            assert.equal(
                currentMintedTokens,
                expCurrentMintedTokens,
                "wrong currentMintedTokens"
            )
        })

        it("should compute rewards correctly for multiple valid calls", async () => {
            // Set up reward call via BondingManager
            await fixture.bondingManager.execute(
                minter.address,
                functionEncodedABI(
                    "createReward(uint256,uint256)",
                    ["uint256", "uint256"],
                    [10, 100]
                )
            )
            // Set up second reward call via BondingManager
            await fixture.bondingManager.execute(
                minter.address,
                functionEncodedABI(
                    "createReward(uint256,uint256)",
                    ["uint256", "uint256"],
                    [20, 100]
                )
            )

            const currentMintableTokens = await minter.currentMintableTokens()
            const expMintedTokens0 = Math.floor(
                (currentMintableTokens.toNumber() *
                    Math.floor((10 * PERC_DIVISOR) / 100)) /
                    PERC_DIVISOR
            )
            const expMintedTokens1 = Math.floor(
                (currentMintableTokens.toNumber() *
                    Math.floor((20 * PERC_DIVISOR) / 100)) /
                    PERC_DIVISOR
            )

            const currentMintedTokens = await minter.currentMintedTokens()
            assert.equal(
                currentMintedTokens,
                expMintedTokens0 + expMintedTokens1,
                "wrong currentMintedTokens"
            )
        })

        it("should fail if all mintable tokens for current round have been minted", async () => {
            // Set up reward call via BondingManager
            await fixture.bondingManager.execute(
                minter.address,
                functionEncodedABI(
                    "createReward(uint256,uint256)",
                    ["uint256", "uint256"],
                    [100, 100]
                )
            )

            await expect(
                fixture.bondingManager.execute(
                    minter.address,
                    functionEncodedABI(
                        "createReward(uint256,uint256)",
                        ["uint256", "uint256"],
                        [10, 100]
                    )
                )
            ).to.be.revertedWith("minted tokens cannot exceed mintable tokens")
        })
    })

    describe("trustedTransferTokens", () => {
        it("should fail if caller is not BondingManager", async () => {
            await expect(
                minter.trustedTransferTokens(signers[1].address, 100)
            ).to.be.revertedWith("msg.sender not BondingManager")
        })

        it("should fail if Controller is paused", async () => {
            await fixture.controller.pause()

            await expect(
                fixture.bondingManager.execute(
                    minter.address,
                    functionEncodedABI(
                        "trustedTransferTokens(address,uint256)",
                        ["address", "uint256"],
                        [signers[1].address, 100]
                    )
                )
            ).to.be.reverted
        })

        it("should transfer tokens to receiving address", async () => {
            // Just make sure that this does not fail
            await fixture.bondingManager.execute(
                minter.address,
                functionEncodedABI(
                    "trustedTransferTokens(address,uint256)",
                    ["address", "uint256"],
                    [signers[1].address, 100]
                )
            )
        })
    })

    describe("trustedBurnTokens", () => {
        it("should fail if caller is not BondingManager", async () => {
            await expect(minter.trustedBurnTokens(100)).to.be.revertedWith(
                "msg.sender not BondingManager"
            )
        })

        it("should fail if Controller is paused", async () => {
            await fixture.controller.pause()

            await expect(
                fixture.bondingManager.execute(
                    minter.address,
                    functionEncodedABI(
                        "trustedBurnTokens(uint256)",
                        ["uint256"],
                        [100]
                    )
                )
            ).to.be.reverted
        })

        it("should burn tokens", async () => {
            // Just make sure that this does not fail
            await fixture.bondingManager.execute(
                minter.address,
                functionEncodedABI(
                    "trustedBurnTokens(uint256)",
                    ["uint256"],
                    [100]
                )
            )
        })
    })

    describe("trustedWithdrawETH", () => {
        it("should fail if caller is not BondingManager or JobsManager", async () => {
            await expect(
                minter.trustedWithdrawETH(signers[1].address, 100)
            ).to.be.revertedWith("msg.sender not BondingManager or JobsManager")
        })

        it("should fail if Controller is paused", async () => {
            await fixture.controller.pause()

            await expect(
                fixture.bondingManager.execute(
                    minter.address,
                    functionEncodedABI(
                        "trustedWithdrawETH(address,uint256)",
                        ["address", "uint256"],
                        [signers[1].address, 100]
                    )
                )
            ).to.be.reverted
        })

        it("should fail if insufficient balance when caller is BondingManager", async () => {
            await expect(
                fixture.bondingManager.execute(
                    minter.address,
                    functionEncodedABI(
                        "trustedWithdrawETH(address,uint256)",
                        ["address", "uint256"],
                        [signers[1].address, 100]
                    )
                )
            ).to.be.reverted
        })

        it("should fail if insufficient balance when caller is JobsManager", async () => {
            await expect(
                fixture.ticketBroker.execute(
                    minter.address,
                    functionEncodedABI(
                        "trustedWithdrawETH(address,uint256)",
                        ["address", "uint256"],
                        [signers[1].address, 100]
                    )
                )
            ).to.be.reverted
        })

        it("should transfer ETH to receiving address when caller is BondingManager", async () => {
            await fixture.ticketBroker
                .connect(signers[1])
                .execute(minter.address, functionSig("depositETH()"), {
                    value: 100
                })
            const startBalance = BigNumber.from(
                await web3.eth.getBalance(signers[1].address)
            )
            await fixture.bondingManager.execute(
                minter.address,
                functionEncodedABI(
                    "trustedWithdrawETH(address,uint256)",
                    ["address", "uint256"],
                    [signers[1].address, 100]
                )
            )
            const endBalance = BigNumber.from(
                await web3.eth.getBalance(signers[1].address)
            )

            assert.equal(
                await web3.eth.getBalance(minter.address),
                0,
                "wrong minter balance"
            )
            // In practice, this check would not work because it does not factor in the transaction cost that would be incurred by the withdrawing caller
            // but for the purposes of testing that the value is withdrawn correctly we ignore the transaction cost that would be incurred
            assert.equal(
                endBalance.sub(startBalance),
                100,
                "wrong change in withdrawing caller"
            )
        })

        it("should transfer ETH to receiving address when caller is JobsManager", async () => {
            await fixture.ticketBroker
                .connect(signers[1])
                .execute(minter.address, functionSig("depositETH()"), {
                    value: 100
                })
            const startBalance = BigNumber.from(
                await web3.eth.getBalance(signers[1].address)
            )
            await fixture.ticketBroker.execute(
                minter.address,
                functionEncodedABI(
                    "trustedWithdrawETH(address,uint256)",
                    ["address", "uint256"],
                    [signers[1].address, 100]
                )
            )
            const endBalance = BigNumber.from(
                await web3.eth.getBalance(signers[1].address)
            )

            assert.equal(
                await web3.eth.getBalance(minter.address),
                0,
                "wrong minter balance"
            )
            // In practice, this check would not work because it does not factor in the transaction cost that would be incurred by the withdrawing caller
            // but for the purposes of testing that the value is withdrawn correctly we ignore the transaction cost that would be incurred
            assert.equal(
                endBalance.sub(startBalance),
                100,
                "wrong change in withdrawing caller"
            )
        })
    })

    describe("depositETH", () => {
        it("should fail if caller is not currently registered Minter or JobsManager", async () => {
            await expect(
                minter.connect(signers[1]).depositETH({value: 100})
            ).to.be.revertedWith("msg.sender not Minter or JobsManager")
        })

        it("should receive ETH from currently registered Minter", async () => {
            // Register mock Minter
            const mockMinter = await fixture.deployAndRegister(
                await ethers.getContractFactory("GenericMock"),
                "Minter"
            )
            // Call depositETH on this Minter from currently registered Minter
            await mockMinter
                .connect(signers[1])
                .execute(minter.address, functionSig("depositETH()"), {
                    value: 100
                })

            assert.equal(
                await web3.eth.getBalance(minter.address),
                100,
                "wrong minter balance"
            )
        })

        it("should receive ETH from JobsManager", async () => {
            await fixture.ticketBroker
                .connect(signers[1])
                .execute(minter.address, functionSig("depositETH()"), {
                    value: 100
                })

            assert.equal(
                await web3.eth.getBalance(minter.address),
                100,
                "wrong minter balance"
            )
        })
    })

    describe("setCurrentRewardTokens", () => {
        beforeEach(async () => {
            // Set current supply
            await fixture.token.setMockUint256(
                functionSig("totalSupply()"),
                1000
            )
        })

        it("should fail if caller is not RoundsManager", async () => {
            await expect(minter.setCurrentRewardTokens()).to.be.revertedWith(
                "msg.sender not RoundsManager"
            )
        })

        it("should fail if Controller is paused", async () => {
            await fixture.controller.pause()

            await expect(
                fixture.roundsManager.execute(
                    minter.address,
                    functionSig("setCurrentRewardTokens()")
                )
            ).to.be.reverted
        })

        it("should increase the inflation rate if the current bonding rate is 0 (total supply = 0) and below the target bonding rate", async () => {
            const startInflation = await minter.inflation()

            // Set total supply to 0
            await fixture.token.setMockUint256(functionSig("totalSupply()"), 0)
            // Call setCurrentRewardTokens via RoundsManager
            await fixture.roundsManager.execute(
                minter.address,
                functionSig("setCurrentRewardTokens()")
            )

            const endInflation = await minter.inflation()

            assert.equal(
                endInflation.sub(startInflation).toNumber(),
                await minter.inflationChange(),
                "inflation rate did not change correctly"
            )
        })

        it("should increase the inflation rate if the current bonding rate is below the target bonding rate", async () => {
            const startInflation = await minter.inflation()

            // Set total bonded tokens
            await fixture.bondingManager.setMockUint256(
                functionSig("getTotalBonded()"),
                400
            )
            // Call setCurrentRewardTokens via RoundsManager
            await fixture.roundsManager.execute(
                minter.address,
                functionSig("setCurrentRewardTokens()")
            )

            const endInflation = await minter.inflation()

            assert.equal(
                endInflation.sub(startInflation).toNumber(),
                await minter.inflationChange(),
                "inflation rate did not change correctly"
            )
        })

        it("should decrease the inflation rate if the current bonding rate is above the target bonding rate", async () => {
            const startInflation = await minter.inflation()

            // Set total bonded tokens
            await fixture.bondingManager.setMockUint256(
                functionSig("getTotalBonded()"),
                600
            )
            // Call setCurrentRewardTokens via RoundsManager
            await fixture.roundsManager.execute(
                minter.address,
                functionSig("setCurrentRewardTokens()")
            )

            const endInflation = await minter.inflation()

            assert.equal(
                startInflation.sub(endInflation).toNumber(),
                await minter.inflationChange(),
                "inflation rate did not change correctly"
            )
        })

        it("should set the inflation rate to 0 if the inflation change is greater than the inflation and the current bonding rate is above the target bonding rate", async () => {
            await minter.setInflationChange(INFLATION + 1)
            // Set total bonded tokens
            await fixture.bondingManager.setMockUint256(
                functionSig("getTotalBonded()"),
                600
            )
            // Call setCurrentRewardTokens via RoundsManager
            await fixture.roundsManager.execute(
                minter.address,
                functionSig("setCurrentRewardTokens()")
            )

            const endInflation = await minter.inflation()

            assert.equal(endInflation, 0, "inflation rate not set to 0")
        })

        it("should maintain the inflation rate if the current bonding rate is equal to the target bonding rate", async () => {
            const startInflation = await minter.inflation()

            await fixture.bondingManager.setMockUint256(
                functionSig("getTotalBonded()"),
                500
            )
            // Call setCurrentRewardTokens via RoundsManager
            await fixture.roundsManager.execute(
                minter.address,
                functionSig("setCurrentRewardTokens()")
            )

            const endInflation = await minter.inflation()

            assert.equal(
                startInflation.sub(endInflation).toNumber(),
                0,
                "inflation rate did not stay the same"
            )
        })

        it("should set currentMintableTokens based on the current inflation and current total token supply", async () => {
            // Set total bonded tokens - we are at the target bonding rate so inflation does not move
            await fixture.bondingManager.setMockUint256(
                functionSig("getTotalBonded()"),
                500
            )
            // Call setCurrentRewardTokens via RoundsManager
            await fixture.roundsManager.execute(
                minter.address,
                functionSig("setCurrentRewardTokens()")
            )

            const inflation = await minter.inflation()
            const expCurrentMintableTokens = Math.floor(
                (1000 * inflation.toNumber()) / PERC_DIVISOR
            )

            assert.equal(
                await minter.currentMintableTokens(),
                expCurrentMintableTokens,
                "wrong currentMintableTokens"
            )
        })

        it("should set currentMintableTokens and inflation correctly for different inflationChange values", async () => {
            const totalSupply = BigNumber.from("21645383016495782629665363")
            const inflation = 0.0455 * PERC_MULTIPLIER
            const targetBondingRate = 50 * PERC_MULTIPLIER
            const currentBondingRate = 51 * PERC_MULTIPLIER
            const totalBonded = totalSupply
                .mul(BigNumber.from(currentBondingRate))
                .div(BigNumber.from(PERC_DIVISOR))

            await fixture.token.setMockUint256(
                functionSig("totalSupply()"),
                totalSupply.toString()
            )
            // Set total bonded tokens - we are above the target bonding rate so inflation decreases
            await fixture.bondingManager.setMockUint256(
                functionSig("getTotalBonded()"),
                totalBonded.toString()
            )

            let inflationChange = Math.ceil(0.0003 * PERC_MULTIPLIER)
            let newMinter = await fixture.deployAndRegister(
                minterFac,
                "Minter",
                fixture.controller.address,
                inflation,
                inflationChange,
                targetBondingRate
            )

            await fixture.roundsManager.execute(
                newMinter.address,
                functionSig("setCurrentRewardTokens()")
            )

            assert.equal(await newMinter.inflation(), 0.0452 * PERC_MULTIPLIER)
            const currentMintableTokens1 =
                await newMinter.currentMintableTokens()

            inflationChange = 0.00005 * PERC_MULTIPLIER
            newMinter = await fixture.deployAndRegister(
                minterFac,
                "Minter",
                fixture.controller.address,
                inflation,
                inflationChange,
                targetBondingRate
            )

            await fixture.roundsManager.execute(
                newMinter.address,
                functionSig("setCurrentRewardTokens()")
            )

            assert.equal(await newMinter.inflation(), 0.04545 * PERC_MULTIPLIER)
            const currentMintableTokens2 =
                await newMinter.currentMintableTokens()

            // Check that currentMintableTokens is greater when using a smaller inflationChange value
            assert.isOk(currentMintableTokens2.gt(currentMintableTokens1))
        })

        it("should set currentMintedTokens = 0", async () => {
            // Set total bonded tokens - we are at the target bonding rate so inflation does not move
            await fixture.bondingManager.setMockUint256(
                functionSig("getTotalBonded()"),
                500
            )
            // Call setCurrentRewardTokens via RoundsManager
            await fixture.roundsManager.execute(
                minter.address,
                functionSig("setCurrentRewardTokens()")
            )

            assert.equal(
                await minter.currentMintedTokens(),
                0,
                "wrong currentMintedTokens"
            )
        })
    })

    describe("getController()", () => {
        it("should return Controller", async () => {
            assert.equal(
                await minter.getController(),
                fixture.controller.address,
                "should return Controller address"
            )
        })
    })
})

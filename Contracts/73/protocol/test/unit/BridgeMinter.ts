import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signers"
import {expect, use} from "chai"
import {ethers} from "hardhat"
import {BridgeMinter, BridgeMinter__factory} from "../../typechain"
import {FakeContract, smock} from "@defi-wonderland/smock"

use(smock.matchers)

describe("BridgeMinter", () => {
    let bridgeMinter: BridgeMinter

    let eoa: SignerWithAddress

    let controllerMock: FakeContract
    let tokenMock: FakeContract
    let l1MigratorMock: FakeContract
    let mockControllerEOA: SignerWithAddress
    let mockTokenEOA: SignerWithAddress
    let mockL1MigratorEOA: SignerWithAddress
    let mockL1LPTGatewayEOA: SignerWithAddress

    beforeEach(async () => {
        ;[
            eoa,
            mockControllerEOA,
            mockTokenEOA,
            mockL1MigratorEOA,
            mockL1LPTGatewayEOA
        ] = await ethers.getSigners()

        const BridgeMinter: BridgeMinter__factory =
            await ethers.getContractFactory("BridgeMinter")
        bridgeMinter = await BridgeMinter.deploy(
            mockControllerEOA.address,
            mockTokenEOA.address,
            mockL1MigratorEOA.address,
            mockL1LPTGatewayEOA.address
        )
        await bridgeMinter.deployed()

        controllerMock = await smock.fake("Controller", {
            address: mockControllerEOA.address
        })

        tokenMock = await smock.fake("IBridgeMinterToken", {
            address: mockTokenEOA.address
        })

        // We don't actually need a L1Migrator interface since we just need
        // to manipulate the fallback function behavior so we just use a contract name
        // that isn't actually a dependency in tests as a stand-in
        l1MigratorMock = await smock.fake("BondingManager", {
            address: mockL1MigratorEOA.address
        })
    })

    describe("constructor", () => {
        it("sets addresses", async () => {
            expect(await bridgeMinter.tokenAddr()).to.be.equal(
                mockTokenEOA.address
            )
            expect(await bridgeMinter.l1MigratorAddr()).to.be.equal(
                mockL1MigratorEOA.address
            )
            expect(await bridgeMinter.l1LPTGatewayAddr()).to.be.equal(
                mockL1LPTGatewayEOA.address
            )
        })
    })

    describe("setToken", () => {
        it("reverts if msg.sender != Controller owner", async () => {
            await expect(
                bridgeMinter.connect(eoa).setToken(eoa.address)
            ).to.be.revertedWith("caller must be Controller owner")
        })

        it("sets token address", async () => {
            controllerMock.owner.returns(eoa.address)

            await bridgeMinter.connect(eoa).setToken(eoa.address)
            expect(await bridgeMinter.tokenAddr()).to.be.equal(eoa.address)
        })
    })

    describe("setL1Migrator", () => {
        it("reverts if msg.sender != Controller owner", async () => {
            await expect(
                bridgeMinter.connect(eoa).setL1Migrator(eoa.address)
            ).to.be.revertedWith("caller must be Controller owner")
        })

        it("sets token address", async () => {
            controllerMock.owner.returns(eoa.address)

            await bridgeMinter.connect(eoa).setL1Migrator(eoa.address)
            expect(await bridgeMinter.l1MigratorAddr()).to.be.equal(eoa.address)
        })
    })

    describe("setL1LPTGateway", () => {
        it("reverts if msg.sender != Controller owner", async () => {
            await expect(
                bridgeMinter.connect(eoa).setL1LPTGateway(eoa.address)
            ).to.be.revertedWith("caller must be Controller owner")
        })

        it("sets token address", async () => {
            controllerMock.owner.returns(eoa.address)

            await bridgeMinter.connect(eoa).setL1LPTGateway(eoa.address)
            expect(await bridgeMinter.l1LPTGatewayAddr()).to.be.equal(
                eoa.address
            )
        })
    })

    describe("migrateToNewMinter", () => {
        it("reverts if msg.sender != Controller owner", async () => {
            await expect(
                bridgeMinter.connect(eoa).migrateToNewMinter(eoa.address)
            ).to.be.revertedWith("caller must be Controller owner")
        })

        it("reverts if address is current Minter", async () => {
            controllerMock.owner.returns(eoa.address)
            await expect(
                bridgeMinter
                    .connect(eoa)
                    .migrateToNewMinter(bridgeMinter.address)
            ).to.be.revertedWith(
                "BridgeMinter#migrateToNewMinter: INVALID_MINTER"
            )
        })

        it("reverts if address is null", async () => {
            controllerMock.owner.returns(eoa.address)
            await expect(
                bridgeMinter
                    .connect(eoa)
                    .migrateToNewMinter(ethers.constants.AddressZero)
            ).to.be.revertedWith(
                "BridgeMinter#migrateToNewMinter: INVALID_MINTER"
            )
        })

        it("reverts if call to new Minter fails", async () => {
            controllerMock.owner.returns(eoa.address)
            l1MigratorMock.fallback.reverts()

            const newMinter = mockL1MigratorEOA
            await expect(
                bridgeMinter.connect(eoa).migrateToNewMinter(newMinter.address)
            ).to.be.revertedWith("BridgeMinter#migrateToNewMinter: FAIL_CALL")
        })

        it("migrates to new Minter", async () => {
            const ethValue = 300
            const lptValue = 200

            controllerMock.owner.returns(eoa.address)
            tokenMock.balanceOf
                .whenCalledWith(bridgeMinter.address)
                .returns(lptValue)

            let tx = await bridgeMinter
                .connect(eoa)
                .depositETH({value: ethValue})
            await expect(tx).to.changeEtherBalance(bridgeMinter, ethValue)

            const newMinter = mockL1MigratorEOA
            tx = await bridgeMinter
                .connect(eoa)
                .migrateToNewMinter(newMinter.address)
            expect(tokenMock.transferOwnership).to.be.calledOnceWith(
                newMinter.address
            )
            expect(tokenMock.transfer).to.be.calledOnceWith(
                newMinter.address,
                lptValue
            )
            await expect(tx).to.changeEtherBalance(newMinter, ethValue)
        })
    })

    describe("withdrawETHToL1Migrator", () => {
        it("reverts if msg.sender != L1Migrator", async () => {
            await expect(
                bridgeMinter.connect(eoa).withdrawETHToL1Migrator()
            ).to.be.revertedWith("NOT_L1_MIGRATOR")
        })

        it("reverts if call to L1Migrator fails", async () => {
            // Make sure BridgeMinter has a ETH balance
            const ethValue = 100
            const tx = await bridgeMinter
                .connect(eoa)
                .depositETH({value: ethValue})
            await expect(tx).to.changeEtherBalance(bridgeMinter, ethValue)

            l1MigratorMock.fallback.reverts()
            await expect(
                bridgeMinter
                    .connect(mockL1MigratorEOA)
                    .withdrawETHToL1Migrator()
            ).to.be.revertedWith(
                "BridgeMinter#withdrawETHToL1Migrator: FAIL_CALL"
            )
        })

        it("transfers ETH balance to L1Migrator", async () => {
            // Make sure BridgeMinter has a ETH balance
            const ethValue = 100
            let tx = await bridgeMinter
                .connect(eoa)
                .depositETH({value: ethValue})
            await expect(tx).to.changeEtherBalance(bridgeMinter, ethValue)

            tx = await bridgeMinter
                .connect(mockL1MigratorEOA)
                .withdrawETHToL1Migrator()
            await expect(tx).to.changeEtherBalance(mockL1MigratorEOA, ethValue)
        })
    })

    describe("withdrawLPTToL1Migrator", () => {
        it("reverts if msg.sender != L1Migrator", async () => {
            await expect(
                bridgeMinter.connect(eoa).withdrawLPTToL1Migrator()
            ).to.be.revertedWith("NOT_L1_MIGRATOR")
        })

        it("transfers LPT balance to L1Migrator", async () => {
            // Make sure BridgeMinter has a LPT balance
            const lptValue = 100
            tokenMock.balanceOf
                .whenCalledWith(bridgeMinter.address)
                .returns(lptValue)

            await bridgeMinter
                .connect(mockL1MigratorEOA)
                .withdrawLPTToL1Migrator()
            expect(tokenMock.transfer).to.be.calledOnceWith(
                mockL1MigratorEOA.address,
                lptValue
            )
        })
    })

    describe("bridgeMint", () => {
        it("reverts if msg.sender != L1LPTGateway", async () => {
            await expect(
                bridgeMinter.connect(eoa).bridgeMint(eoa.address, 100)
            ).to.be.revertedWith("NOT_L1_LPT_GATEWAY")
        })

        it("mints LPT to specified address", async () => {
            const amount = 100
            await bridgeMinter
                .connect(mockL1LPTGatewayEOA)
                .bridgeMint(eoa.address, amount)
            expect(tokenMock.mint).to.be.calledOnceWith(eoa.address, amount)
        })
    })

    describe("depositETH", () => {
        it("receives ETH", async () => {
            const ethValue = 100
            const tx = await bridgeMinter
                .connect(eoa)
                .depositETH({value: ethValue})
            await expect(tx).to.changeEtherBalance(bridgeMinter, ethValue)
        })
    })

    describe("getController", () => {
        it("returns Controller address", async () => {
            expect(await bridgeMinter.getController()).to.be.equal(
                mockControllerEOA.address
            )
        })
    })
})

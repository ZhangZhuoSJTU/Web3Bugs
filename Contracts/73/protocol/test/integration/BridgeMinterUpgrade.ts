import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signers"
import {deployments, ethers} from "hardhat"
import {
    Controller,
    BondingManager,
    LivepeerToken,
    Minter,
    TicketBroker
} from "../../typechain"
import {expect} from "chai"

describe("BridgeMinterUpgrade", () => {
    let transcoder1: SignerWithAddress
    let broadcaster1: SignerWithAddress

    let controller: Controller
    let bondingManager: BondingManager
    let token: LivepeerToken
    let minter: Minter
    let broker: TicketBroker

    before(async () => {
        ;[transcoder1, broadcaster1] = await ethers.getSigners()

        const fixture = await deployments.fixture(["Contracts"])

        controller = await ethers.getContractAt(
            "Controller",
            fixture.Controller.address
        )
        await controller.unpause()

        bondingManager = await ethers.getContractAt(
            "BondingManager",
            fixture.BondingManager.address
        )

        token = await ethers.getContractAt(
            "LivepeerToken",
            fixture.LivepeerToken.address
        )

        minter = await ethers.getContractAt("Minter", fixture.Minter.address)

        broker = await ethers.getContractAt(
            "TicketBroker",
            fixture.TicketBroker.address
        )

        const amount = ethers.utils.parseEther("10")
        await token.transfer(transcoder1.address, amount)

        // Register transcoder 1
        await token.connect(transcoder1).approve(bondingManager.address, amount)
        await bondingManager
            .connect(transcoder1)
            .bond(amount, transcoder1.address)

        const deposit = ethers.utils.parseEther("1")

        // Deposit ETH from broadcaster 1
        await broker.connect(broadcaster1).fundDeposit({value: deposit})
    })

    it("upgrade to BridgeMinter", async () => {
        const ethBal = await ethers.provider.getBalance(minter.address)
        const lptBal = await token.balanceOf(minter.address)

        // Deploy the BridgeMinter
        const bridgeMinter = await (
            await ethers.getContractFactory("BridgeMinter")
        ).deploy(
            controller.address,
            token.address,
            ethers.constants.AddressZero,
            ethers.constants.AddressZero
        )

        // Pause the Controller so migrateToNewMinter() can be called
        await controller.pause()

        // Migrate from Minter to BridgeMinter
        const tx = await minter.migrateToNewMinter(bridgeMinter.address)

        // Check that BridgeMinter ETH balance increased correctly
        await expect(tx).to.changeEtherBalance(bridgeMinter, ethBal)
        // Check that BridgeMinter LPT balance increased correctly
        expect(await token.balanceOf(bridgeMinter.address)).to.be.equal(lptBal)
        // Check that BridgeMinter can mint tokens
        expect(await token.owner()).to.be.equal(bridgeMinter.address)
    })
})

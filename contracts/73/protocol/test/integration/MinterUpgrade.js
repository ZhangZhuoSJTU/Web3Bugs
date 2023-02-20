import {contractId} from "../../utils/helpers"
import {deployments, ethers} from "hardhat"

import chai, {assert, expect} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("MinterUpgrade", () => {
    const NEW_INFLATION_CHANGE = ethers.constants.One

    let transcoder1
    let transcoder2
    let broadcaster1
    let broadcaster2

    let controller
    let bondingManager
    let roundsManager
    let token
    let minter
    let broker

    let roundLength

    let signers

    const checkWithdrawalResult = async broadcaster => {
        const unlockPeriod = await broker.unlockPeriod()

        await broker.connect(broadcaster).unlock()

        await roundsManager.mineBlocks(unlockPeriod.mul(roundLength))

        const startMinterBalance = await ethers.provider.getBalance(
            minter.address
        )
        const startInfo = await broker.getSenderInfo(broadcaster.address)

        await broker.connect(broadcaster).withdraw()

        const endMinterBalance = await ethers.provider.getBalance(
            minter.address
        )
        const endInfo = await broker.getSenderInfo(broadcaster.address)

        assert.equal(endInfo.sender.deposit.toString(), "0")
        assert.equal(
            startMinterBalance.sub(endMinterBalance).toString(),
            startInfo.sender.deposit.toString()
        )
    }

    before(async () => {
        signers = await ethers.getSigners()
        transcoder1 = signers[0]
        transcoder2 = signers[1]
        broadcaster1 = signers[2]
        broadcaster2 = signers[3]

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

        roundsManager = await ethers.getContractAt(
            "AdjustableRoundsManager",
            fixture.AdjustableRoundsManager.address
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

        // Set target bonding rate to 0 so inflation decreases each round
        await minter.setTargetBondingRate(0)

        const amount = ethers.utils.parseEther("10")
        await token.transfer(transcoder1.address, amount)
        await token.transfer(transcoder2.address, amount)

        // Register transcoder 1
        await token.connect(transcoder1).approve(bondingManager.address, amount)
        await bondingManager
            .connect(transcoder1)
            .bond(amount, transcoder1.address)

        // Register transcoder 2
        await token.connect(transcoder2).approve(bondingManager.address, amount)
        await bondingManager
            .connect(transcoder2)
            .bond(amount, transcoder2.address)

        const deposit = ethers.utils.parseEther("1")

        // Deposit ETH from broadcaster 1
        await broker.connect(broadcaster1).fundDeposit({value: deposit})

        // Deposit ETH from broadcaster 2
        await broker.connect(broadcaster2).fundDeposit({value: deposit})

        roundLength = await roundsManager.roundLength()
        await roundsManager.setBlockHash(web3.utils.keccak256("foo"))
    })

    it("new round is initialized with inflation set based on old inflation change value", async () => {
        const startInflation = await minter.inflation()

        await roundsManager.mineBlocks(roundLength.toNumber() * 1000)
        await roundsManager.initializeRound()

        const endInflation = await minter.inflation()

        assert.equal(
            startInflation.sub(endInflation).toString(),
            (await minter.inflationChange()).toString()
        )
    })

    it("transcoder 1 calls reward pre-upgrade and receives tokens", async () => {
        const startStake = await bondingManager.transcoderTotalStake(
            transcoder1.address
        )

        await bondingManager.connect(transcoder1).reward()

        const endStake = await bondingManager.transcoderTotalStake(
            transcoder1.address
        )
        expect(endStake.sub(startStake)).to.be.gt(ethers.constants.Zero)
    })

    it("Minter upgrade is executed", async () => {
        const inflation = await minter.inflation()
        const inflationChange = await minter.inflationChange()
        const targetBondingRate = await minter.targetBondingRate()
        const tokenBal = await token.balanceOf(minter.address)
        const ethBal = await ethers.provider.getBalance(minter.address)

        // Sanity check
        assert.notOk(inflationChange.eq(NEW_INFLATION_CHANGE))

        // Deploy the new Minter
        const newMinter = await (
            await ethers.getContractFactory("Minter")
        ).deploy(
            controller.address,
            inflation,
            NEW_INFLATION_CHANGE,
            targetBondingRate
        )

        // Pause the Controller so migrateToNewMinter() can be called
        await controller.pause()

        // Migrate from old Minter to new Minter
        await minter.migrateToNewMinter(newMinter.address)

        // Register the new Minter
        await controller.setContractInfo(
            contractId("Minter"),
            newMinter.address,
            "0x3031323334353637383930313233343536373839"
        )

        // Unpause the Controller after migrateToNewMinter() has been called
        await controller.unpause()

        // Check new Minter parameters and balances
        assert.equal(
            (await newMinter.inflation()).toString(),
            inflation.toString()
        )
        assert.equal(
            (await newMinter.targetBondingRate()).toString(),
            targetBondingRate.toString()
        )
        assert.equal(
            (await newMinter.inflationChange()).toString(),
            NEW_INFLATION_CHANGE.toString()
        )
        assert.equal(
            (await token.balanceOf(newMinter.address)).toString(),
            tokenBal.toString()
        )
        assert.equal(
            (await ethers.provider.getBalance(newMinter.address)).toString(),
            ethBal.toString()
        )

        // Check that internal state is reset
        assert.equal((await newMinter.currentMintableTokens()).toString(), "0")
        assert.equal((await newMinter.currentMintedTokens()).toString(), "0")

        // Check that new Minter can mint tokens
        assert.equal(await token.owner.call(), newMinter.address)

        // Set minter var to new Minter
        minter = newMinter
    })

    it("transcoder 2 calls reward post-upgrade in the same round and receives nothing", async () => {
        const startStake = await bondingManager.transcoderTotalStake(
            transcoder2.address
        )

        await bondingManager.connect(transcoder2).reward()

        const endStake = await bondingManager.transcoderTotalStake(
            transcoder2.address
        )

        assert.equal(endStake.sub(startStake).toString(), "0")
    })

    it("new round is initialized and inflation is set based on new inflation change value", async () => {
        const startInflation = await minter.inflation()

        const currBlock = await roundsManager.blockNum()
        const blocks = (await roundsManager.currentRound())
            .mul(roundLength)
            .add(roundLength)
            .sub(currBlock)
        await roundsManager.mineBlocks(blocks)
        await roundsManager.initializeRound()

        const endInflation = await minter.inflation()

        assert.equal(
            startInflation.sub(endInflation).toString(),
            NEW_INFLATION_CHANGE.toString()
        )
    })

    it("transcoder 1 calls reward in the round after the upgrade round and receives tokens", async () => {
        const startStake = await bondingManager.transcoderTotalStake(
            transcoder1.address
        )

        await bondingManager.connect(transcoder1).reward()

        const endStake = await bondingManager.transcoderTotalStake(
            transcoder1.address
        )

        expect(endStake.sub(startStake)).gt(ethers.constants.Zero)
    })

    it("transcoder 2 calls reward in the round after the upgrade round and receives tokens", async () => {
        const startStake = await bondingManager.transcoderTotalStake(
            transcoder2.address
        )

        await bondingManager.connect(transcoder2).reward()

        const endStake = await bondingManager.transcoderTotalStake(
            transcoder2.address
        )

        assert.ok(endStake.sub(startStake).gt(ethers.constants.Zero))
    })

    it("broadcaster 1 withdraws deposit", async () => {
        await checkWithdrawalResult(broadcaster1)
    })

    it("broadcaster 2 withdraws deposit", async () => {
        await checkWithdrawalResult(broadcaster2)
    })
})

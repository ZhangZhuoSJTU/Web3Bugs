import {contractId} from "../../utils/helpers"
import {constants} from "../../utils/constants"
import {createWinningTicket, getTicketHash} from "../helpers/ticket"
import signMsg from "../helpers/signMsg"
import {deployments, ethers} from "hardhat"

import chai, {assert, expect} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

const executeUpgrade = async (controller, gov, bondingManagerProxyAddress) => {
    const ll = await deployments.get("SortedDoublyLL")
    const bondingManagerFac = await ethers.getContractFactory(
        "BondingManager",
        {
            libraries: {
                SortedDoublyLL: ll.address
            }
        }
    )
    const bondingManagerTarget = await bondingManagerFac.deploy(
        controller.address
    )

    // Register the new BondingManager implementation contract
    const pauseData = controller.interface.encodeFunctionData("pause", [])
    const setInfoData = controller.interface.encodeFunctionData(
        "setContractInfo",
        [
            contractId("BondingManagerTarget"),
            bondingManagerTarget.address,
            "0x3031323334353637383930313233343536373839"
        ]
    )
    const unpauseData = controller.interface.encodeFunctionData("unpause", [])
    const update = {
        target: [controller.address, controller.address, controller.address],
        value: ["0", "0", "0"],
        data: [pauseData, setInfoData, unpauseData],
        nonce: 0
    }

    await gov.stage(update, 0)
    await gov.execute(update)

    return await ethers.getContractAt(
        "BondingManager",
        bondingManagerProxyAddress
    )
}

describe("ZeroStartFactorsBug", () => {
    let controller
    let bondingManager
    let roundsManager
    let token
    let broker
    let bondingProxy
    let governor

    let signers

    let roundLength
    let lip36Round

    const transferAmount = ethers.utils.parseEther("100")
    const deposit = ethers.utils.parseEther("10")
    const reserve = ethers.utils.parseEther("1")
    const faceValue = ethers.utils.parseEther("0.1")

    const NUM_ACTIVE_TRANSCODERS = 10
    const UNBONDING_PERIOD = 2
    const MAX_EARNINGS_CLAIMS_ROUNDS = 20
    const MAX_LOOKBACK_ROUNDS = 100

    let transcoder1
    let transcoder2
    let broadcaster
    let delegator1
    let delegator2
    let delegator3
    let delegator4
    let delegator5
    let delegator6

    let delegators = [
        delegator1,
        delegator2,
        delegator3,
        delegator4,
        delegator5,
        delegator6
    ]

    // Address => round => pendingStake
    const pendingStakeHistory = {}
    // Address => round => pendingStake
    const pendingFeesHistory = {}

    async function redeemWinningTicket(transcoder, broadcaster, faceValue) {
        const block = await roundsManager.blockNum()
        const creationRound = (await roundsManager.currentRound()).toString()
        const creationRoundBlockHash = await roundsManager.blockHash(block)
        const auxData = web3.eth.abi.encodeParameters(
            ["uint256", "bytes32"],
            [creationRound, creationRoundBlockHash]
        )
        const recipientRand = 5
        const ticket = createWinningTicket(
            transcoder.address,
            broadcaster.address,
            recipientRand,
            faceValue.toString(),
            auxData
        )
        const senderSig = await signMsg(
            getTicketHash(ticket),
            broadcaster.address
        )

        await broker
            .connect(transcoder)
            .redeemWinningTicket(ticket, senderSig, recipientRand)
    }

    before(async () => {
        signers = await ethers.getSigners()
        transcoder1 = signers[0]
        transcoder2 = signers[1]
        broadcaster = signers[2]
        delegator1 = signers[3]
        delegator2 = signers[4]
        delegator3 = signers[5]
        delegator4 = signers[6]
        delegator5 = signers[7]
        delegator6 = signers[8]

        delegators = [
            delegator1,
            delegator2,
            delegator3,
            delegator4,
            delegator5,
            delegator6
        ]

        const fixture = await deployments.fixture(["Contracts"])
        controller = controller = await ethers.getContractAt(
            "Controller",
            fixture.Controller.address
        )
        await controller.unpause()

        // Deploy old BondingManager with the bug
        const ll = fixture.SortedDoublyLL
        const bondingManagerBugFac = await ethers.getContractFactory(
            "BondingManagerZeroStartFactorsBug",
            {libraries: {SortedDoublyLL: ll.address}}
        )
        const bondingTarget = await bondingManagerBugFac.deploy(
            controller.address
        )
        await controller.setContractInfo(
            contractId("BondingManagerTarget"),
            bondingTarget.address,
            "0x3031323334353637383930313233343536373839"
        )
        const proxyFac = await ethers.getContractFactory("ManagerProxy")
        bondingProxy = await proxyFac.deploy(
            controller.address,
            contractId("BondingManagerTarget")
        )
        await controller.setContractInfo(
            contractId("BondingManager"),
            bondingProxy.address,
            "0x3031323334353637383930313233343536373839"
        )
        bondingManager = await ethers.getContractAt(
            "BondingManagerZeroStartFactorsBug",
            bondingProxy.address
        )

        await bondingManager.setUnbondingPeriod(UNBONDING_PERIOD)
        await bondingManager.setNumActiveTranscoders(NUM_ACTIVE_TRANSCODERS)
        await bondingManager.setMaxEarningsClaimsRounds(
            MAX_EARNINGS_CLAIMS_ROUNDS
        )

        roundsManager = await ethers.getContractAt(
            "AdjustableRoundsManager",
            fixture.AdjustableRoundsManager.address
        )

        token = await ethers.getContractAt(
            "LivepeerToken",
            fixture.LivepeerToken.address
        )

        broker = await ethers.getContractAt(
            "TicketBroker",
            fixture.TicketBroker.address
        )

        roundLength = await roundsManager.roundLength.call()
        await roundsManager.mineBlocks(roundLength.toNumber())
        await roundsManager.initializeRound()

        // Register transcoder
        const register = async transcoder => {
            await token.transfer(transcoder.address, transferAmount)
            await token
                .connect(transcoder)
                .approve(bondingManager.address, transferAmount)
            await bondingManager
                .connect(transcoder)
                .bond(transferAmount, transcoder.address)
            await bondingManager
                .connect(transcoder)
                .transcoder(
                    50 * constants.PERC_MULTIPLIER,
                    50 * constants.PERC_MULTIPLIER
                )
        }

        const bond = async (delegator, transcoder) => {
            await token.transfer(delegator.address, transferAmount)
            await token
                .connect(delegator)
                .approve(bondingManager.address, transferAmount)
            await bondingManager
                .connect(delegator)
                .bond(transferAmount, transcoder.address)
        }

        await register(transcoder1)
        await register(transcoder2)

        // Deposit funds for broadcaster
        await broker
            .connect(broadcaster)
            .fundDepositAndReserve(deposit, reserve, {
                value: deposit.add(reserve)
            })

        await roundsManager.mineBlocks(roundLength.toNumber() * 2)
        await roundsManager.setBlockHash(web3.utils.keccak256("foo"))
        await roundsManager.initializeRound()

        lip36Round = await roundsManager.currentRound()
        await roundsManager.setLIPUpgradeRound(36, lip36Round)

        governor = await (await ethers.getContractFactory("Governor")).deploy()
        await controller.transferOwnership(governor.address)

        await roundsManager.mineBlocks(roundLength.toNumber())
        await roundsManager.initializeRound()

        await bond(delegator6, transcoder1)

        await roundsManager.mineBlocks(roundLength.toNumber())
        await roundsManager.initializeRound()

        // Set cumulativeRewardFactor for transcoder1
        await bondingManager.connect(transcoder1).reward()
        // Set cumulativeFeeFactor for transcoder2
        await redeemWinningTicket(transcoder2, broadcaster, faceValue)

        await roundsManager.mineBlocks(roundLength.toNumber())
        await roundsManager.initializeRound()

        // Bond from unbonded
        // Delegate to transcoders

        await bond(delegator1, transcoder1)
        await bond(delegator2, transcoder2)

        await roundsManager.mineBlocks(roundLength.toNumber())
        await roundsManager.initializeRound()

        await bond(delegator3, transcoder1)
        await bond(delegator4, transcoder2)

        await roundsManager.mineBlocks(roundLength.toNumber())
        await roundsManager.initializeRound()

        // Trigger bug where cumulative factors for a round prior to the LIP-36 upgrade round are stored
        await bondingManager
            .connect(transcoder1)
            .claimEarnings(lip36Round.toNumber() - 1)

        await roundsManager.mineBlocks(
            roundLength.toNumber() * MAX_LOOKBACK_ROUNDS
        )
        await roundsManager.initializeRound()

        await bond(delegator5, transcoder1)

        bondingManager = await executeUpgrade(
            controller,
            governor,
            bondingProxy.address
        )

        const cr = await roundsManager.currentRound()
        // Store pendingStake and pendingFees here since we cannot call these
        // functions for a previous round after the next round is initialized
        for (const del of delegators) {
            pendingStakeHistory[del.address] = {}
            pendingFeesHistory[del.address] = {}
            pendingStakeHistory[del.address][cr.toNumber()] =
                await bondingManager.pendingStake(del.address, cr)
            pendingFeesHistory[del.address][cr.toNumber()] =
                await bondingManager.pendingFees(del.address, cr)
        }

        await roundsManager.mineBlocks(roundLength.toNumber())
        await roundsManager.initializeRound()
    })

    describe("lookback", () => {
        it("lookback for cumulativeRewardFactor", async () => {
            const cr = await roundsManager.currentRound()

            // 1 round
            const ps1 =
                pendingStakeHistory[delegator1.address][cr.toNumber() - 1]
            const ps2 = await bondingManager.pendingStake(
                delegator1.address,
                cr
            )

            assert.equal(ps1.toString(), ps2.toString())

            // 2 rounds
            const ps3 =
                pendingStakeHistory[delegator3.address][cr.toNumber() - 1]
            const ps4 = await bondingManager.pendingStake(
                delegator3.address,
                cr
            )

            assert.equal(ps3.toString(), ps4.toString())

            const gas1 = await bondingManager.estimateGas.pendingStake(
                delegator1.address,
                cr
            )
            const gas2 = await bondingManager.estimateGas.pendingStake(
                delegator3.address,
                cr
            )
            assert.isAbove(gas2, gas1)
        })

        it("lookback for cumulativeFeeFactor", async () => {
            const cr = await roundsManager.currentRound()

            // 1 round
            const pf1 =
                pendingFeesHistory[delegator2.address][cr.toNumber() - 1]
            const pf2 = await bondingManager.pendingFees(delegator2.address, cr)

            assert.equal(pf1.toString(), pf2.toString())

            // 2 rounds
            const pf3 =
                pendingFeesHistory[delegator4.address][cr.toNumber() - 1]
            const pf4 = await bondingManager.pendingFees(delegator4.address, cr)

            assert.equal(pf3.toString(), pf4.toString())

            const gas1 = await bondingManager.estimateGas.pendingStake(
                delegator2.address,
                cr
            )
            const gas2 = await bondingManager.estimateGas.pendingStake(
                delegator4.address,
                cr
            )
            assert.isAbove(gas2, gas1)
        })

        it("does not lookback past LIP-36 upgrade round", async () => {
            // Ensure that a cumulative factor is not stored for the delegator's lastClaimRound
            const lcr = (await bondingManager.getDelegator(delegator6.address))
                .lastClaimRound
            const lcrPool =
                await bondingManager.getTranscoderEarningsPoolForRound(
                    transcoder1.address,
                    lcr
                )
            assert.ok(lcrPool.cumulativeRewardFactor.isZero())
            // Ensure that a cumulative factor is stored for a round prior to the delegator's lastClaimRound and
            // that is prior to the LIP-36 upgrade round
            const pastPool =
                await bondingManager.getTranscoderEarningsPoolForRound(
                    transcoder1.address,
                    lip36Round.toNumber() - 1
                )
            assert.notOk(pastPool.cumulativeRewardFactor.isZero())
            // Less than MAX_LOOKBACK_ROUNDS between lastClaimRound and previous round with non-zero cumulative factor
            assert.isBelow(
                lcr.toNumber() - lip36Round.toNumber() - 1,
                MAX_LOOKBACK_ROUNDS
            )
            assert.isBelow(lip36Round.toNumber(), lcr.toNumber())

            const cr = await roundsManager.currentRound()
            // delegator6 should have greater stake than delegator1 because they are both
            // delegated to transcoder1 and delegator6 delegated to transcoder1 before its reward call
            // while delegator1 delegated to transcoder1 after its reward call
            // transcoder1 triggered the bug allowing a cumulative factor to be stored for a round prior
            // to the LIP-36 upgrade round, but as long as the lookback for delegator6 stops at the LIP-36 upgrade round
            // the stake for delegator6 should be calculated correctly
            const ps1 = await bondingManager.pendingStake(
                delegator6.address,
                cr
            )
            const ps2 = await bondingManager.pendingStake(
                delegator1.address,
                cr
            )

            expect(ps1).to.be.gt(ps2)
        })

        it("does not lookback past MAX_LOOKBACK_ROUNDS", async () => {
            const cr = await roundsManager.currentRound()

            // > MAX_LOOKBACK_ROUNDS
            const ps1 =
                pendingStakeHistory[delegator5.address][cr.toNumber() - 1]
            const ps2 = await bondingManager.pendingStake(
                delegator5.address,
                cr
            )

            // This should not happen on mainnet because we never have to lookback further than MAX_LOOKBACK_ROUNDS
            assert.notEqual(ps1.toString(), ps2.toString())

            const gas1 = await bondingManager.estimateGas.pendingStake(
                delegator5.address,
                cr
            )

            await roundsManager.mineBlocks(roundLength.toNumber() * 2)
            await roundsManager.initializeRound()

            const gas2 = await bondingManager.estimateGas.pendingStake(
                delegator5.address,
                cr
            )

            // Gas should not change
            assert.equal(gas1.toString(), gas2.toString())
        })

        it("persists the correct values when claiming", async () => {
            const cr = await roundsManager.currentRound()

            const ps1 = await bondingManager.pendingStake(
                delegator1.address,
                cr
            )
            const ps3 = await bondingManager.pendingStake(
                delegator3.address,
                cr
            )
            const pf2 = await bondingManager.pendingFees(delegator2.address, cr)
            const pf4 = await bondingManager.pendingFees(delegator4.address, cr)

            await bondingManager.connect(delegator1).claimEarnings(cr)
            await bondingManager.connect(delegator2).claimEarnings(cr)
            await bondingManager.connect(delegator3).claimEarnings(cr)
            await bondingManager.connect(delegator4).claimEarnings(cr)

            const del1 = await bondingManager.getDelegator(delegator1.address)
            const del2 = await bondingManager.getDelegator(delegator2.address)
            const del3 = await bondingManager.getDelegator(delegator3.address)
            const del4 = await bondingManager.getDelegator(delegator4.address)

            assert.equal(del1.bondedAmount.toString(), ps1.toString())
            assert.equal(del3.bondedAmount.toString(), ps3.toString())
            assert.equal(del2.fees.toString(), pf2.toString())
            assert.equal(del4.fees.toString(), pf4.toString())
        })
    })
})

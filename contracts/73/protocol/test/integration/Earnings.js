import {constants} from "../../utils/constants"
import {contractId} from "../../utils/helpers"
import executeLIP36Upgrade from "../helpers/executeLIP36Upgrade"
import {createWinningTicket, getTicketHash} from "../helpers/ticket"
import signMsg from "../helpers/signMsg"
import math from "../helpers/math"

import {deployments, ethers} from "hardhat"

import chai, {assert, expect} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("Earnings", accounts => {
    let controller
    let bondingManager
    let bondingProxy
    let roundsManager
    let token
    let broker

    let signers
    let transcoder
    let broadcaster
    let delegator
    let transcoder2

    const rewardCut = 50 * constants.PERC_MULTIPLIER // 50%
    const feeShare = 25 * constants.PERC_MULTIPLIER // 25%

    const transcoderStake = 1000
    const delegatorStake = 3000

    let roundLength

    const NUM_ACTIVE_TRANSCODERS = 2
    const UNBONDING_PERIOD = 2
    const MAX_EARNINGS_CLAIMS_ROUNDS = 20

    const faceValue = ethers.utils.parseEther("0.1")

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
            faceValue,
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
        transcoder = signers[0]
        broadcaster = signers[1]
        delegator = signers[2]
        transcoder2 = signers[3]

        const fixture = await deployments.fixture(["Contracts"])
        controller = await ethers.getContractAt(
            "Controller",
            fixture.Controller.address
        )
        await controller.unpause()

        const bondingTarget = await (
            await ethers.getContractFactory("BondingManagerPreLIP36", {
                libraries: {
                    SortedDoublyLL: fixture.SortedDoublyLL.address
                }
            })
        ).deploy(controller.address)
        await controller.setContractInfo(
            contractId("BondingManagerTarget"),
            bondingTarget.address,
            "0x3031323334353637383930313233343536373839"
        )
        bondingProxy = await (
            await ethers.getContractFactory("ManagerProxy")
        ).deploy(controller.address, contractId("BondingManagerTarget"))
        await controller.setContractInfo(
            contractId("BondingManager"),
            bondingProxy.address,
            "0x3031323334353637383930313233343536373839"
        )
        bondingManager = await ethers.getContractAt(
            "BondingManagerPreLIP36",
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

        // transfer tokens to transcoder and delegator
        const amount = ethers.utils.parseEther("10")
        await token.transfer(transcoder.address, amount)
        await token.transfer(delegator.address, amount)

        roundLength = await roundsManager.roundLength()
        await roundsManager.mineBlocks(roundLength.toNumber() * 10)
        await roundsManager.setBlockHash(web3.utils.keccak256("foo"))
        await roundsManager.initializeRound()

        // Register transcoder
        await token
            .connect(transcoder)
            .approve(bondingManager.address, transcoderStake)
        await bondingManager
            .connect(transcoder)
            .bond(transcoderStake, transcoder.address)
        await bondingManager.connect(transcoder).transcoder(rewardCut, feeShare)

        // Delegate from delegator
        await token
            .connect(delegator)
            .approve(bondingManager.address, delegatorStake)
        await bondingManager
            .connect(delegator)
            .bond(delegatorStake, transcoder.address)

        const deposit = ethers.utils.parseEther("5")
        await broker.connect(broadcaster).fundDeposit({value: deposit})
        const reserve = ethers.utils.parseEther("5")
        await broker.connect(broadcaster).fundReserve({value: reserve})
    })

    const getStake = async addr => {
        const currentRound = await roundsManager.currentRound()
        return await bondingManager.pendingStake(addr, currentRound)
    }

    const getFees = async addr => {
        const currentRound = await roundsManager.currentRound()
        return await bondingManager.pendingFees(addr, currentRound)
    }

    const oldEarningsAndCheck = async () => {
        const acceptableDelta = ethers.utils.parseEther("0.001")

        const transcoderStartStake = await getStake(transcoder.address)
        const delegatorStartStake = await getStake(delegator.address)
        const totalStartStake = transcoderStartStake.add(delegatorStartStake)

        const transcoderStartFees = await getFees(transcoder.address)
        const delegatorStartFees = await getFees(delegator.address)

        await bondingManager.connect(transcoder).reward()
        await redeemWinningTicket(transcoder, broadcaster, faceValue)

        const currentRound = await roundsManager.currentRound()

        const earningsPool =
            await bondingManager.getTranscoderEarningsPoolForRound(
                transcoder.address,
                currentRound
            )
        const delegatorRewardPool = earningsPool.rewardPool
        const transcoderRewardPool = earningsPool.transcoderRewardPool
        const delegatorFeePool = earningsPool.feePool
        const transcoderFeePool = earningsPool.transcoderFeePool

        const expTRewardShare = delegatorRewardPool
            .mul(transcoderStartStake)
            .div(totalStartStake)
            .add(transcoderRewardPool)
        const expDRewardShare = delegatorRewardPool
            .mul(delegatorStartStake)
            .div(totalStartStake)
        const expTFees = delegatorFeePool
            .mul(transcoderStartStake)
            .div(totalStartStake)
            .add(transcoderFeePool)
        const expDFees = delegatorFeePool
            .mul(delegatorStartStake)
            .div(totalStartStake)

        const transcoderEndStake = await bondingManager.pendingStake(
            transcoder.address,
            currentRound
        )
        const delegatorEndStake = await bondingManager.pendingStake(
            delegator.address,
            currentRound
        )
        const transcoderEndFees = await bondingManager.pendingFees(
            transcoder.address,
            currentRound
        )
        const delegatorEndFees = await bondingManager.pendingFees(
            delegator.address,
            currentRound
        )

        const transcoderRewardShare =
            transcoderEndStake.sub(transcoderStartStake)
        const delegatorRewardShare = delegatorEndStake.sub(delegatorStartStake)
        const transcoderFees = transcoderEndFees.sub(transcoderStartFees)
        const delegatorFees = delegatorEndFees.sub(delegatorStartFees)

        assert.isOk(
            transcoderRewardShare
                .sub(expTRewardShare)
                .abs()
                .lte(acceptableDelta)
        )
        assert.isOk(
            delegatorRewardShare.sub(expDRewardShare).abs().lte(acceptableDelta)
        )
        assert.isOk(transcoderFees.sub(expTFees).abs().lte(acceptableDelta))
        assert.isOk(delegatorFees.sub(expDFees).abs().lte(acceptableDelta))
    }

    const cumulativeEarningsAndCheck = async () => {
        const acceptableDelta = 0

        const calcRewardShare = (
            startStake,
            startRewardFactor,
            endRewardFactor
        ) => {
            return math.precise
                .percOf(startStake, endRewardFactor, startRewardFactor)
                .sub(startStake)
        }

        const calcFeeShare = (
            startStake,
            startFeeFactor,
            endFeeFactor,
            startRewardFactor
        ) => {
            return math.precise.percOf(
                startStake,
                endFeeFactor.sub(startFeeFactor),
                startRewardFactor
            )
        }

        const transcoderDel = await bondingManager.getDelegator(
            transcoder.address
        )
        const delegatorDel = await bondingManager.getDelegator(
            delegator.address
        )
        let transcoderStartStake = transcoderDel.bondedAmount
        let delegatorStartStake = delegatorDel.bondedAmount
        let transcoderStartFees = transcoderDel.fees
        let delegatorStartFees = delegatorDel.fees

        const lastClaimRoundTranscoder = transcoderDel.lastClaimRound

        const LIP36Round = await roundsManager.lipUpgradeRound(36)
        const LIP36EarningsPool =
            await bondingManager.getTranscoderEarningsPoolForRound(
                transcoder.address,
                LIP36Round
            )
        if (lastClaimRoundTranscoder.lte(LIP36Round)) {
            const round = LIP36EarningsPool.hasTranscoderRewardFeePool ?
                LIP36Round :
                LIP36Round.sub(1)
            transcoderStartStake = await bondingManager.pendingStake(
                transcoder.address,
                round
            )
            delegatorStartStake = await bondingManager.pendingStake(
                delegator.address,
                round
            )
            transcoderStartFees = await bondingManager.pendingFees(
                transcoder.address,
                round
            )
            delegatorStartFees = await bondingManager.pendingFees(
                delegator.address,
                round
            )
        }

        // pendingStake() and pendingFees() need to be called before reward/fee
        // generation to get starting stake and fees
        await bondingManager.connect(transcoder).reward()
        await redeemWinningTicket(transcoder, broadcaster, faceValue)

        const currentRound = await roundsManager.currentRound()

        const transC = await bondingManager.getTranscoder(transcoder.address)
        const startEarningsPool =
            await bondingManager.getTranscoderEarningsPoolForRound(
                transcoder.address,
                lastClaimRoundTranscoder
            )
        let startRewardFactor = startEarningsPool.cumulativeRewardFactor
        startRewardFactor = startRewardFactor.gt(0) ?
            startRewardFactor :
            constants.PERC_DIVISOR_PRECISE

        const startFeeFactor = startEarningsPool.cumulativeFeeFactor
        const endEarningsPool =
            await bondingManager.getTranscoderEarningsPoolForRound(
                transcoder.address,
                currentRound
            )
        let endRewardFactor = endEarningsPool.cumulativeRewardFactor
        if (endRewardFactor.eq(0)) {
            let lastRewFactor =
                await bondingManager.getTranscoderEarningsPoolForRound(
                    transcoder.address,
                    transC.lastRewardRound
                )
            lastRewFactor = lastRewFactor.gt(0) ?
                lastRewFactor :
                constants.PERC_DIVISOR_PRECISE
            endRewardFactor = lastRewFactor
        }

        const endFeeFactor = endEarningsPool.cumulativeFeeFactor.gt(0) ?
            endEarningsPool.cumulativeFeeFactor :
            (
                await bondingManager.getTranscoderEarningsPoolForRound(
                    transcoder.address,
                    transC.lastFeeRound
                )
            ).cumulativeFeeFactor
        const transcoderRewards = transC.cumulativeRewards
        const transcoderFees = transC.cumulativeFees

        const expTranscoderRewardShare = calcRewardShare(
            transcoderStartStake,
            startRewardFactor,
            endRewardFactor
        ).add(transcoderRewards)
        const expDelegatorRewardShare = calcRewardShare(
            delegatorStartStake,
            startRewardFactor,
            endRewardFactor
        )
        const expTranscoderFeeShare = calcFeeShare(
            transcoderStartStake,
            startFeeFactor,
            endFeeFactor,
            startRewardFactor
        ).add(transcoderFees)
        const expDelegatorFeeShare = calcFeeShare(
            delegatorStartStake,
            startFeeFactor,
            endFeeFactor,
            startRewardFactor
        )

        const transcoderEndStake = await bondingManager.pendingStake(
            transcoder.address,
            currentRound
        )
        const delegatorEndStake = await bondingManager.pendingStake(
            delegator.address,
            currentRound
        )
        const transcoderEndFees = await bondingManager.pendingFees(
            transcoder.address,
            currentRound
        )
        const delegatorEndFees = await bondingManager.pendingFees(
            delegator.address,
            currentRound
        )

        const transcoderRewardShare =
            transcoderEndStake.sub(transcoderStartStake)
        const delegatorRewardShare = delegatorEndStake.sub(delegatorStartStake)
        const transcoderFeeShare = transcoderEndFees.sub(transcoderStartFees)
        const delegatorFeeShare = delegatorEndFees.sub(delegatorStartFees)

        assert.isOk(
            transcoderRewardShare
                .sub(expTranscoderRewardShare)
                .abs()
                .lte(acceptableDelta)
        )
        assert.isOk(
            delegatorRewardShare
                .sub(expDelegatorRewardShare)
                .abs()
                .lte(acceptableDelta)
        )
        assert.isOk(
            transcoderFeeShare
                .sub(expTranscoderFeeShare)
                .abs()
                .lte(acceptableDelta)
        )
        assert.isOk(
            delegatorFeeShare
                .sub(expDelegatorFeeShare)
                .abs()
                .lte(acceptableDelta)
        )
    }

    const claimEarningsAndCheckStakes = async () => {
        const acceptableDelta = ethers.utils.parseEther("0.001")

        const currentRound = await roundsManager.currentRound()

        const transcoderStartStake = await getStake(transcoder.address)
        const delegatorStartStake = await getStake(delegator.address)
        const transcoderStartFees = await getFees(transcoder.address)
        const delegatorStartFees = await getFees(delegator.address)

        await bondingManager.connect(transcoder).claimEarnings(currentRound)
        await bondingManager.connect(delegator).claimEarnings(currentRound)

        const transcoderDel = await bondingManager.getDelegator(
            transcoder.address
        )
        const delegatorDel = await bondingManager.getDelegator(
            delegator.address
        )
        const transcoderEndStake = transcoderDel.bondedAmount
        const delegatorEndStake = delegatorDel.bondedAmount
        const transcoderEndFees = transcoderDel.fees
        const delegatorEndFees = delegatorDel.fees
        assert.isOk(
            transcoderEndStake
                .sub(transcoderStartStake)
                .abs()
                .lte(acceptableDelta)
        )
        assert.isOk(
            delegatorEndStake
                .sub(delegatorStartStake)
                .abs()
                .lte(acceptableDelta)
        )
        assert.isOk(
            transcoderEndFees
                .sub(transcoderStartFees)
                .abs()
                .lte(acceptableDelta)
        )
        assert.isOk(
            delegatorEndFees.sub(delegatorStartFees).abs().lte(acceptableDelta)
        )
        assert.equal(
            transcoderDel.lastClaimRound.toString(),
            currentRound.toString()
        )
        assert.equal(
            delegatorDel.lastClaimRound.toString(),
            currentRound.toString()
        )
    }

    describe("earnings before LIP-36", async () => {
        beforeEach(async () => {
            await roundsManager.mineBlocks(roundLength.toNumber())
            await roundsManager.initializeRound()
        })

        it("calculates earnings for one round before LIP-36", async () => {
            await oldEarningsAndCheck()
        })

        it("calculates earnings for two rounds before LIP-36", async () => {
            await oldEarningsAndCheck()
        })

        it("claims earnings for rounds before LIP-36", async () => {
            await claimEarningsAndCheckStakes()
        })
    })

    describe("earnings before and after LIP-36 combined", async () => {
        beforeEach(async () => {
            await roundsManager.mineBlocks(roundLength.toNumber())
            await roundsManager.initializeRound()
        })

        it("calculates earnings before LIP-36", async () => {
            await oldEarningsAndCheck()
        })

        it("calculates earnings and deploys LIP-36", async () => {
            await oldEarningsAndCheck()
            bondingManager = await executeLIP36Upgrade(
                controller,
                roundsManager,
                bondingProxy.address
            )
        })

        it("calculates earnings after LIP-36", async () => {
            await cumulativeEarningsAndCheck()
        })

        it("claims earnings for rounds before and after LIP-36 combined", async () => {
            await claimEarningsAndCheckStakes()
        })
    })

    describe("earnings after LIP-36", async () => {
        it("calculates earnings after LIP-36 for multiple rounds", async () => {
            for (let i = 0; i < 10; i++) {
                await roundsManager.mineBlocks(roundLength.toNumber())
                await roundsManager.initializeRound()
                await cumulativeEarningsAndCheck()
            }
        })

        it("claims earnings after LIP-36", async () => {
            await claimEarningsAndCheckStakes()
        })

        it("calculates earnings after LIP-36 when a delegator moves stake to a transcoder that did not call reward in current round", async () => {
            // Register and activate transcoder
            // Ensure that transcoder2 earns rewards by giving it the same stake as transcoder
            const amount = await getStake(transcoder.address)
            await token.transfer(transcoder2.address, amount)
            await token
                .connect(transcoder2)
                .approve(bondingManager.address, amount)
            await bondingManager
                .connect(transcoder2)
                .bond(amount, transcoder2.address)
            await bondingManager
                .connect(transcoder2)
                .transcoder(rewardCut, feeShare)

            await roundsManager.mineBlocks(roundLength.toNumber())
            await roundsManager.initializeRound()

            await bondingManager.connect(transcoder2).reward()
            await redeemWinningTicket(transcoder2, broadcaster, faceValue)

            const cr = await roundsManager.currentRound()
            const initialPool =
                await bondingManager.getTranscoderEarningsPoolForRound(
                    transcoder2.address,
                    cr
                )

            await roundsManager.mineBlocks(roundLength.toNumber())
            await roundsManager.initializeRound()

            await bondingManager.connect(delegator).bond(0, transcoder2.address)

            await bondingManager.connect(transcoder).reward()
            // No reward call from transcoder2

            const startStake = await getStake(delegator.address)
            const startFees = await getFees(delegator.address)

            await roundsManager.mineBlocks(roundLength.toNumber())
            await roundsManager.initializeRound()

            const endStake = await getStake(delegator.address)
            const endFees = await getFees(delegator.address)

            const t2Stake = await getStake(transcoder2.address)

            const del = await bondingManager.getDelegator(delegator.address)
            const lastClaimPool =
                await bondingManager.getTranscoderEarningsPoolForRound(
                    del.delegateAddress,
                    del.lastClaimRound
                )

            assert.equal(
                startStake.toString(),
                endStake.toString(),
                "invalid stake"
            )
            assert.equal(
                startFees.toString(),
                endFees.toString(),
                "invalid fees"
            )
            assert.equal(
                lastClaimPool.cumulativeRewardFactor.toString(),
                initialPool.cumulativeRewardFactor.toString(),
                "invalid cumulative reward factor"
            )
            assert.equal(
                lastClaimPool.cumulativeFeeFactor.toString(),
                initialPool.cumulativeFeeFactor.toString(),
                "invalid cumulative fee factor"
            )

            // transcoder 2 should still be able to unbond and withdraw all funds
            await bondingManager.connect(transcoder2).unbond(t2Stake)
            await bondingManager.connect(delegator).unbond(endStake)

            await roundsManager.mineBlocks(
                roundLength.toNumber() * UNBONDING_PERIOD
            )
            await roundsManager.initializeRound()

            assert.ok(
                await Promise.all([
                    bondingManager.connect(transcoder2).withdrawStake(0),
                    bondingManager.connect(delegator).withdrawStake(0),
                    bondingManager.connect(transcoder2).withdrawFees(),
                    bondingManager.connect(delegator).withdrawFees()
                ])
            )
        })

        it("calculates earnings after LIP-36 when a delegator bonds from unbonded to a transcoder that did not call reward in the current round", async () => {
            // New delegator
            const delegator4 = signers[4]
            const amount = 5000
            await token.transfer(delegator4.address, 5000)

            await roundsManager.mineBlocks(roundLength.toNumber())
            await roundsManager.initializeRound()

            // call reward for transcoder and get initial earnings pool
            await bondingManager.connect(transcoder).reward()
            await redeemWinningTicket(transcoder, broadcaster, faceValue)

            const cr = await roundsManager.currentRound()
            const initialPool =
                await bondingManager.getTranscoderEarningsPoolForRound(
                    transcoder.address,
                    cr
                )

            await roundsManager.mineBlocks(roundLength.toNumber())
            await roundsManager.initializeRound()

            // bond to transcoder
            await token
                .connect(delegator4)
                .approve(bondingManager.address, amount)
            await bondingManager
                .connect(delegator4)
                .bond(amount, transcoder.address)

            // no reward call from transcoder in this round

            const startStake = await getStake(delegator4.address)
            const startFees = await getFees(delegator4.address)

            await roundsManager.mineBlocks(roundLength.toNumber())
            await roundsManager.initializeRound()

            const endStake = await getStake(delegator4.address)
            const endFees = await getFees(delegator4.address)

            const tStake = await getStake(transcoder.address)

            const del = await bondingManager.getDelegator(delegator4.address)
            const lastClaimPool =
                await bondingManager.getTranscoderEarningsPoolForRound(
                    del.delegateAddress,
                    del.lastClaimRound
                )

            assert.equal(
                startStake.toString(),
                endStake.toString(),
                "invalid stake"
            )
            assert.equal(
                startFees.toString(),
                endFees.toString(),
                "invalid fees"
            )
            assert.equal(
                lastClaimPool.cumulativeRewardFactor.toString(),
                initialPool.cumulativeRewardFactor.toString(),
                "invalid cumulative reward factor"
            )
            assert.equal(
                lastClaimPool.cumulativeFeeFactor.toString(),
                initialPool.cumulativeFeeFactor.toString(),
                "invalid cumulative fee factor"
            )

            // transcoder 2 should still be able to unbond and withdraw all funds
            await bondingManager.connect(transcoder).unbond(tStake)
            await bondingManager.connect(delegator4).unbond(endStake)

            await roundsManager.mineBlocks(
                roundLength.toNumber() * UNBONDING_PERIOD
            )
            await roundsManager.initializeRound()

            assert.ok(
                await Promise.all([
                    bondingManager.connect(transcoder).withdrawStake(0),
                    bondingManager.connect(delegator4).withdrawStake(0),
                    bondingManager.connect(transcoder).withdrawFees()
                ])
            )

            // delegator hasn't earned fees so should revert
            await expect(
                bondingManager.connect(delegator4).withdrawFees()
            ).to.be.revertedWith("no fees to withdraw")
        })
    })
})

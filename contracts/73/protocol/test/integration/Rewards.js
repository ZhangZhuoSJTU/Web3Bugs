import {constants} from "../../utils/constants"
import math from "../helpers/math"

import chai, {expect} from "chai"
import {solidity} from "ethereum-waffle"
import {ethers} from "hardhat"

chai.use(solidity)

describe("Rewards", () => {
    let controller
    let bondingManager
    let roundsManager
    let token

    let transcoder1
    let delegator1
    let delegator2
    let delegator3

    let rewardCut
    let feeShare
    let transcoder1StartStake
    let delegator1StartStake
    let delegator2StartStake
    let delegator3StartStake

    let roundLength

    before(async () => {
        const signers = await ethers.getSigners()

        transcoder1 = signers[0]
        delegator1 = signers[2]
        delegator2 = signers[3]
        delegator3 = signers[4]

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

        const transferAmount = ethers.BigNumber.from(10).mul(
            constants.TOKEN_UNIT.toString()
        )
        await token
            .connect(signers[0])
            .transfer(transcoder1.address, transferAmount)
        await token
            .connect(signers[0])
            .transfer(delegator1.address, transferAmount)
        await token
            .connect(signers[0])
            .transfer(delegator2.address, transferAmount)
        await token
            .connect(signers[0])
            .transfer(delegator3.address, transferAmount)

        roundLength = await roundsManager.roundLength()
        await roundsManager.mineBlocks(roundLength.mul(1000))
        await roundsManager.initializeRound()

        rewardCut = 50 // 50%
        feeShare = 5 // 5%
        transcoder1StartStake = 1000
        delegator1StartStake = 3000
        delegator2StartStake = 3000
        delegator3StartStake = 3000

        // Register transcoder 1
        await token
            .connect(transcoder1)
            .approve(bondingManager.address, transcoder1StartStake)
        await bondingManager
            .connect(transcoder1)
            .bond(transcoder1StartStake, transcoder1.address)
        await bondingManager
            .connect(transcoder1)
            .transcoder(
                rewardCut * constants.PERC_MULTIPLIER,
                feeShare * constants.PERC_MULTIPLIER
            )

        // Delegator 1 delegates to transcoder 1
        await token
            .connect(delegator1)
            .approve(bondingManager.address, delegator1StartStake)
        await bondingManager
            .connect(delegator1)
            .bond(delegator1StartStake, transcoder1.address)

        // Delegator 2 delegates to transcoder 1
        await token
            .connect(delegator2)
            .approve(bondingManager.address, delegator2StartStake)
        await bondingManager
            .connect(delegator2)
            .bond(delegator2StartStake, transcoder1.address)

        // Delegator 3 delegates to transcoder 1
        await token
            .connect(delegator3)
            .approve(bondingManager.address, delegator3StartStake)
        await bondingManager
            .connect(delegator3)
            .bond(delegator3StartStake, transcoder1.address)

        await roundsManager.mineBlocks(roundLength)
        await roundsManager.initializeRound()
    })

    it("correctly calculates reward shares for delegators and transcoders", async () => {
        const callRewardAndCheckStakes = async () => {
            const calcRewardShare = (
                startStake,
                startRewardFactor,
                endRewardFactor
            ) => {
                return math.precise
                    .percOf(
                        startStake,
                        endRewardFactor,
                        startRewardFactor.toString()
                    )
                    .sub(startStake)
            }
            const acceptableDelta = ethers.BigNumber.from(
                constants.TOKEN_UNIT.toString()
            ).div(1000) // .001

            const t1StartStake = (
                await bondingManager.getDelegator(transcoder1.address)
            ).bondedAmount
            const d1StartStake = (
                await bondingManager.getDelegator(delegator1.address)
            ).bondedAmount
            const d2StartStake = (
                await bondingManager.getDelegator(delegator2.address)
            ).bondedAmount
            const d3StartStake = (
                await bondingManager.getDelegator(delegator3.address)
            ).bondedAmount

            await bondingManager.connect(transcoder1).reward()

            const currentRound = await roundsManager.currentRound()

            const lastClaimRoundT1 = (
                await bondingManager.getDelegator(transcoder1.address)
            ).lastClaimRound
            let startRewardFactor = (
                await bondingManager.getTranscoderEarningsPoolForRound(
                    transcoder1.address,
                    lastClaimRoundT1
                )
            ).cumulativeRewardFactor
            startRewardFactor =
                startRewardFactor.toString() != "0" ?
                    startRewardFactor :
                    constants.PERC_DIVISOR_PRECISE
            const endRewardFactor = (
                await bondingManager.getTranscoderEarningsPoolForRound(
                    transcoder1.address,
                    currentRound
                )
            ).cumulativeRewardFactor
            const transcoderRewards = (
                await bondingManager.getTranscoder(transcoder1.address)
            ).cumulativeRewards

            const expT1RewardShare = calcRewardShare(
                t1StartStake,
                startRewardFactor,
                endRewardFactor
            ).add(transcoderRewards)
            const expD1RewardShare = calcRewardShare(
                d1StartStake,
                startRewardFactor,
                endRewardFactor
            )
            const expD2RewardShare = calcRewardShare(
                d2StartStake,
                startRewardFactor,
                endRewardFactor
            )
            const expD3RewardShare = calcRewardShare(
                d3StartStake,
                startRewardFactor,
                endRewardFactor
            )

            const t1Stake = await bondingManager.pendingStake(
                transcoder1.address,
                currentRound
            )
            const d1Stake = await bondingManager.pendingStake(
                delegator1.address,
                currentRound
            )
            const d2Stake = await bondingManager.pendingStake(
                delegator2.address,
                currentRound
            )
            const d3Stake = await bondingManager.pendingStake(
                delegator3.address,
                currentRound
            )

            const t1RewardShare = t1Stake.sub(t1StartStake.toString())
            const d1RewardShare = d1Stake.sub(d1StartStake.toString())
            const d2RewardShare = d2Stake.sub(d2StartStake.toString())
            const d3RewardShare = d3Stake.sub(d3StartStake.toString())

            expect(t1RewardShare.sub(expT1RewardShare.toString())).to.be.lte(
                acceptableDelta
            )
            expect(d1RewardShare.sub(expD1RewardShare.toString())).to.be.lte(
                acceptableDelta
            )
            expect(d2RewardShare.sub(expD2RewardShare.toString())).to.be.lte(
                acceptableDelta
            )
            expect(d3RewardShare.sub(expD3RewardShare.toString())).to.be.lte(
                acceptableDelta
            )
        }

        const claimEarningsAndCheckStakes = async () => {
            const acceptableDelta = ethers.BigNumber.from(
                constants.TOKEN_UNIT.toString()
            ).div(1000) // .001

            const currentRound = await roundsManager.currentRound()

            const t1StartStake = await bondingManager.pendingStake(
                transcoder1.address,
                currentRound
            )
            const d1StartStake = await bondingManager.pendingStake(
                delegator1.address,
                currentRound
            )
            const d2StartStake = await bondingManager.pendingStake(
                delegator2.address,
                currentRound
            )
            const d3StartStake = await bondingManager.pendingStake(
                delegator3.address,
                currentRound
            )

            await bondingManager
                .connect(transcoder1)
                .claimEarnings(currentRound)
            await bondingManager.connect(delegator1).claimEarnings(currentRound)
            await bondingManager.connect(delegator2).claimEarnings(currentRound)
            await bondingManager.connect(delegator3).claimEarnings(currentRound)

            const t1Stake = (
                await bondingManager.getDelegator(transcoder1.address)
            ).bondedAmount
            const d1Stake = (
                await bondingManager.getDelegator(delegator1.address)
            ).bondedAmount
            const d2Stake = (
                await bondingManager.getDelegator(delegator2.address)
            ).bondedAmount
            const d3Stake = (
                await bondingManager.getDelegator(delegator3.address)
            ).bondedAmount

            expect(t1Stake.sub(t1StartStake)).to.be.lte(acceptableDelta)
            expect(d1Stake.sub(d1StartStake)).to.be.lte(acceptableDelta)
            expect(d2Stake.sub(d2StartStake)).to.be.lte(acceptableDelta)
            expect(d3Stake.sub(d3StartStake)).to.be.lte(acceptableDelta)
        }

        await callRewardAndCheckStakes()
        await roundsManager.mineBlocks(roundLength)
        await roundsManager.initializeRound()

        await callRewardAndCheckStakes()

        // Check reward accounting after calling claimEarnings
        await claimEarningsAndCheckStakes()

        await roundsManager.mineBlocks(roundLength)
        await roundsManager.initializeRound()

        await callRewardAndCheckStakes()

        // Check reward accounting after calling claimEarnings
        // Order should not matter - transcoder can claim in the middle
        await claimEarningsAndCheckStakes()

        await roundsManager.mineBlocks(roundLength)
        await roundsManager.initializeRound()

        await callRewardAndCheckStakes()

        // Check reward accounting after calling claimEarnings
        // Order should not matter - transcoder can claim last
        await claimEarningsAndCheckStakes()
    })
})

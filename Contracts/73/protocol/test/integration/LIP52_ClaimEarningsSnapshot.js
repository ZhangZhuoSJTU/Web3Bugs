import {contractId} from "../../utils/helpers"
import {constants} from "../../utils/constants"
import MerkleTree from "../../utils/merkleTree"
import executeLIP36Upgrade from "../helpers/executeLIP36Upgrade"

import {createWinningTicket, getTicketHash} from "../helpers/ticket"
import signMsg from "../helpers/signMsg"

import {keccak256, bufferToHex} from "ethereumjs-util"
import abi from "ethereumjs-abi"

import {deployments, ethers} from "hardhat"

import chai, {assert, expect} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("ClaimEarningsSnapshot", () => {
    let controller
    let bondingManager
    let roundsManager
    let token
    let broker
    let snapshots
    let bondingProxy

    let signers

    let roundLength
    const transferAmount = ethers.utils.parseEther("100")
    const deposit = ethers.utils.parseEther("10")
    const reserve = ethers.utils.parseEther("1")
    const faceValue = ethers.utils.parseEther("0.1")

    const NUM_ACTIVE_TRANSCODERS = 10
    const UNBONDING_PERIOD = 2
    const MAX_EARNINGS_CLAIMS_ROUNDS = 20

    let transcoder1
    let transcoder2
    let transcoder3

    let delegate1
    let delegate2
    let delegate3
    let delegate4
    let delegate5
    let delegate6

    let broadcaster

    let transcoders = []
    let delegates = []

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
        transcoder3 = signers[2]
        delegate1 = signers[3]
        delegate2 = signers[4]
        delegate3 = signers[5]
        delegate4 = signers[6]
        delegate5 = signers[7]
        delegate6 = signers[8]
        broadcaster = signers[9]
        transcoders = [transcoder1, transcoder2, transcoder3]
        delegates = [
            delegate1,
            delegate2,
            delegate3,
            delegate4,
            delegate5,
            delegate6
        ]

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

        bondingManager = await ethers.getContractAt(
            "BondingManager",
            bondingProxy.address
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

        // deploy MerkleSnapshot contract
        snapshots = await (
            await ethers.getContractFactory("MerkleSnapshot")
        ).deploy(controller.address)
        await controller.setContractInfo(
            contractId("MerkleSnapshot"),
            snapshots.address,
            "0x3031323334353637383930313233343536373839"
        )

        // transcoder start stake = 100 LPT
        await Promise.all(
            transcoders.map(t => token.transfer(t.address, transferAmount))
        )
        // delegate start stake = 50 LPT
        await Promise.all(
            delegates.map(d => token.transfer(d.address, transferAmount.div(2)))
        )

        roundLength = await roundsManager.roundLength()
        await roundsManager.mineBlocks(roundLength.toNumber() * 1)
        await roundsManager.initializeRound()

        // approve LPT for bonding
        await Promise.all(
            transcoders.map(t =>
                token.connect(t).approve(bondingManager.address, transferAmount)
            )
        )
        await Promise.all(
            delegates.map(d =>
                token
                    .connect(d)
                    .approve(bondingManager.address, transferAmount.div(2))
            )
        )

        // bond and register transcoders
        await Promise.all(
            transcoders.map(t =>
                bondingManager.connect(t).bond(transferAmount, t.address)
            )
        )
        await Promise.all(
            transcoders.map(t => {
                const rewardCut =
                    Math.floor(Math.random() * 100) * constants.PERC_MULTIPLIER
                const feeShare =
                    Math.floor(Math.random() * 100) * constants.PERC_MULTIPLIER
                bondingManager.connect(t).transcoder(rewardCut, feeShare)
            })
        )

        // delegate to transcoders
        await Promise.all(
            delegates.map((d, i) =>
                bondingManager
                    .connect(d)
                    .bond(
                        transferAmount.div(2),
                        transcoders[i % transcoders.length].address
                    )
            )
        )

        // Deposit funds for broadcaster
        await broker
            .connect(broadcaster)
            .fundDepositAndReserve(deposit, reserve, {
                value: deposit.add(reserve)
            })

        // init new round
        await roundsManager.mineBlocks(roundLength.toNumber())
        await roundsManager.setBlockHash(web3.utils.keccak256("foo"))
        await roundsManager.initializeRound()
    })

    describe("Initial stakes", () => {
        it("checks that transcoders are bonded", async () => {
            const dels = await Promise.all(
                transcoders.map(t => bondingManager.getDelegator(t.address))
            )
            dels.forEach(d => assert.isTrue(d.bondedAmount.eq(transferAmount)))
        })

        it("checks that delegators are bonded", async () => {
            const dels = await Promise.all(
                delegates.map(d => bondingManager.getDelegator(d.address))
            )
            dels.forEach(d =>
                assert.isTrue(d.bondedAmount.eq(transferAmount.div(2)))
            )
        })
    })

    describe("ClaimSnapshotEarnings", () => {
        const elements = []
        let tree
        const id = bufferToHex(keccak256("LIP-52"))
        before(async () => {
            for (let i = 0; i < 10; i++) {
                await Promise.all(
                    transcoders.map(t => bondingManager.connect(t).reward())
                )
                await Promise.all(
                    transcoders.map(t =>
                        redeemWinningTicket(t, broadcaster, faceValue)
                    )
                )
                await roundsManager.mineBlocks(roundLength.toNumber() * 5)
                await roundsManager.setBlockHash(web3.utils.keccak256("foo"))
                await roundsManager.initializeRound()
            }

            // Set LIP-52 upgrade round
            const currentRound = await roundsManager.currentRound()
            await roundsManager.setLIPUpgradeRound(52, currentRound)

            transcoders.forEach(t => {
                elements.push({address: t.address})
            })
            delegates.forEach(d => {
                elements.push({address: d.address})
            })

            const leaves = []
            for (const el of elements) {
                el["pendingStake"] = await bondingManager.pendingStake(
                    el.address,
                    currentRound
                )
                el["pendingFees"] = await bondingManager.pendingFees(
                    el.address,
                    currentRound
                )
                leaves.push(
                    abi.rawEncode(
                        ["address", "uint256", "uint256"],
                        [
                            el.address,
                            el.pendingStake.toString(),
                            el.pendingFees.toString()
                        ]
                    )
                )
            }

            tree = new MerkleTree(leaves)
        })

        it("sets the snapshot root", async () => {
            const root = tree.getHexRoot()
            await snapshots.setSnapshot(id, root)

            assert.equal(await snapshots.snapshot(id), root)
        })

        it("Succesfully verifies the merkle proofs for each delegate", async () => {
            for (const el of elements) {
                const leaf = abi.rawEncode(
                    ["address", "uint256", "uint256"],
                    [
                        el.address,
                        el.pendingStake.toString(),
                        el.pendingFees.toString()
                    ]
                )
                const proof = tree.getHexProof(leaf)
                assert.isTrue(
                    await snapshots.verify(id, proof, keccak256(leaf))
                )
            }
        })

        it("succesfully calls claimSnapShotEarnings and unbond as arbitrary call using the 'data' field for each delegate", async () => {
            bondingManager = await executeLIP36Upgrade(
                controller,
                roundsManager,
                bondingProxy.address
            )

            await roundsManager.mineBlocks(roundLength.toNumber() * 5)
            await roundsManager.initializeRound()

            const endRound = await roundsManager.lipUpgradeRound(52)
            const currentRound = await roundsManager.currentRound()

            for (const el of elements) {
                const delegatorBefore = await bondingManager.getDelegator(
                    el.address
                )
                const pendingStakeBefore = await bondingManager.pendingStake(
                    el.address,
                    currentRound
                )
                const pendingFeesBefore = await bondingManager.pendingFees(
                    el.address,
                    currentRound
                )

                assert.equal(
                    pendingStakeBefore.toString(),
                    el.pendingStake.toString()
                )
                assert.equal(
                    pendingFeesBefore.toString(),
                    el.pendingFees.toString()
                )

                // unbond for initial bonding amount after claiming snapshot earnings
                const data = bondingManager.interface.encodeFunctionData(
                    "unbond",
                    [delegatorBefore.bondedAmount]
                )
                const leaf = abi.rawEncode(
                    ["address", "uint256", "uint256"],
                    [
                        el.address,
                        el.pendingStake.toString(),
                        el.pendingFees.toString()
                    ]
                )
                const proof = tree.getHexProof(leaf)
                const tx = await bondingManager
                    .connect(await ethers.getSigner(el.address))
                    .claimSnapshotEarnings(
                        el.pendingStake,
                        el.pendingFees,
                        proof,
                        data
                    )

                const delegatorAfter = await bondingManager.getDelegator(
                    el.address
                )

                assert.isTrue(
                    delegatorAfter.lastClaimRound.eq(currentRound),
                    "last claim round not correct"
                )
                assert.isTrue(
                    pendingStakeBefore
                        .sub(delegatorBefore.bondedAmount)
                        .eq(delegatorAfter.bondedAmount),
                    "bonded amount not updated after claiming"
                )
                assert.isTrue(
                    pendingFeesBefore.eq(delegatorAfter.fees),
                    "fees not correctly updated after claiming"
                )

                await expect(tx)
                    .to.emit(bondingManager, "EarningsClaimed")
                    .withArgs(
                        delegatorBefore.delegateAddress,
                        el.address,
                        delegatorAfter.bondedAmount,
                        delegatorAfter.fees.sub(delegatorBefore.fees),
                        delegatorBefore.lastClaimRound.add(1),
                        endRound
                    )
            }
        })
    })
})

describe("Including cumulative earnings in the snapshot results in excessive earnings (bug)", () => {
    let controller
    let bondingManager
    let roundsManager
    let token
    let snapshots
    let bondingProxy
    let roundLength

    let transcoder
    let signers

    const NUM_ACTIVE_TRANSCODERS = 10
    const UNBONDING_PERIOD = 2
    const MAX_EARNINGS_CLAIMS_ROUNDS = 20
    const transferAmount = ethers.utils.parseEther("100")

    let leaf
    let proof

    before(async () => {
        signers = await ethers.getSigners()
        transcoder = signers[0]
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

        bondingManager = await ethers.getContractAt(
            "BondingManager",
            bondingProxy.address
        )

        roundsManager = await ethers.getContractAt(
            "AdjustableRoundsManager",
            fixture.AdjustableRoundsManager.address
        )

        token = await ethers.getContractAt(
            "LivepeerToken",
            fixture.LivepeerToken.address
        )

        // deploy MerkleSnapshot contract
        snapshots = await (
            await ethers.getContractFactory("MerkleSnapshot")
        ).deploy(controller.address)
        await controller.setContractInfo(
            contractId("MerkleSnapshot"),
            snapshots.address,
            "0x3031323334353637383930313233343536373839"
        )

        roundLength = await roundsManager.roundLength()
        await roundsManager.mineBlocks(roundLength.toNumber() * 1)
        await roundsManager.initializeRound()

        await token.approve(bondingManager.address, transferAmount)
        await bondingManager.bond(transferAmount, transcoder.address)

        const rewardCut = 50 * constants.PERC_MULTIPLIER
        const feeShare = 50 * constants.PERC_MULTIPLIER
        bondingManager.transcoder(rewardCut, feeShare)

        await roundsManager.mineBlocks(roundLength.toNumber() * 1)
        await roundsManager.setBlockHash(web3.utils.keccak256("foo"))
        await roundsManager.initializeRound()
    })

    describe("set snapshot", () => {
        let elements = []
        let tree
        const id = bufferToHex(keccak256("LIP-52"))
        before(async () => {
            elements = [{address: transcoder.address}]
            for (let i = 0; i < 10; i++) {
                await bondingManager.reward()
                await roundsManager.mineBlocks(roundLength.toNumber() * 1)
                await roundsManager.setBlockHash(web3.utils.keccak256("foo"))
                await roundsManager.initializeRound()
            }

            bondingManager = await executeLIP36Upgrade(
                controller,
                roundsManager,
                bondingProxy.address
            )

            await bondingManager.reward()
            await roundsManager.mineBlocks(roundLength.toNumber() * 1)
            await roundsManager.setBlockHash(web3.utils.keccak256("foo"))
            await roundsManager.initializeRound()

            const currentRound = await roundsManager.currentRound()

            const leaves = []
            for (const el of elements) {
                el["pendingStake"] = await bondingManager.pendingStake(
                    el.address,
                    currentRound
                )
                el["pendingFees"] = await bondingManager.pendingFees(
                    el.address,
                    currentRound
                )
                leaves.push(
                    abi.rawEncode(
                        ["address", "uint256", "uint256"],
                        [
                            el.address,
                            el.pendingStake.toString(),
                            el.pendingFees.toString()
                        ]
                    )
                )
            }

            tree = new MerkleTree(leaves)
        })

        it("checks that transcoder is bonded", async () => {
            assert.isTrue(
                (
                    await bondingManager.getDelegator(transcoder.address)
                ).bondedAmount.eq(transferAmount)
            )
        })

        it("sets the snapshot root", async () => {
            const root = tree.getHexRoot()
            await snapshots.setSnapshot(id, root)

            assert.equal(await snapshots.snapshot(id), root)
        })

        it("Succesfully verifies the merkle proofs for the transcoder", async () => {
            for (const el of elements) {
                leaf = abi.rawEncode(
                    ["address", "uint256", "uint256"],
                    [
                        el.address,
                        el.pendingStake.toString(),
                        el.pendingFees.toString()
                    ]
                )
                proof = tree.getHexProof(leaf)
                assert.isTrue(
                    await snapshots.verify(id, proof, keccak256(leaf))
                )
            }
        })
    })

    describe("Snapshot includes cumulative earnings", async () => {
        before(async () => {
            const lip36Round = await roundsManager.lipUpgradeRound(36)
            await roundsManager.setLIPUpgradeRound(52, lip36Round)
        })

        it("there should be residual rewards (this is a bug)", async () => {
            const currentRound = await roundsManager.currentRound()

            const pendingStake = await bondingManager.pendingStake(
                transcoder.address,
                currentRound
            )
            const data = bondingManager.interface.encodeFunctionData("unbond", [
                pendingStake
            ])
            await bondingManager.claimSnapshotEarnings(
                pendingStake,
                0,
                proof,
                data
            )

            const delegatorAfter = await bondingManager.getDelegator(
                transcoder.address
            )

            assert.isTrue(
                delegatorAfter.lastClaimRound.eq(currentRound),
                "last claim round not correct"
            )
            assert.isTrue(
                delegatorAfter.bondedAmount.toString() != "0",
                "bonded amount not greater than 0"
            )
        })
    })
})

describe("Snapshot only existing out of pre-LIP36 earnings should yield correct results", accounts => {
    let controller
    let bondingManager
    let roundsManager
    let token
    let snapshots
    let bondingProxy

    let roundLength

    let transcoder
    let signers

    const NUM_ACTIVE_TRANSCODERS = 10
    const UNBONDING_PERIOD = 2
    const MAX_EARNINGS_CLAIMS_ROUNDS = 20
    const transferAmount = ethers.utils.parseEther("100")

    let elements
    let leaf
    let proof
    let tree

    before(async () => {
        signers = await ethers.getSigners()
        transcoder = signers[0]
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

        bondingManager = await ethers.getContractAt(
            "BondingManager",
            bondingProxy.address
        )

        roundsManager = await ethers.getContractAt(
            "AdjustableRoundsManager",
            fixture.AdjustableRoundsManager.address
        )

        token = await ethers.getContractAt(
            "LivepeerToken",
            fixture.LivepeerToken.address
        )

        // deploy MerkleSnapshot contract
        snapshots = await (
            await ethers.getContractFactory("MerkleSnapshot")
        ).deploy(controller.address)
        await controller.setContractInfo(
            contractId("MerkleSnapshot"),
            snapshots.address,
            "0x3031323334353637383930313233343536373839"
        )

        roundLength = await roundsManager.roundLength()
        await roundsManager.mineBlocks(roundLength.toNumber() * 1)
        await roundsManager.initializeRound()

        await token.approve(bondingManager.address, transferAmount)
        await bondingManager.bond(transferAmount, transcoder.address)

        const rewardCut = 50 * constants.PERC_MULTIPLIER
        const feeShare = 50 * constants.PERC_MULTIPLIER
        bondingManager.transcoder(rewardCut, feeShare)

        await roundsManager.mineBlocks(roundLength.toNumber() * 1)
        await roundsManager.setBlockHash(web3.utils.keccak256("foo"))
        await roundsManager.initializeRound()
    })

    describe("set snapshot", () => {
        const id = bufferToHex(keccak256("LIP-52"))

        before(async () => {
            elements = [{address: transcoder.address}]
            for (let i = 0; i < 10; i++) {
                await bondingManager.reward()
                await roundsManager.mineBlocks(roundLength.toNumber() * 1)
                await roundsManager.setBlockHash(web3.utils.keccak256("foo"))
                await roundsManager.initializeRound()
            }

            const snapshotRound = (await roundsManager.currentRound()).sub(1)

            bondingManager = await executeLIP36Upgrade(
                controller,
                roundsManager,
                bondingProxy.address
            )

            await bondingManager.reward()
            await roundsManager.mineBlocks(roundLength.toNumber() * 1)
            await roundsManager.setBlockHash(web3.utils.keccak256("foo"))
            await roundsManager.initializeRound()

            const leaves = []
            for (const el of elements) {
                el["pendingStake"] = await bondingManager.pendingStake(
                    el.address,
                    snapshotRound
                )
                el["pendingFees"] = await bondingManager.pendingFees(
                    el.address,
                    snapshotRound
                )
                leaves.push(
                    abi.rawEncode(
                        ["address", "uint256", "uint256"],
                        [
                            el.address,
                            el.pendingStake.toString(),
                            el.pendingFees.toString()
                        ]
                    )
                )
            }

            tree = new MerkleTree(leaves)
        })

        it("checks that transcoder is bonded", async () => {
            assert.isTrue(
                (
                    await bondingManager.getDelegator(transcoder.address)
                ).bondedAmount.eq(transferAmount)
            )
        })

        it("sets the snapshot root", async () => {
            const root = tree.getHexRoot()
            await snapshots.setSnapshot(id, root)

            assert.equal(await snapshots.snapshot(id), root)
        })

        it("Succesfully verifies the merkle proofs for the transcoder", async () => {
            for (const el of elements) {
                leaf = abi.rawEncode(
                    ["address", "uint256", "uint256"],
                    [
                        el.address,
                        el.pendingStake.toString(),
                        el.pendingFees.toString()
                    ]
                )
                proof = tree.getHexProof(leaf)
                assert.isTrue(
                    await snapshots.verify(id, proof, keccak256(leaf))
                )
            }
        })
    })

    describe("No cumulative snapshot earnings", async () => {
        before(async () => {
            const lip36Round = await roundsManager.lipUpgradeRound(36)
            await roundsManager.setLIPUpgradeRound(52, lip36Round.sub(1))
        })

        it("should claim all pending rewards", async () => {
            const currentRound = await roundsManager.currentRound()

            const pendingStake = await bondingManager.pendingStake(
                transcoder.address,
                currentRound
            )
            bondingManager.interface.encodeFunctionData("unbond", [
                pendingStake
            ])
            const data = bondingManager.interface.encodeFunctionData("unbond", [
                pendingStake
            ])
            await bondingManager.claimSnapshotEarnings(
                elements[0].pendingStake,
                0,
                proof,
                data
            )

            const delegatorAfter = await bondingManager.getDelegator(
                transcoder.address
            )

            assert.isTrue(
                delegatorAfter.lastClaimRound.eq(currentRound),
                "last claim round not correct"
            )
            assert.isTrue(
                delegatorAfter.bondedAmount.toString() == "0",
                "bonded amount not 0"
            )
        })
    })
})

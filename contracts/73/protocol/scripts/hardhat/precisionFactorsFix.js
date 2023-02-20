const hre = require("hardhat")
const ethers = hre.ethers
const utils = ethers.utils
const BigNumber = ethers.BigNumber
const {
    createWinningTicket,
    createAuxData,
    getTicketHash
} = require("../../test/helpers/ticket")
const {default: RPC} = require("../../utils/rpc")

const ACCEPTABLE_DELTA = BigNumber.from("100")

// Copied from test/helpers/signMsg.js because it is not exported right now and the module
// currently defines a single default exported function.
const fixSig = sig => {
    // The recover() in ECDSA.sol from openzeppelin-solidity requires signatures to have a v-value that is 27/28
    // ETH clients that implement eth_sign will return a signature with a v-value that is 27/28 or 0/1 (geth returns 27/28 and ganache returns 0/1)
    // In order to support all ETH clients that implement eth_sign, we can fix the signature by ensuring that the v-value is 27/28
    let v = parseInt(sig.slice(130, 132), 16)
    if (v < 27) {
        v += 27
    }

    return sig.slice(0, 130) + v.toString(16)
}

const sign = async (msg, signFn) => {
    return fixSig(await signFn(msg))
}

const ethersSign = (msg, signer) => {
    const signFn = msg => {
        return signer.signMessage(utils.arrayify(msg))
    }
    return sign(msg, signFn)
}

async function main() {
    await hre.run("compile")

    // Fork from mainnet
    await hre.network.provider.request({
        method: "hardhat_reset",
        params: [
            {
                forking: {
                    blockNumber: 11816685,
                    jsonRpcUrl: process.env.MAINNET_FORK_URL
                }
            }
        ]
    })

    // Mainnet addresses
    const multisigAddr = "0x04746b890d090ae3c4c5df0101cfd089a4faca6c"
    const govAddr = "0xFC3CBed6A3476F7616CC70f078397700136eEBFd"
    const controllerAddr = "0xf96d54e490317c557a967abfa5d6e33006be69b3"
    const bondingManagerAddr = "0x511bc4556d823ae99630ae8de28b9b80df90ea2e"
    const sortedDoublyLLAddr = "0x1a0b2ca69ca2c7f96e2529faa6d63f881655d81a"
    const roundsManagerAddr = "0x3984fc4ceeef1739135476f625d36d6c35c40dc3"
    const ticketBrokerAddr = "0x5b1ce829384eebfa30286f12d1e7a695ca45f5d2"

    const roundsManager = await ethers.getContractAt(
        "RoundsManager",
        roundsManagerAddr
    )
    const bondingManager = await ethers.getContractAt(
        "BondingManager",
        bondingManagerAddr
    )
    const ticketBroker = await ethers.getContractAt(
        "TicketBroker",
        ticketBrokerAddr
    )

    // Deploy new BondingManager target implementation
    const BondingManager = await ethers.getContractFactory("BondingManager", {
        libraries: {
            SortedDoublyLL: sortedDoublyLLAddr
        }
    })
    const bondingManagerTarget = await BondingManager.deploy(controllerAddr)

    // Set LIP upgrade round and upgrade BondingManager target implementation by impersonating multisig owner of Governor
    const signer = (await ethers.getSigners())[0]
    await signer.sendTransaction({
        to: multisigAddr,
        value: ethers.utils.parseUnits("100", "ether")
    })

    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [multisigAddr]
    })

    const multisigSigner = await ethers.provider.getSigner(multisigAddr)
    const gov = await ethers.getContractAt("Governor", govAddr, multisigSigner)
    const controller = await ethers.getContractAt("Controller", controllerAddr)

    const lip71Round = (await roundsManager.currentRound()).add(
        BigNumber.from("1")
    )
    const setLIPUpgradeRoundData = utils.hexlify(
        utils.arrayify(
            roundsManager.interface.encodeFunctionData(
                "setLIPUpgradeRound(uint256,uint256)",
                [71, lip71Round]
            )
        )
    )

    const contractID = utils.solidityKeccak256(
        ["string"],
        ["BondingManagerTarget"]
    )
    const gitCommitHash = "0x40eb67080550bacd6f0a2f8590beb0db463bff29"
    const setInfoData = utils.hexlify(
        utils.arrayify(
            controller.interface.encodeFunctionData(
                "setContractInfo(bytes32,address,bytes20)",
                [contractID, bondingManagerTarget.address, gitCommitHash]
            )
        )
    )

    const update = {
        target: [roundsManagerAddr, controllerAddr],
        value: ["0", "0"],
        data: [setLIPUpgradeRoundData, setInfoData],
        nonce: 0
    }

    await gov.stage(update, 0)
    await gov.execute(update)

    if (!(await roundsManager.lipUpgradeRound(71)).eq(lip71Round)) {
        throw new Error(`LIP-71 upgrade round not set to ${lip71Round}`)
    }

    if (
        (await controller.getContract(contractID)) !=
        bondingManagerTarget.address
    ) {
        throw new Error(
            "new BondingManager target implementation not registered with Controller"
        )
    }

    await ticketBroker.fundDepositAndReserve(
        ethers.utils.parseUnits("10", "ether"),
        ethers.utils.parseUnits("10", "ether"),
        {value: ethers.utils.parseUnits("20", "ether")}
    )

    const newWinningTicket = async (recipient, recipientRand) => {
        const currentRound = await roundsManager.currentRound()
        const currentRoundBlockHash = await roundsManager.blockHashForRound(
            currentRound
        )
        const faceValue = ethers.utils.parseUnits(".17", "ether")
        const ticket = createWinningTicket(
            recipient,
            await signer.getAddress(),
            recipientRand,
            faceValue,
            createAuxData(currentRound, currentRoundBlockHash)
        )
        return ticket
    }

    const expDelEarnedFees = async (recipient, delegator, expAll) => {
        const PERC_DIVISOR = BigNumber.from("1000000")
        const PERC_DIVISOR_PRECISE = BigNumber.from("10").pow(
            BigNumber.from("18")
        )
        const allDelFeeShare = ethers.utils
            .parseUnits(".17", "ether")
            .mul((await bondingManager.getTranscoder(recipient)).feeShare)
            .div(PERC_DIVISOR)

        return allDelFeeShare
            .mul(
                (await bondingManager.pendingStake(delegator, currentRound))
                    .mul(PERC_DIVISOR_PRECISE)
                    .div(await bondingManager.transcoderTotalStake(recipient))
            )
            .div(PERC_DIVISOR_PRECISE)
    }

    let currentRound = await roundsManager.currentRound()

    let recipient = "0xf4e8ef0763bcb2b1af693f5970a00050a6ac7e1b"
    let delegator = "0x91558f6c152512c8e4001a8743d5edb2127108e5"

    // Ensure that the previous rounding behavior persists until the LIP-71 round
    let currPool = await bondingManager.getTranscoderEarningsPoolForRound(
        recipient,
        currentRound
    )
    if (!currPool.cumulativeFeeFactor.isZero()) {
        throw new Error("current cumulativeFeeFactor != 0")
    }

    const startPendingFees = await bondingManager.pendingFees(
        delegator,
        currentRound
    )

    let ticket = await newWinningTicket(recipient, 0)
    let sig = await ethersSign(getTicketHash(ticket), signer)
    await ticketBroker.redeemWinningTicket(ticket, sig, 0)

    currPool = await bondingManager.getTranscoderEarningsPoolForRound(
        recipient,
        currentRound
    )
    if (!currPool.cumulativeFeeFactor.isZero()) {
        throw new Error("current cumulativeFeeFactor != 0")
    }

    const endPendingFees = await bondingManager.pendingFees(
        delegator,
        currentRound
    )
    if (!startPendingFees.eq(endPendingFees)) {
        throw new Error(
            "start pendingFees != end pendingFees before LIP-71 round"
        )
    }

    const rpc = new RPC(hre.web3)
    await rpc.wait((await roundsManager.roundLength()).toNumber())
    await roundsManager.initializeRound()

    currentRound = await roundsManager.currentRound()

    // Ensure that the new cumulativeFeeFactor is > 0 when the previous cumulativeFeeFactor = 0
    let lffPool = await bondingManager.getTranscoderEarningsPoolForRound(
        recipient,
        (
            await bondingManager.getTranscoder(recipient)
        ).lastFeeRound
    )
    if (!lffPool.cumulativeFeeFactor.isZero()) {
        throw new Error("previous cumulativeFeeFactor != 0")
    }

    let delStartFees = await bondingManager.pendingFees(delegator, currentRound)

    ticket = await newWinningTicket(recipient, 1)
    sig = await ethersSign(getTicketHash(ticket), signer)
    await ticketBroker.redeemWinningTicket(ticket, sig, 1)

    currPool = await bondingManager.getTranscoderEarningsPoolForRound(
        recipient,
        currentRound
    )
    if (currPool.cumulativeFeeFactor.isZero()) {
        throw new Error("current cumulativeFeeFactor = 0")
    }

    let delEndFees = await bondingManager.pendingFees(delegator, currentRound)
    let delEarnedFees = delEndFees.sub(delStartFees)
    let expEarnedFees = await expDelEarnedFees(recipient, delegator)
    if (!delEarnedFees.eq(expEarnedFees)) {
        throw new Error(
            `delegator earned fees ${
                delEarnedFees.toString
            } != expected earned fees ${expEarnedFees.toString()}`
        )
    }

    // Ensure that the new cumulativeFeeFactor is scaled correctly when the previous cumulativeFeeFactor > 0
    recipient = "0xe3a5793d7c1d2a04a903fa1695b3e3555d6084ca"
    delegator = "0xdb7040c40f5ead5ff082fcb28c57bbf7dfd4bee3"

    lffPool = await bondingManager.getTranscoderEarningsPoolForRound(
        recipient,
        (
            await bondingManager.getTranscoder(recipient)
        ).lastFeeRound
    )
    if (lffPool.cumulativeFeeFactor.isZero()) {
        throw new Error("previous cumulativeFeeFactor = 0")
    }

    delStartFees = await bondingManager.pendingFees(delegator, currentRound)

    ticket = await newWinningTicket(recipient, 1)
    sig = await ethersSign(getTicketHash(ticket), signer)
    await ticketBroker.redeemWinningTicket(ticket, sig, 1)

    currPool = await bondingManager.getTranscoderEarningsPoolForRound(
        recipient,
        currentRound
    )
    if (currPool.cumulativeFeeFactor.isZero()) {
        throw new Error("current cumulativeFeeFactor = 0")
    }

    delEndFees = await bondingManager.pendingFees(delegator, currentRound)
    delEarnedFees = delEndFees.sub(delStartFees)
    expEarnedFees = await expDelEarnedFees(recipient, delegator)
    if (delEarnedFees.sub(expEarnedFees).abs().gt(ACCEPTABLE_DELTA)) {
        throw new Error(
            `delegator earned fees ${delEarnedFees.toString()} too far from expected earned fees ${expEarnedFees.toString()}`
        )
    }

    // Ensure calculations are correct after a second redemption for the same recipient in the same round
    delStartFees = await bondingManager.pendingFees(delegator, currentRound)

    ticket = await newWinningTicket(recipient, 2)
    sig = await ethersSign(getTicketHash(ticket), signer)
    await ticketBroker.redeemWinningTicket(ticket, sig, 2)

    delEndFees = await bondingManager.pendingFees(delegator, currentRound)
    delEarnedFees = delEndFees.sub(delStartFees)
    expEarnedFees = await expDelEarnedFees(recipient, delegator)
    if (delEarnedFees.sub(expEarnedFees).abs().gt(ACCEPTABLE_DELTA)) {
        throw new Error(
            `delegator earned fees ${delEarnedFees.toString()} too far from expected earned fees ${expEarnedFees.toString()}`
        )
    }

    // Ensure calculations are correct after another redemption for the same recipient in a new round
    await rpc.wait((await roundsManager.roundLength()).toNumber())
    await roundsManager.initializeRound()

    delStartFees = await bondingManager.pendingFees(delegator, currentRound)

    ticket = await newWinningTicket(recipient, 3)
    sig = await ethersSign(getTicketHash(ticket), signer)
    await ticketBroker.redeemWinningTicket(ticket, sig, 3)

    delEndFees = await bondingManager.pendingFees(delegator, currentRound)
    delEarnedFees = delEndFees.sub(delStartFees)
    expEarnedFees = await expDelEarnedFees(recipient, delegator)
    if (delEarnedFees.sub(expEarnedFees).abs().gt(ACCEPTABLE_DELTA)) {
        throw new Error(
            `delegator earned fees ${delEarnedFees.toString()} too far from expected earned fees ${expEarnedFees.toString()}`
        )
    }

    console.log("Upgrade simulation checks passed!")
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err)
        process.exit(1)
    })

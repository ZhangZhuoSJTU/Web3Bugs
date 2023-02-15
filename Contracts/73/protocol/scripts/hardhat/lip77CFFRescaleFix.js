const hre = require("hardhat")
const ethers = hre.ethers
const utils = ethers.utils

async function main() {
    await hre.run("compile")

    // Fork from mainnet
    await hre.network.provider.request({
        method: "hardhat_reset",
        params: [
            {
                forking: {
                    blockNumber: 12151147,
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

    const delegators = [
        "0x11f11dafde2ed523cd935184dd28876ce52f1652",
        "0x28aab68c68e5d9c6230bdb7bbfb4fc0739c480c7",
        "0x345551571c5ef20111c6168b9a498dfb836e7c09",
        "0x39e59d40c1ae3e664fa9b6f5ecfaa25db27f1924",
        "0x4f9b9f66a2518251ea958372154b579d258189c0",
        "0x70564145fa8e8a15348ef0190e6b7c07a2120462",
        "0x85a48e017c2f09037046656f2dbb063c3c1d3ce2",
        "0x9ef77b6a570dec9a3ef4c9edbbc2de7785347b51",
        "0xa6d092cc9aa7dd006e7e04445d3efff12517a442",
        "0xb5b864f447a2cb2e977e0b808f00b8dd354e5a7f",
        "0xdcfae5c899649f05357b84d002e024374ed7b7a9",
        "0xde42f514869714f911fb61f9a07f6149fcb3c52c",
        "0xe1c879f065682a0d35966596a72d5681a56118a5",
        "0xeb0fb162ede9607e51a34f76414b89945d697c0b",
        "0xf105ddc949e93bee98e328ab40a01d98eef05168",
        "0x5b20f87280d931b3921b658a7260d1c8e363f7ee",
        "0x92e4709784914edbe7c75da707f934fc51407a28"
    ]

    const transcoders = [
        "0x3e2b450c0c499d8301146367680e067cd009db93",
        "0xbac7744ada4ab1957cbaafef698b3c068beb4fe0",
        "0xd84781e1a9b74d71ea76cda8bb9f30893bfd00d1",
        "0xdac817294c0c87ca4fa1895ef4b972eade99f2fd",
        "0xf4e8ef0763bcb2b1af693f5970a00050a6ac7e1b",
        "0x9D5611bf0DAdddb4441A709141d9229d7F6b3e47"
    ]

    const lip78Round = 2109

    const bondingManager = await ethers.getContractAt(
        "BondingManager",
        bondingManagerAddr
    )

    const logPendingFees = async () => {
        for (const del of delegators) {
            try {
                const pf = await bondingManager.pendingFees(del, lip78Round)
                console.log(
                    `Delegator ${del} pendingFees ${ethers.utils.formatUnits(
                        pf,
                        "ether"
                    )}`
                )
            } catch (err) {
                console.log(`Delegator ${del} pendingFees error ${err}`)
            }
        }

        for (const tr of transcoders) {
            try {
                const pf = await bondingManager.pendingFees(tr, lip78Round)
                console.log(
                    `Transcoder ${tr} pendingFees ${ethers.utils.formatUnits(
                        pf,
                        "ether"
                    )}`
                )
            } catch (err) {
                console.log(`Transcoder ${tr} pendingFees error ${err}`)
            }
        }
    }

    console.log("PRE UPGRADE")
    await logPendingFees()

    // Deploy new BondingManager target implementation
    const BondingManager = await ethers.getContractFactory("BondingManager", {
        libraries: {
            SortedDoublyLL: sortedDoublyLLAddr
        }
    })
    const bondingManagerTarget = await BondingManager.deploy(controllerAddr)

    // Upgrade BondingManager target implementation by impersonating multisig owner of Governor
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
    const roundsManager = await ethers.getContractAt(
        "RoundsManager",
        roundsManagerAddr
    )

    const setLIPUpgradeRoundData = utils.hexlify(
        utils.arrayify(
            roundsManager.interface.encodeFunctionData(
                "setLIPUpgradeRound(uint256,uint256)",
                [78, lip78Round]
            )
        )
    )

    const contractID = utils.solidityKeccak256(
        ["string"],
        ["BondingManagerTarget"]
    )
    const gitCommitHash = "0x522ef6cf6eb3c3b411a4c16517ad78ebe8a08032" // Placeholder
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

    if (
        (await controller.getContract(contractID)) !=
        bondingManagerTarget.address
    ) {
        throw new Error(
            "new BondingManager target implementation not registered with Controller"
        )
    }

    console.log("POST UPGRADE")
    await logPendingFees()
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err)
        process.exit(1)
    })

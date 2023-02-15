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
                    blockNumber: 12123681,
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

    const delegatorBadStake = "0xb47d8f87c0113827d44ad0bc32d53823c477a89d"
    const delegatorBadFees = "0x92e4709784914edbe7c75da707f934fc51407a28"

    const lip78Round = 2109

    const bondingManager = await ethers.getContractAt(
        "BondingManager",
        bondingManagerAddr
    )

    const preUpgradeStake = await bondingManager.pendingStake(
        delegatorBadStake,
        2104
    )
    const preUpgradeFees = await bondingManager.pendingFees(
        delegatorBadFees,
        2104
    )
    console.log(
        `Delegator ${delegatorBadStake} pre-upgrade pendingStake ${preUpgradeStake.toString()}`
    )
    console.log(
        `Delegator ${delegatorBadFees} pre-upgrade pendingFees ${preUpgradeFees.toString()}`
    )

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

    const postUpgradeStake = await bondingManager.pendingStake(
        delegatorBadStake,
        2104
    )
    const postUpgradeFees = await bondingManager.pendingFees(
        delegatorBadFees,
        2104
    )
    console.log(
        `Delegator ${delegatorBadStake} post-upgrade pendingStake ${postUpgradeStake.toString()}`
    )
    console.log(
        `Delegator ${delegatorBadFees} post-upgrade pendingFees ${postUpgradeFees.toString()}`
    )

    if (postUpgradeStake.gte(preUpgradeStake)) {
        throw new Error(
            `Delegator ${delegatorBadStake} post-upgrade pendingStake should be less than pre-upgrade pendingStake`
        )
    }
    if (postUpgradeFees.gte(preUpgradeFees)) {
        throw new Error(
            `Delegator ${delegatorBadFees} post-upgrade pendingFees should be less than pre-upgrade pendingFees`
        )
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err)
        process.exit(1)
    })

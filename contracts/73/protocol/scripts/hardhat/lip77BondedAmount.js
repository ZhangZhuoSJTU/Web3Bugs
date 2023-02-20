const hre = require("hardhat")
const ethers = hre.ethers
const utils = ethers.utils

async function main() {
    await hre.run("compile")

    // The bug was triggered in this tx https://etherscan.io/tx/0xf5221628102f866a2cc1aa356a92ec6d2c9fd58d378e36328f398cccebc4645a
    // which was mined in block 12125269
    // Fork from mainnet at a block before this tx was mined
    // i.e. 12125269 - 1 = 12125268
    await hre.network.provider.request({
        method: "hardhat_reset",
        params: [
            {
                forking: {
                    blockNumber: 12125268,
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

    const delegator = "0xb47d8f87c0113827d44ad0bc32d53823c477a89d"

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
        target: [controllerAddr],
        value: ["0"],
        data: [setInfoData],
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

    // Submit the original tx that triggered the bug by impersonating the delegator
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [delegator]
    })
    const delegatorSigner = await ethers.provider.getSigner(delegator)
    const bondingManager = await ethers.getContractAt(
        "BondingManager",
        bondingManagerAddr,
        delegatorSigner
    )

    // Original tx that triggered the bug https://etherscan.io/tx/0xf5221628102f866a2cc1aa356a92ec6d2c9fd58d378e36328f398cccebc4645a
    const transcoder = "0x599f9f49e2ef93f07dc98a89ffeeb254926a1986"
    const additionalAmount = "4860201662000000000000"
    await bondingManager.bondWithHint(
        additionalAmount,
        transcoder,
        "0x9C10672CEE058Fd658103d90872fE431bb6C0AFa",
        "0x0000000000000000000000000000000000000000",
        "0x9C10672CEE058Fd658103d90872fE431bb6C0AFa",
        "0x0000000000000000000000000000000000000000"
    )

    const stake = await bondingManager.pendingStake(delegator, 2105)
    console.log(`LIP-77 bondedAmount: ${stake}`)
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err)
        process.exit(1)
    })

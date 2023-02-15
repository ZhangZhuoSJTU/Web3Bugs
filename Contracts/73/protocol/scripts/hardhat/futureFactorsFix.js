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
                    blockNumber: 11740749,
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

    // Subset of addresses affected by future factors bug
    const affectedAddrs = [
        "0x9c4d592042F959254485d443bBc337d29572264F",
        "0x89CddDCBE1587C91D8861D1eA2F55502AAe22660"
    ]

    // pendingStake values before the upgrade
    const beforeStakes = {}
    // pendingStake values at the LIP-52 snapshot round before the upgrade
    const lip52BeforeStakes = {}

    const roundsManager = await ethers.getContractAt(
        "RoundsManager",
        roundsManagerAddr
    )
    const bondingManager = await ethers.getContractAt(
        "BondingManager",
        bondingManagerAddr
    )

    const cr = await roundsManager.currentRound()
    const lip52Round = await roundsManager.lipUpgradeRound(52)

    for (const addr of affectedAddrs) {
        beforeStakes[addr] = await bondingManager.pendingStake(addr, cr)
        console.log(
            `${addr} pre-upgrade stake ${beforeStakes[addr].toString()}`
        )

        lip52BeforeStakes[addr] = await bondingManager.pendingStake(
            addr,
            lip52Round
        )
        console.log(
            `${addr} pre-upgrade LIP-52 stake ${lip52BeforeStakes[
                addr
            ].toString()}`
        )
    }

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
    const gitCommitHash = "0x522ef6cf6eb3c3b411a4c16517ad78ebe8a08032"
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

    for (const addr of affectedAddrs) {
        const afterStake = await bondingManager.pendingStake(addr, cr)
        console.log(`${addr} post-upgrade stake ${afterStake.toString()}`)

        const lip52AfterStake = await bondingManager.pendingStake(
            addr,
            lip52Round
        )
        console.log(
            `${addr} post-upgrade LIP-52 stake ${lip52AfterStake.toString()}`
        )

        if (afterStake.lt(beforeStakes[addr])) {
            throw new Error(
                `${addr} post-upgrade stake ${afterStake.toString()} not greater than pre-upgrade stake ${beforeStakes[
                    addr
                ].toString()}`
            )
        }

        if (!lip52AfterStake.eq(lip52BeforeStakes[addr])) {
            throw new Error(
                `${addr} post-upgrade LIP-52 stake ${lip52AfterStake.toString()} != pre-upgrade LIP-52 stake ${lip52BeforeStakes[
                    addr
                ].toString()}`
            )
        }
    }

    console.log("Upgrade simulation checks passed!")
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err)
        process.exit(1)
    })

const hre = require("hardhat")
const ethers = hre.ethers
const utils = ethers.utils
const BigNumber = ethers.BigNumber

async function main() {
    await hre.run("compile")

    await hre.network.provider.request({
        method: "hardhat_reset",
        params: [
            {
                forking: {
                    blockNumber: 12125932,
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
    const bondingManager = await ethers.getContractAt(
        "BondingManager",
        bondingManagerAddr
    )

    const unpauseData = utils.hexlify(
        utils.arrayify(controller.interface.encodeFunctionData("unpause"))
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

    // Output of running lip77BondedAmount.js
    const lip77BondedAmount = "19237428264288812856072"
    const executeLIP77Data = utils.hexlify(
        utils.arrayify(
            bondingManager.interface.encodeFunctionData(
                "executeLIP77(uint256)",
                [lip77BondedAmount]
            )
        )
    )
    const update = {
        target: [controllerAddr, controllerAddr, bondingManagerAddr],
        value: ["0", "0", "0"],
        data: [setInfoData, unpauseData, executeLIP77Data],
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

    const delegator = utils.getAddress(
        "0xb47d8f87c0113827d44ad0bc32d53823c477a89d"
    )
    const transcoder = utils.getAddress(
        "0x599f9f49e2ef93f07dc98a89ffeeb254926a1986"
    )

    const filter = bondingManager.filters.Bond(null, null, delegator)
    const events = await bondingManager.queryFilter(filter, 12125932)
    if (events.length != 1) {
        throw new Error("Did not get the expected single Bond event")
    }
    if (
        events[0].args.newDelegate != transcoder ||
        events[0].args.oldDelegate != transcoder ||
        events[0].args.delegator != delegator ||
        !events[0].args.additionalAmount.isZero() ||
        !events[0].args.bondedAmount.eq(BigNumber.from(lip77BondedAmount))
    ) {
        throw new Error("Did not get expected fields in single Bond event")
    }

    const del = await bondingManager.getDelegator(delegator)
    if (!del.bondedAmount.eq(BigNumber.from(lip77BondedAmount))) {
        throw new Error(
            `Delegator ${delegator} bondedAmount != LIP-77 bondedAmount`
        )
    }

    console.log(
        `Delegator ${delegator} bondedAmount: ${del.bondedAmount.toString()}`
    )

    const stake = await bondingManager.pendingStake(delegator, 2105)
    if (!stake.eq(BigNumber.from(lip77BondedAmount))) {
        throw new Error(
            `Delegator ${delegator} pendingStake != LIP-77 bondedAmount`
        )
    }

    console.log(`Delegator ${delegator} pendingStake: ${stake.toString()}`)

    let invalidUpdateErr
    try {
        const invalidUpdate = {
            target: [bondingManagerAddr],
            value: ["0"],
            data: [executeLIP77Data],
            nonce: 0
        }

        await gov.stage(invalidUpdate, 0)
        await gov.execute(invalidUpdate)
    } catch (err) {
        invalidUpdateErr = err
    }

    if (!invalidUpdateErr) {
        throw new Error("Expected error for invalid update with executeLIP77")
    }

    console.log(`Got expected invalid update error: ${invalidUpdateErr}`)

    let callerErr
    try {
        const bondingManagerBadCaller = await ethers.getContractAt(
            "BondingManager",
            bondingManagerAddr,
            signer
        )
        await bondingManagerBadCaller.executeLIP77(1234)
    } catch (err) {
        callerErr = err
    }

    if (!callerErr) {
        throw new Error("Expected error for bad caller with executeLIP77")
    }

    console.log(`Got expected bad caller error: ${callerErr}`)
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err)
        process.exit(1)
    })

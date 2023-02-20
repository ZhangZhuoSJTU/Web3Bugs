import {contractId} from "../../utils/helpers"
import {ethers} from "hardhat"

module.exports = async function(
    controller,
    roundsManager,
    bondingManagerProxyAddress
) {
    // See Deployment section of https://github.com/livepeer/LIPs/blob/master/LIPs/LIP-36.md

    // Define LIP-36 round
    const lip36Round = await roundsManager.currentRound()

    // Deploy a new RoundsManager implementation contract
    // Note: In this test, we use the same implementation contract as the one currently deployed because
    // this repo does not contain the old implementation contract. In practice, the deployed implementation contract
    // would be different than the new implementation contract and we would be using the RoundsManager instead of the AdjustableRoundsManager
    const roundsManagerTarget = await (
        await ethers.getContractFactory("AdjustableRoundsManager")
    ).deploy(controller.address)

    // Deploy a new BondingManager implementation contract
    const ll = await (
        await ethers.getContractFactory("SortedDoublyLL")
    ).deploy()
    const bondingManagerTarget = await (
        await ethers.getContractFactory("BondingManager", {
            libraries: {
                SortedDoublyLL: ll.address
            }
        })
    ).deploy(controller.address)

    // Register the new RoundsManager implementation contract
    await controller.setContractInfo(
        contractId("RoundsManagerTarget"),
        roundsManagerTarget.address,
        "0x3031323334353637383930313233343536373839"
    )

    // Set LIP upgrade round
    await roundsManager.setLIPUpgradeRound(36, lip36Round)

    // Register the new BondingManager implementation contract
    await controller.setContractInfo(
        contractId("BondingManagerTarget"),
        bondingManagerTarget.address,
        "0x3031323334353637383930313233343536373839"
    )

    return await ethers.getContractAt(
        "BondingManager",
        bondingManagerProxyAddress
    )
}

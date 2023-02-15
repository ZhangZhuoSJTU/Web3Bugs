import {HardhatRuntimeEnvironment} from "hardhat/types"
import {DeployFunction} from "hardhat-deploy/types"

import ContractDeployer from "./deployer"

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre // Get the deployments and getNamedAccounts which are provided by hardhat-deploy
    const {deploy, get} = deployments // the deployments object itself contains the deploy function

    const {deployer} = await getNamedAccounts() // Fetch named accounts from hardhat.config.ts

    const contractDeployer = new ContractDeployer(deploy, deployer, deployments)

    const livepeerToken = await get("LivepeerToken")

    await contractDeployer.deployAndRegister({
        contract: "PollCreator",
        name: "PollCreator",
        args: [livepeerToken.address]
    })
}

func.dependencies = ["Contracts"]
func.tags = ["Poll"]
export default func

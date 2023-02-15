import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { assertIsTestnetChain } from './utils'

const deployFunction: DeployFunction = async function ({
    deployments,
    getNamedAccounts,
    getChainId,
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()
    console.log(
        'Running BaseToken deployment script with',
        deployer,
        'as the deployer'
    )
    const currentChain = await getChainId()
    /**
     * Make sure this script is not accidentally targeted towards a production environment,
     * this can be removed once we deploy to prod.
     */
    assertIsTestnetChain(currentChain)
    const { address: baseTokenAddress, newlyDeployed } = await deploy(
        'BaseToken',
        {
            from: deployer,
            contract: 'MockERC20',
            deterministicDeployment: false,
            args: ['Mock Base Token', 'MBT'],
            skipIfAlreadyDeployed: true,
        }
    )
    if (newlyDeployed) {
        console.log('Deployed BaseToken to', baseTokenAddress)
    } else {
        console.log('Existing BaseToken at', baseTokenAddress)
    }
    console.log('')
}

export default deployFunction

deployFunction.tags = ['BaseToken']

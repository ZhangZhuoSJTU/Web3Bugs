import { parseEther } from 'ethers/lib/utils'
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
        'Running CollateralDepositRecord deployment script with',
        deployer,
        'as the deployer'
    )
    const currentChain = await getChainId()
    /**
     * Make sure this script is not accidentally targeted towards a production environment,
     * this can be removed once we deploy to prod.
     */
    assertIsTestnetChain(currentChain)
    const globalDepositCap = parseEther('100000')
    const accountDepositCap = parseEther('1000')
    const { address: depositRecordAddress, newlyDeployed } = await deploy(
        'CollateralDepositRecord',
        {
            from: deployer,
            contract: 'CollateralDepositRecord',
            deterministicDeployment: false,
            args: [globalDepositCap, accountDepositCap],
            skipIfAlreadyDeployed: true,
        }
    )
    if (newlyDeployed) {
        console.log(
            'Deployed CollateralDepositRecord to',
            depositRecordAddress
        )
    } else {
        console.log(
            'Existing CollateralDepositRecord at',
            depositRecordAddress
        )
    }
    console.log('')
}

export default deployFunction

deployFunction.tags = ['CollateralDepositRecord']

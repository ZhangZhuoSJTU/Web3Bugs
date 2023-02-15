import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { AccountAccessController, CollateralDepositRecord } from '../typechain'
import { assertIsTestnetChain } from './utils'

const deployFunction: DeployFunction = async function ({
    ethers,
    deployments,
    getNamedAccounts,
    getChainId,
}: HardhatRuntimeEnvironment) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()
    console.log(
        'Running DepositHook deployment script with',
        deployer,
        'as the deployer'
    )
    const currentChain = await getChainId()
    /**
     * Make sure this script is not accidentally targeted towards a production environment,
     * this can be removed once we deploy to prod.
     */
    assertIsTestnetChain(currentChain)
    // Retrieve existing non-upgradeable deployments using hardhat-deploy
    const accountAccessController = (await ethers.getContract(
        'AccountAccessController'
    )) as AccountAccessController
    const collateralDepositRecord = (await ethers.getContract(
        'CollateralDepositRecord'
    )) as CollateralDepositRecord
    // Deploy DepositHook and configure external contracts to point to it
    const {
        address: depositHookAddress,
        newlyDeployed: depositHookNewlyDeployed,
    } = await deploy('DepositHook', {
        from: deployer,
        contract: 'DepositHook',
        deterministicDeployment: false,
        args: [
            accountAccessController.address,
            collateralDepositRecord.address,
        ],
        skipIfAlreadyDeployed: true,
    })
    if (depositHookNewlyDeployed) {
        console.log('Deployed DepositHook to', depositHookAddress)
    } else {
        console.log('Existing DepositHook at', depositHookAddress)
    }
    if (!(await collateralDepositRecord.isHookAllowed(depositHookAddress))) {
        console.log(
            'Configuring CollateralDepositRecord at',
            collateralDepositRecord.address,
            'to allow the DepositHook...'
        )
        const setAllowedHookTx = await collateralDepositRecord.setAllowedHook(
            depositHookAddress,
            true
        )
        await setAllowedHookTx.wait()
    }
    console.log('')
}

export default deployFunction

deployFunction.dependencies = [
    'AccountAccessController',
    'CollateralDepositRecord',
]

deployFunction.tags = ['DepositHook']

import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { Collateral, ERC20 } from '../typechain'
import { assertIsTestnetChain, recordDeployment } from './utils'
import { ContractAddressOrInstance } from '@openzeppelin/hardhat-upgrades/dist/utils'
import { sendTxAndWait } from './helpers'

const deployFunction: DeployFunction = async function ({
    getNamedAccounts,
    ethers,
    upgrades,
    getChainId,
}: HardhatRuntimeEnvironment) {
    const { deployer } = await getNamedAccounts()
    console.log(
        'Running Collateral deployment script with',
        deployer,
        'as the deployer'
    )
    const governance = deployer
    const currentChain = await getChainId()
    /**
     * Make sure this script is not accidentally targeted towards a production environment,
     * this can be removed once we deploy to prod.
     */
    assertIsTestnetChain(currentChain)
    /**
     * Attempt to retrieve existing Collateral deployment to attempt an upgrade, or deploy
     * a new instance if one doesn't exist.
     *
     * We rely on an environment variable to identify an existing deployment on the chosen
     * network. This is because for safety reasons, we do not use the hardhat-deploy library
     * to deploy upgradeable contracts. The hardhat-deploy library does not perform storage
     * slot collision verification and other safety checks that hardhat-upgrades performs.
     */
    let collateral: Collateral
    const envVarName = 'COLLATERAL_' + currentChain
    const existingCollateralAddress = process.env[envVarName]
    const collateralFactory = await ethers.getContractFactory('Collateral')
    if (!existingCollateralAddress) {
        const baseToken = (await ethers.getContract('BaseToken')) as ERC20
        collateral = (await upgrades.deployProxy(collateralFactory, [
            baseToken.address,
            governance,
        ])) as Collateral
        await collateral.deployed()
        console.log('Deployed Collateral to', collateral.address)
        // Record Collateral deployment in local .env file
        recordDeployment(envVarName, collateral)
    } else {
        collateral = (await upgrades.upgradeProxy(
            existingCollateralAddress as ContractAddressOrInstance,
            collateralFactory
        )) as Collateral
        console.log('Upgraded Collateral at', collateral.address)
    }
    // Connect SingleStrategyController to the Collateral vault
    const singleStrategyController = await ethers.getContract(
        'SingleStrategyController'
    )
    if ((await singleStrategyController.getVault()) != collateral.address) {
        console.log(
            'Connecting Collateral to SingleStrategyController at',
            singleStrategyController.address,
            '...'
        )
        await sendTxAndWait(
            await singleStrategyController.setVault(collateral.address)
        )
    }
    if (
        (await collateral.getStrategyController()) !=
        singleStrategyController.address
    ) {
        console.log(
            'Connecting SingleStrategyController at',
            singleStrategyController.address,
            'to the Collateral vault...'
        )
        await sendTxAndWait(
            await collateral.setStrategyController(
                singleStrategyController.address
            )
        )
    }
    // Connect DepositHook to the Collateral vault
    const depositHook = await ethers.getContract('DepositHook')
    if ((await depositHook.getVault()) != collateral.address) {
        console.log(
            'Connecting Collateral to DepositHook at',
            depositHook.address,
            '...'
        )
        await sendTxAndWait(await depositHook.setVault(collateral.address))
    }
    if ((await collateral.getDepositHook()) != depositHook.address) {
        console.log(
            'Connecting DepositHook at',
            depositHook.address,
            'to the Collateral vault...'
        )
        await sendTxAndWait(
            await collateral.setDepositHook(depositHook.address)
        )
    }
    // Connect WithdrawHook to the Collateral vault
    const withdrawHook = await ethers.getContract('WithdrawHook')
    if ((await withdrawHook.getVault()) != collateral.address) {
        console.log(
            'Connecting Collateral to WithdrawHook at',
            withdrawHook.address,
            '...'
        )
        await sendTxAndWait(await withdrawHook.setVault(collateral.address))
    }
    if ((await collateral.getWithdrawHook()) != withdrawHook.address) {
        console.log(
            'Connecting WithdrawHook at',
            withdrawHook.address,
            'to the Collateral vault...'
        )
        await sendTxAndWait(
            await collateral.setWithdrawHook(withdrawHook.address)
        )
    }
    console.log('')
}

export default deployFunction

deployFunction.dependencies = [
    'BaseToken',
    'SingleStrategyController',
    'DepositHook',
    'WithdrawHook',
]

deployFunction.tags = ['Collateral']

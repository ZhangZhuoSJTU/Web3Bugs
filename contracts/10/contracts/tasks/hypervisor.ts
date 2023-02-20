import IUniswapV2ERC20 from '@uniswap/v2-core/build/IUniswapV2ERC20.json'
import { expect } from 'chai'
import { constants, Wallet } from 'ethers'
import { formatEther, parseEther, parseUnits } from 'ethers/lib/utils'
import { task } from 'hardhat/config'
import { deployContract, signPermission } from './utils'

const DAY = 60 * 60 * 24

task('deploy-hypervisor-factories', 'Deploy Hypervisor factory contracts')
  .addFlag('verify', 'verify contracts on etherscan')
  .setAction(async (args, { ethers, run, network }) => {
    // log config

    console.log('Network')
    console.log('  ', network.name)
    console.log('Task Args')
    console.log(args)

    // compile

    await run('compile')

    // get signer

    const signer = (await ethers.getSigners())[0]
    console.log('Signer')
    console.log('  at', signer.address)
    console.log('  ETH', formatEther(await signer.getBalance()))

    // deploy contracts

    const rewardPoolFactory = await deployContract(
      'RewardPoolFactory',
      await ethers.getContractFactory('RewardPoolFactory'),
      signer,
    )

    const powerSwitchFactory = await deployContract(
      'PowerSwitchFactory',
      await ethers.getContractFactory('PowerSwitchFactory'),
      signer,
    )

    // verify

    if (args.verify) {
      console.log('Verifying source on etherscan')

      await powerSwitchFactory.deployTransaction.wait(5)

      await run('verify:verify', {
        address: rewardPoolFactory.address,
      })

      await run('verify:verify', {
        address: powerSwitchFactory.address,
      })
    }
  })

/* create-hypervisor --unlock-days 28 --scaling-days 28 --scaling-floor 1 --scaling-ceiling 1 --reward-pool-factory 0x4Bd9401bC6BA8F2f7Ec20F7f8fA2cd8f91B5A2ea --power-switch-factory 0xac01d93be6f7Acf071011954fE2d74e4755f747A --visor-factory 0xae03233307865623aaef76da9ade669b86e6f20a --owner 0x212e4c1cF2F018d07AF9b0196BdFaAD4D8dd4f70 --reward-token 0xf938424f7210f31df2aee3011291b658f872e91e --reward-amount 1000000 --staking-token 0x6b175474e89094c44da98b954eedeac495271d0f --stake-limit 3000 --verify --network mainnet */

/*
create-hypervisor --unlock-days 28 --scaling-days 28 --scaling-floor 1 --scaling-ceiling 1 --reward-pool-factory 0xB7cb8dC741FEc5fcA80Af5AFA9462763cbeEcFd0 --power-switch-factory 0x6871A5a08B9B8Aa92Da25C6E0fcB2c8112b74EE8 --visor-factory 0x6d520c82cfa8146afe500e6ddd8b39c1d7bd8326 --owner 0x997214EC4F289807a6677AbBbD97A4CEa813296A --reward-token 0x1F3BeD559565b56dAabed5790af29ffEd628c4B6 --reward-amount 1000000 --staking-token 0xFfEc41C97e070Ab5EBeB6E24258B38f69EED5020 --stake-limit 3000 --verify --network mainnet 
 */

// Signer
//   at 0x997214EC4F289807a6677AbBbD97A4CEa813296A
//   ETH 2.342023066
// Deploying RewardPoolFactory
//   to 0xB7cb8dC741FEc5fcA80Af5AFA9462763cbeEcFd0
//   in 0x25ca9ff8652f01f26ca8bbf4386ea945de7ccc1554f53d1bf0fa3083bae6a6b4
// Deploying PowerSwitchFactory
//   to 0x6871A5a08B9B8Aa92Da25C6E0fcB2c8112b74EE8
//   in 0x8b4babb54299b7f3ef5c2b71804dac45949b63396120e04cc3d46b3da4815923


task('create-hypervisor', 'Create an Hypervisor instance and deposit funds')
  .addParam('stakingToken', 'the staking token')
  .addParam('rewardToken', 'the reward token')
  .addParam('rewardAmount', 'the reward amount')
  .addParam('unlockDays', 'number of days to unlock reward')
  .addParam('scalingFloor', 'the scaling floor')
  .addParam('scalingCeiling', 'the scaling ceiling')
  .addParam('scalingDays', 'the scaling time in days')
  .addParam('stakeLimit', 'the inidividual stake limit')
  .addParam('rewardPoolFactory', 'RewardPoolFactory address')
  .addParam('powerSwitchFactory', 'PowerSwitchFactory address')
  .addParam('visorFactory', 'visorFactory address')
  .addParam('owner', 'the admin of the system')
  .addFlag('verify', 'verify contracts on etherscan')
  .setAction(async (args, { ethers, run, network }) => {
    // log config

    console.log('Network')
    console.log('  ', network.name)
    console.log('Task Args')
    console.log(args)

    // compile

    await run('compile')

    // get signer

    const signer = (await ethers.getSigners())[0]
    console.log('Signer')
    console.log('  at', signer.address)
    console.log('  ETH', formatEther(await signer.getBalance()))

    // load contracts

    const rewardToken = await ethers.getContractAt(
      'IERC20Detailed',
      args.rewardToken,
      signer,
    )

    // validate balances

    console.log('Validate balances')

    const rewardAmount = parseUnits(
      args.rewardAmount,
      await rewardToken.decimals(),
    )

    const stakingToken = await ethers.getContractAt(
      IUniswapV2ERC20.abi,
      args.stakingToken,
      signer,
    )

    const stakeLimit = parseUnits(
      args.stakeLimit,
      await stakingToken.decimals(),
    )
    console.log('stakeLimit no decimals ', stakeLimit.toString());

    expect(await rewardToken.balanceOf(signer.address)).to.be.gte(rewardAmount)
    // expect(await signer.getBalance()).to.be.gte(parseEther('1'))

    // deploy instance

    const hypervisorArgs = [
      signer.address,
      args.rewardPoolFactory,
      args.powerSwitchFactory,
      args.stakingToken,
      args.rewardToken,
      [args.scalingFloor, args.scalingCeiling, args.scalingDays * DAY],
      stakeLimit
    ]

    console.log('Hypervisor constructor args')
    console.log(hypervisorArgs)

    const hypervisor = await deployContract(
      'Hypervisor',
      await ethers.getContractFactory('Hypervisor'),
      signer,
      hypervisorArgs,
    )

    // fund hypervisor

    console.log('Approve reward deposit')

    const approveTx = await rewardToken.approve(
      hypervisor.address,
      constants.MaxUint256,
    )
    await approveTx.wait()

    console.log('  in', approveTx.hash)

    console.log('Deposit reward')

    const depositTx = await hypervisor.fund(rewardAmount, args.unlockDays * DAY)

    console.log('  in', depositTx.hash)

    // add visor factory

    console.log('Register visor Factory')

    const registerTx = await hypervisor.registerVaultFactory(args.visorFactory)

    console.log('  in', registerTx.hash)

    // transfer ownership

    const powerSwitch = await ethers.getContractAt(
      'PowerSwitch',
      await hypervisor.getPowerSwitch(),
      signer,
    )

    console.log('Transfer admin')

    const transferAdminTx = await hypervisor.transferOwnership(args.owner)

    console.log('  to', await hypervisor.owner())
    console.log('  in', transferAdminTx.hash)

    console.log('Transfer power controller')

    const transferPowerTx = await powerSwitch.transferOwnership(args.owner)

    console.log('  to', await powerSwitch.owner())
    console.log('  in', transferPowerTx.hash)

    // verify source

    if (args.verify) {
      await hypervisor.deployTransaction.wait(5)

      await run('verify:verify', {
        address: hypervisor.address,
        constructorArguments: hypervisorArgs,
      })
    }
  })

task('unstake-and-claim', 'Unstake lp tokens and claim reward')
  .addParam('visor', 'visor vault contract')
  .addParam('hypervisor', 'Hypervisor reward contract')
  .addParam('recipient', 'Address to receive stake and reward')
  .addParam('amount', 'Amount of staking tokens with decimals')
  .setAction(async (args, { ethers, run, network }) => {
    // log config

    console.log('Network')
    console.log('  ', network.name)
    console.log('Task Args')
    console.log(args)

    // compile

    await run('compile')

    // get signer

    let signer = (await ethers.getSigners())[0]
    console.log('Signer')
    console.log('  at', signer.address)
    console.log('  ETH', formatEther(await signer.getBalance()))
    const signerWallet = Wallet.fromMnemonic(process.env.DEV_MNEMONIC || '')
    expect(signer.address).to.be.eq(signerWallet.address)

    // fetch contracts

    const hypervisor = await ethers.getContractAt('Hypervisor', args.hypervisor, signer)
    const stakingToken = await ethers.getContractAt(
      IUniswapV2ERC20.abi,
      (await hypervisor.getHypervisorData()).stakingToken,
      signer,
    )
    const visor = await ethers.getContractAt(
      'Visor',
      args.visor,
      signer,
    )

    // declare config

    const amount = parseUnits(args.amount, await stakingToken.decimals())
    const nonce = await visor.getNonce()
    const recipient = args.recipient

    // validate balances

    expect(await stakingToken.balanceOf(visor.address)).to.be.gte(amount)

    // craft permission

    console.log('Sign Unlock permission')

    const permission = await signPermission(
      'Unlock',
      visor,
      signerWallet,
      hypervisor.address,
      stakingToken.address,
      amount,
      nonce,
    )

    console.log('Unstake and Claim')

    const unstakeTx = await hypervisor.unstakeAndClaim(
      visor.address,
      recipient,
      amount,
      permission,
    )

    console.log('  in', unstakeTx.hash)

    console.log('Withdraw from visor')

    const withdrawTx = await visor.transferERC20(
      stakingToken.address,
      recipient,
      amount,
    )

    console.log('  in', withdrawTx?.hash)
  })

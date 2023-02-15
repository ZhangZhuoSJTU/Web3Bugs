import IUniswapV2ERC20 from '@uniswap/v2-core/build/IUniswapV2ERC20.json'
import { expect } from 'chai'
import { Wallet } from 'ethers'
import { formatEther, parseUnits, randomBytes } from 'ethers/lib/utils'
import { task } from 'hardhat/config'
import { deployContract, signPermission, signPermitEIP2612 } from './utils'

task('deploy-mainframe', 'Deploy Mainframe contract')
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

    // deploy contract

    const mainframe = await deployContract(
      'Mainframe',
      await ethers.getContractFactory('Mainframe'),
      signer,
    )

    // verify source

    if (args.verify) {
      console.log('Verifying source on etherscan')

      await mainframe.deployTransaction.wait(5)

      await run('verify:verify', {
        address: mainframe.address,
      })
    }
  })

task('mint-and-lock', 'Mint Visor and lock in Hypervisor')
  .addParam('hypervisor', 'Hypervisor reward contract')
  .addParam('visorFactory', 'Visor factory contract')
  .addParam('mainframe', 'Mainframe contract')
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

    const signer = (await ethers.getSigners())[0]
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
    const visorFactory = await ethers.getContractAt(
      'VisorFactory',
      args.visorFactory,
      signer,
    )
    const mainframe = await ethers.getContractAt(
      'Mainframe',
      args.mainframe,
      signer,
    )

    // declare config

    const amount = parseUnits(args.amount, await stakingToken.decimals())
    const salt = randomBytes(32)
    const deadline =
      (await ethers.provider.getBlock('latest')).timestamp + 60 * 60 * 24

    // validate balances
    expect(await stakingToken.balanceOf(signer.address)).to.be.gte(amount)

    // craft permission

    const visor = await ethers.getContractAt(
      'Visor',
      await mainframe.predictDeterministicAddress(
        await visorFactory.getTemplate(),
        salt,
        visorFactory.address,
      ),
      signer,
    )

    console.log('Sign Permit')

    const permit = await signPermitEIP2612(
      signerWallet,
      stakingToken,
      mainframe.address,
      amount,
      deadline,
    )

    console.log('Sign Lock')

    const permission = await signPermission(
      'Lock',
      visor,
      signerWallet,
      hypervisor.address,
      stakingToken.address,
      amount,
      0,
    )

    console.log('Mint, Deposit, Stake')

    const tx = await mainframe.mintVisorPermitAndStake(
      hypervisor.address,
      visorFactory.address,
      signer.address,
      salt,
      permit,
      permission,
    )
    console.log('  in', tx.hash)
  })

task('lock', 'Lock in Hypervisor') // TODO get this working
  .addParam('hypervisor', 'Hypervisor reward contract')
  .addParam('visor', 'Visor contract')
  .addParam('mainframe', 'Mainframe contract')
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

    const signer = (await ethers.getSigners())[0]
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
    const visor = await ethers.getContractAt('Visor', args.visor, signer)
    const mainframe = await ethers.getContractAt(
      'Mainframe',
      args.mainframe,
      signer,
    )

    // declare config

    const amount = parseUnits(args.amount, await stakingToken.decimals())
    const deadline =
      (await ethers.provider.getBlock('latest')).timestamp + 60 * 60 * 24

    // validate balances
    expect(await stakingToken.balanceOf(signer.address)).to.be.gte(amount)

    console.log('Sign Permit')

    const permit = await signPermitEIP2612(
      signerWallet,
      stakingToken,
      mainframe.address,
      amount,
      deadline,
    )

    console.log('Sign Lock')

    const permission = await signPermission(
      'Lock',
      visor,
      signerWallet,
      hypervisor.address,
      stakingToken.address,
      amount,
      0,
    )

    console.log('Deposit, Stake')

    const tx = await mainframe.permitAndStake(
      hypervisor.address,
      visor.address,
      permit,
      permission,
    )
    console.log('  in', tx.hash)
  })

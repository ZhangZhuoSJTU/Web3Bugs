import { expect } from 'chai'
import { Wallet } from 'ethers'
import { formatEther, parseUnits } from 'ethers/lib/utils'
import { task } from 'hardhat/config'
import { deployContract } from './utils'

task('deploy-visor-factory', 'Deploy Visor factory contracts')
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

    const visor = await deployContract(
      'Visor',
      await ethers.getContractFactory('Visor'),
      signer,
    )
    const visorFactory = await deployContract(
      'VisorFactory',
      await ethers.getContractFactory('VisorFactory'),
      signer,
    )

    // lock template

    console.log('Locking template')

    await visor.initializeLock()

    const name = ethers.utils.formatBytes32String('VISOR-1.0.0')

    const tx = await visorFactory.addTemplate(name, visor.address);
    console.log('addTemplate tx ', tx.hash);


    // verify source

    if (args.verify) {
      console.log('Verifying source on etherscan')

      await visorFactory.deployTransaction.wait(5)

      await run('verify:verify', {
        address: visor.address,
      })
      await run('verify:verify', {
        address: visorFactory.address,
      })
    }
  })

task('add-template', 'Add a new nft template to the factory')
  .addParam('factory', 'Visor factory address')
  .addParam('template', 'Address of the nft template to add')
  .addParam('name', 'Name to give nft template in factory')
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

    const factory = await ethers.getContractAt(
      'VisorFactory',
      args.factory,
      signer,
    )

    let name = ethers.utils.formatBytes32String(args.name)
    let tx = await factory.addTemplate(name, args.template);
    console.log('addTemplate tx ', tx.hash);
  })

task('mint-visor-select', 'Mint selected Visor')
  .addParam('factory', 'Visor factory address')
  .addParam('name', 'Name of Visor to mint')
  .addParam('owner', 'the owner of the Visor')
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

    const factory = await ethers.getContractAt(
      'VisorFactory',
      args.factory,
      signer,
    )

    const name = ethers.utils.formatBytes32String(args.name)

    // deploy instance
    const tx = await factory.createSelected(name);

    console.log('Deploying Visor')
    console.log('  in', tx.hash)

    // transfer ownership

    /* await tx.wait() */

    /* const transferTx = await factory.transferFrom( */
    /*   signer.address, */
    /*   args.owner, */
    /*   visor.address, */
    /* ) */
    /* console.log('Transfer ownership') */
    /* console.log('  to', args.owner) */
    /* console.log('  in', transferTx.hash) */
  })

task('transfer-owner', 'Transfer ownership of Visor')
  .addParam('factory', 'Visor factory address')
  .addParam('owner', 'Desired owner of the Visor')
  .addParam('visor', 'Address of the Visor')
  .setAction(async (args, { ethers, run, network }) => {
    // log config

    console.log('Network')
    console.log('  ', network.name)
    console.log('Task Args')
    console.log(args)

    // get signer

    const signer = (await ethers.getSigners())[0]
    console.log('Signer')
    console.log('  at', signer.address)
    console.log('  ETH', formatEther(await signer.getBalance()))


    const visor = await ethers.getContractAt(
      'Visor',
      args.visor,
      signer,
    )

    const factory = await ethers.getContractAt(
      'VisorFactory',
      args.factory,
      signer,
    )

    const transferTx = await factory.transferFrom(
      signer.address,
      args.owner,
      visor.address,
    )

  })

task('mint-visor-default', 'Mint default Visor instance')
  .addParam('factory', 'the Visor factory address')
  .addParam('owner', 'the owner of the Visor')
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

    const factory = await ethers.getContractAt(
      'VisorFactory',
      args.factory,
      signer,
    )

    // deploy instance

    const visor = await ethers.getContractAt(
      'Visor',
      await factory.callStatic['create()'](),
    )

    const tx = await factory['create()']()

    console.log('Deploying Visor')
    console.log('  to', visor.address)
    console.log('  in', tx.hash)

    // transfer ownership

    await tx.wait()

    const transferTx = await factory.transferFrom(
      signer.address,
      args.owner,
      visor.address,
    )
    console.log('Transfer ownership')
    console.log('  to', args.owner)
    console.log('  in', transferTx.hash)
  })

task('visor-withdraw', 'Withdraw tokens from visor')
  .addParam('token', 'Token contract')
  .addParam('visor', 'Visor vault contract')
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

    const token = await ethers.getContractAt(
      'IERC20Detailed',
      args.token,
      signer,
    )
    const visor = await ethers.getContractAt(
      'Visor',
      args.visor,
      signer,
    )

    // declare config

    const amount = parseUnits(args.amount, await token.decimals())
    const recipient = args.recipient

    // validate balances

    const balance = await token.balanceOf(visor.address)
    const lock = await visor.getBalanceLocked(token.address)
    expect(balance.sub(lock)).to.be.gte(amount)

    console.log('Withdraw from visor')

    const withdrawTx = await visor.transferERC20(
      token.address,
      recipient,
      amount,
    )

    console.log('  in', withdrawTx.hash)
})

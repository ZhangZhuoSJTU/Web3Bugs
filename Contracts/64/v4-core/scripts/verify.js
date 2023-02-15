#!/usr/bin/env node
const chalk = require('chalk')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const hardhat = require('hardhat')

const info = (msg) => console.log(chalk.dim(msg))
const success = (msg) => console.log(chalk.green(msg))
const error = (msg) => console.error(chalk.red(msg))

const getContract = async (name) => {
  const { deployments } = hardhat
  const signers = await hardhat.ethers.getSigners()
  return hardhat.ethers.getContractAt(name, (await deployments.get(name)).address, signers[0])
}

const verifyAddress = async (address, name) => {
  const network = hardhat.network.name
  const config = isBinance() ? '--config hardhat.config.bsc.js' : ''
  try {
    await exec(`hardhat ${config} verify --network ${network} ${address}`)
  } catch (e) {
    if (/Contract source code already verified/.test(e.message)) {
      info(`${name} already verified`)
    } else {
      error(e.message)
      console.error(e)
    }
  }
}

const verifyProxyFactory = async (name) => {
  const proxyFactory = await getContract(name)
  const instanceAddress = await proxyFactory.instance()
  info(`Verifying ${name} instance at ${instanceAddress}...`)
  await verifyAddress(instanceAddress, name)
  success(`Verified!`)
}

function isBinance() {
  const network = hardhat.network.name
  return /bsc/.test(network);
}

function etherscanApiKey() {
  if (isBinance()) {
    return process.env.BSCSCAN_API_KEY
  } else {
    return process.env.ETHERSCAN_API_KEY
  }
}

async function run() {
  const network = hardhat.network.name

  info(`Verifying top-level contracts...`)
  const { stdout, stderr } = await exec(
    `hardhat --network ${network} etherscan-verify --solc-input --api-key ${etherscanApiKey()}`
  )
  console.log(chalk.yellow(stdout))
  console.log(chalk.red(stderr))
  info(`Done top-level contracts`)

  info(`Verifying proxy factory instances...`)

  await verifyProxyFactory('CompoundPrizePoolProxyFactory')
  await verifyProxyFactory('ControlledTokenProxyFactory')
  await verifyProxyFactory('MultipleWinnersProxyFactory')
  await verifyProxyFactory('StakePrizePoolProxyFactory')
  await verifyProxyFactory('TicketProxyFactory')
  await verifyProxyFactory('TokenFaucetProxyFactory')
  await verifyProxyFactory('YieldSourcePrizePoolProxyFactory')

  success('Done!')
}

run()

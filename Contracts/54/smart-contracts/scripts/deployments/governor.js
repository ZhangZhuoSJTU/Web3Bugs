const { ethers, upgrades, network } = require('hardhat')
const OZ_SDK_EXPORT = require('../../openzeppelin-cli-export.json')

const { getNetworkName } = require('../../helpers/network')
const { getDeployment, addDeployment } = require('../../helpers/deployments')
const { addUDT } = require('../../test/helpers/mainnet')

const ZERO_ADDRESS = web3.utils.padLeft(0, 40)

const TIMELOCK_ADMIN_ROLE = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('TIMELOCK_ADMIN_ROLE')
)
const PROPOSER_ROLE = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('PROPOSER_ROLE')
)

async function main() {
  const [unlockOwner] = await ethers.getSigners()

  // fetch chain info
  const chainId = await unlockOwner.getChainId()
  const networkName = getNetworkName(chainId)

  // eslint-disable-next-line no-console
  console.log(
    `Deploying Governor on ${networkName} with the account: ${unlockOwner.address}...`
  )

  // deploying Unlock Protocol with a proxy
  const UnlockProtocolTimelock = await ethers.getContractFactory(
    'UnlockProtocolTimelock'
  )

  // time lock in seconds
  const oneWeekInSeconds = 60 * 60 * 24 * 7
  const MINDELAY = networkName === 'localhost' ? 30 : oneWeekInSeconds

  const timelock = await upgrades.deployProxy(UnlockProtocolTimelock, [
    MINDELAY,
    [], // proposers list is empty at deployment
    [ZERO_ADDRESS], // allow any address to execute a proposal once the timelock has expired
  ])
  await timelock.deployed()

  // eslint-disable-next-line no-console
  console.log(
    '> Timelock w proxy deployed at:',
    timelock.address,
    ` (tx: ${timelock.deployTransaction.hash})`
  )

  // save deployment info
  await addDeployment('UnlockProtocolTimelock', timelock, true)

  // deploying Unlock Protocol with a proxy
  const UnlockProtocolGovernor = await ethers.getContractFactory(
    'UnlockProtocolGovernor'
  )

  // get UDT token address
  let tokenAddress
  if (networkName === 'localhost') {
    const UDTInfo = await getDeployment(chainId, 'UnlockDiscountTokenV2')
    tokenAddress = UDTInfo.address
  } else {
    const [UDTInfo] =
      OZ_SDK_EXPORT.networks[networkName].proxies[
        'unlock-protocol/UnlockDiscountToken'
      ]
    tokenAddress = UDTInfo.address
  }

  // deploy governor proxy
  const governor = await upgrades.deployProxy(UnlockProtocolGovernor, [
    tokenAddress,
    timelock.address,
  ])
  await governor.deployed()

  // eslint-disable-next-line no-console
  console.log(
    '> Governor deployed (w proxy) at:',
    governor.address,
    ` (tx: ${governor.deployTransaction.hash})`
  )

  if (networkName === 'localhost') {
    // bring default voting period to 10 blocks while developing locally
    await network.provider.send('hardhat_setStorageAt', [
      governor.address,
      '0x1c7', // '455' storage slot
      '0x0000000000000000000000000000000000000000000000000000000000000032', // 50 blocks
    ])

    // grant timelock some UDT
    await addUDT(timelock.address, 10000)
  }

  // save deployment info
  await addDeployment('UnlockProtocolGovernor', governor, true)

  // governor should be the only proposer
  await timelock.grantRole(PROPOSER_ROLE, governor.address)

  // eslint-disable-next-line no-console
  console.log(
    '> Governor added to Timelock as sole proposer. ',
    `${governor.address} is Proposer: ${await timelock.hasRole(
      PROPOSER_ROLE,
      governor.address
    )} `
  )

  // deployer should renounced the Admin role after setup (leaving only Timelock as Admin)
  await timelock.renounceRole(TIMELOCK_ADMIN_ROLE, unlockOwner.address)

  // eslint-disable-next-line no-console
  console.log(
    '> Unlock Owner recounced Admin Role. ',
    `${unlockOwner.address} isAdmin: ${await timelock.hasRole(
      TIMELOCK_ADMIN_ROLE,
      unlockOwner.address
    )} `
  )
}

if (require.main === module) {
  /* eslint-disable promise/prefer-await-to-then, no-console */
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

module.exports = main

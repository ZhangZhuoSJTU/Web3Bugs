const { ethers } = require('hardhat')

// /unlockMultisigAddress
const multisigABI = require('../test/helpers/ABIs/multisig.json')
const proxyABI = require('../test/helpers/ABIs/proxy.json')
const { impersonate } = require('../test/helpers/mainnet')

const UNLOCK_MULTISIG_ADDRESS = '0xa39b44c4AFfbb56b76a1BF1d19Eb93a5DfC2EBA9'

const getUnlockMultisig = async () => {
  return await ethers.getContractAt(multisigABI, UNLOCK_MULTISIG_ADDRESS)
}

const getUnlockMultisigOwners = async () => {
  const multisig = await getUnlockMultisig()
  return await multisig.getOwners()
}

const encodeUpgradeTxData = async ({ proxyAddress, implementation }) => {
  // build upgrade tx
  const proxy = await ethers.getContractAt(proxyABI, proxyAddress)
  const data = proxy.interface.encodeFunctionData('upgrade', [
    proxyAddress,
    implementation,
  ])
  return data
}

// test helper to reach concensus on multisig
const confirmMultisigTx = async ({ transactionId }) => {
  const multisig = await getUnlockMultisig()
  const signers = await multisig.getOwners()
  const txs = await Promise.all(
    signers.slice(1, 4).map(async (signerAddress) => {
      await impersonate(signerAddress)
      const signer = await ethers.getSigner(signerAddress)

      const m = multisig.connect(signer)
      const tx = await m.confirmTransaction(transactionId, {
        gasLimit: 1200000,
      })
      return await tx.wait()
    })
  )
  const [lastTx] = txs.slice(-1)
  const { events, transactionHash } = lastTx
  const failure = events.find((v) => v.event === 'ExecutionFailure')
  const success = events.find((v) => v.event === 'Execution')

  if (failure) {
    // eslint-disable-next-line no-console
    console.log(
      `ERROR: Proposal ${transactionId} failed to execute (txid: ${transactionHash})`
    )
  } else if (success) {
    // eslint-disable-next-line no-console
    console.log(
      `Proposal ${transactionId} executed successfully (txid: ${transactionHash})`
    )
  }
}

module.exports = {
  getUnlockMultisig,
  getUnlockMultisigOwners,
  confirmMultisigTx,
  encodeUpgradeTxData,
  UNLOCK_MULTISIG_ADDRESS,
}

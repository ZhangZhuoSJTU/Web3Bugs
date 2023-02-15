const { ethers } = require('hardhat')
const { parseProposal, submitProposal } = require('../../helpers/gov')
const { impersonate } = require('../../test/helpers/mainnet')

async function main({
  proposerAddress,
  contractName,
  functionName,
  functionArgs,
  proposalName,
}) {
  // env settings
  const { chainId } = await ethers.provider.getNetwork()
  const isDev = chainId === 31337

  if (!proposerAddress) {
    // eslint-disable-next-line no-console
    throw new Error('GOV SUBMIT > Missing proposer address.')
  }
  if (!functionName) {
    // eslint-disable-next-line no-console
    throw new Error('GOV SUBMIT > Missing function name.')
  }
  if (!functionArgs) {
    // eslint-disable-next-line no-console
    throw new Error('GOV SUBMIT > Missing function args.')
  }
  if (!proposalName) {
    // eslint-disable-next-line no-console
    throw new Error('GOV SUBMIT > Missing proposal name.')
  }

  const proposal = await parseProposal({
    contractName,
    functionName,
    functionArgs,
    proposalName,
  })

  // eslint-disable-next-line no-console
  console.log(
    `GOV SUBMIT > Proposed: ${contractName} ${functionName} ${functionArgs}`
  )

  // submit the proposal
  if (isDev) {
    await impersonate(proposerAddress)
  }
  // eslint-disable-next-line no-console
  console.log(`GOV SUBMIT > Proposer: ${proposerAddress}`)
  const proposalTx = await submitProposal({ proposerAddress, proposal })

  const { events, transactionHash } = await proposalTx.wait()
  const evt = events.find((v) => v.event === 'ProposalCreated')

  // check for failure
  if (!evt) {
    throw new Error('GOV SUBMIT > Proposal not created.')
  }

  // success
  const { proposalId } = evt.args
  // eslint-disable-next-line no-console
  console.log(
    `GOV SUBMIT > proposal submitted: ${await proposalId.toString()} (txid: ${transactionHash})`
  )

  return proposalId
}

// execute as standalone
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

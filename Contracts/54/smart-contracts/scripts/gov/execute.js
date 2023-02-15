const { ethers } = require('hardhat')
const { time } = require('@openzeppelin/test-helpers')
const { getDeployment } = require('../../helpers/deployments')
const {
  getProposalState,
  executeProposal,
  getProposalId,
} = require('../../helpers/gov')

async function main({ proposal }) {
  // env settings
  const { chainId } = await ethers.provider.getNetwork()
  const isDev = chainId === 31337

  if (!proposal) {
    throw new Error('GOV EXEC > Missing proposal.')
  }

  const proposalId = await getProposalId(proposal)

  // contract instance etc
  let state = await getProposalState(proposalId)
  const { address, abi } = getDeployment(chainId, 'UnlockProtocolGovernor')
  const gov = await ethers.getContractAt(abi, address)

  // check if time is ripe
  if (state === 'Queued') {
    const eta = await gov.proposalEta(proposalId)
    const currentTime = (await time.latest()).toNumber()
    // reach proposal ETA
    if (!isDev) {
      throw new Error(
        `GOV EXEC > Proposal still queued until: ${new Date(
          eta.toNumber() * 1000
        )}`
      )
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `GOV EXEC > : increasing currentTime ${new Date(
          currentTime * 1000
        )} to eta ${new Date(eta * 1000)}`
      )
      if (currentTime < eta) {
        await time.increaseTo(eta + 1)
      }
      state = await getProposalState(proposalId)
    }
  }

  if (state === 'Queued') {
    // execute the tx
    const tx = await executeProposal({ proposal })
    const { events, transactionHash } = await tx.wait()
    const evt = events.find((v) => v.event === 'ProposalExecuted')
    if (evt) {
      // eslint-disable-next-line no-console
      console.log(
        `GOV EXEC > Proposal executed successfully (txid: ${transactionHash})`
      )
    }
  } else if (state === 'Executed') {
    throw new Error('GOV EXEC > Proposal has already been executed')
  } else {
    throw new Error(
      `GOV VOTE > Proposal state (${state}) does not allow execution.`
    )
  }
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

/* eslint-disable global-require */
const { task } = require('hardhat/config')
const { resolve } = require('path')

task('gov', 'Submit (and validate) a proposal to UDT Governor contract')
  .addParam('proposal', 'The file containing the proposal')
  .setAction(async ({ proposal }) => {
    const processProposal = require('../scripts/gov')
    return await processProposal({ proposal })
  })

/**
 * Governor Workflow
 */
task('gov:submit', 'Submit a proposal to UDT Governor contract')
  .addParam('proposal', 'The file containing the proposal')
  .setAction(async ({ proposal }) => {
    const submitProposal = require('../scripts/gov/submit')

    // eslint-disable-next-line import/no-dynamic-require
    const prop = require(resolve(proposal))
    return await submitProposal({ ...prop })
  })

task('gov:vote', 'Vote for a proposal on UDT Governor contract')
  .addParam('proposal', 'The file containing the proposal')
  .addOptionalParam('voter', 'The address of the voter')
  .setAction(async ({ proposal: proposalPath, voter }) => {
    const voteProposal = require('../scripts/gov/vote')
    const { getProposalId } = require('../helpers/gov')

    // eslint-disable-next-line import/no-dynamic-require
    const proposal = require(resolve(proposalPath))
    const proposalId = await getProposalId(proposal)

    return await voteProposal({ proposalId, voter })
  })

task('gov:queue', 'Queue proposal in timelock')
  .addParam('proposal', 'The file containing the proposal')
  .setAction(async ({ proposal: proposalPath }) => {
    const executeProposal = require('../scripts/gov/queue')

    // eslint-disable-next-line import/no-dynamic-require
    const proposal = require(resolve(proposalPath))
    return await executeProposal({ proposal })
  })

task('gov:execute', 'Closing vote period and execute a proposal (local only)')
  .addParam('proposal', 'The file containing the proposal')
  .setAction(async ({ proposal: proposalPath }) => {
    const executeProposal = require('../scripts/gov/execute')

    // eslint-disable-next-line import/no-dynamic-require
    const proposal = require(resolve(proposalPath))
    return await executeProposal({ proposal })
  })

/**
 * Governor Utils
 */
task('gov:votes', 'Show votes for a specific proposal')
  .addParam('proposal', 'The file containing the proposal')
  .setAction(async ({ proposal: proposalPath }) => {
    const { getProposalVotes, getProposalId } = require('../helpers/gov')

    // eslint-disable-next-line import/no-dynamic-require
    const proposal = require(resolve(proposalPath))

    const proposalId = await getProposalId(proposal)
    const votes = await getProposalVotes(proposalId)

    // eslint-disable-next-line no-console
    console.log(`Current proposal votes (against, for, abstain): ${votes}`)
  })

task('gov:state', 'Check proposal state')
  .addParam('proposalId', 'The proposal id')
  .setAction(async ({ proposal }) => {
    const { getProposalState, getProposalId } = require('../helpers/gov')

    // eslint-disable-next-line import/no-dynamic-require
    const prop = require(resolve(proposal))
    const proposalId = getProposalId(prop)
    const state = await getProposalState(proposalId)
    // eslint-disable-next-line no-console
    console.log(`Current proposal state: ${state}`)
  })

task('gov:id', 'Retrieve proposal ID')
  .addParam('proposal', 'The file containing the proposal')
  .setAction(async ({ proposal }) => {
    const { getProposalId } = require('../helpers/gov')

    // eslint-disable-next-line import/no-dynamic-require
    const prop = require(resolve(proposal))
    const proposalId = await getProposalId(prop)
    // eslint-disable-next-line no-console
    console.log(`Proposal id: ${proposalId}`)
  })

task('gov:delegate', 'Delagate voting power')
  .addParam('delegate', 'The delegate receving the voting power')
  .addOptionalParam('holder', 'The holder address')
  .setAction(async ({ delegate, holder }) => {
    const delegateVote = require('../scripts/gov/delegate')

    // eslint-disable-next-line import/no-dynamic-require
    return await delegateVote({
      delegateAddress: delegate,
      holderAddress: holder,
    })
  })

const { ethers } = require('hardhat')
const { getDeployment } = require('./deployments')

const encodeProposalFunc = ({ interface, functionName, functionArgs }) => {
  const calldata = interface.encodeFunctionData(functionName, [...functionArgs])
  return calldata
}

const getProposalId = async (proposal) => {
  const [targets, values, calldata, description] = await parseProposal(proposal)

  const descriptionHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(description)
  )

  // solidityKeccak256
  const proposalId = ethers.BigNumber.from(
    ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256[]', 'bytes[]', 'bytes32'],
        [targets, values, calldata, descriptionHash]
      )
    )
  )

  return proposalId
}

const getProposalIdFromContract = async (proposal) => {
  const { proposerAddress } = proposal
  const [to, value, calldata, description] = await parseProposal(proposal)

  const { chainId } = await ethers.provider.getNetwork()
  const { address, abi } = getDeployment(chainId, 'UnlockProtocolGovernor')

  const proposerWallet = await ethers.getSigner(proposerAddress)
  const gov = new ethers.Contract(address, abi, proposerWallet)

  const descriptionHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(description)
  )

  const proposalId = await gov.hashProposal(
    to,
    value,
    calldata,
    descriptionHash
  )

  return proposalId
}

const parseProposal = async ({
  contractName,
  functionName,
  functionArgs,
  proposalName,
  value = 0,
}) => {
  // get contract instance
  const { chainId } = await ethers.provider.getNetwork()
  const { abi, address } = await getDeployment(chainId, contractName)
  const { interface } = new ethers.Contract(address, abi)

  // parse function data
  const calldata = encodeProposalFunc({ interface, functionName, functionArgs })

  return [
    [address], // contract to send the proposal to
    [value], // value in ETH, default to 0
    [calldata], // encoded func call
    proposalName,
  ]
}

const queueProposal = async ({ proposal }) => {
  const { proposerAddress } = proposal
  const [targets, values, calldatas, description] = await parseProposal(
    proposal
  )
  const descriptionHash = web3.utils.keccak256(description)
  const voterWallet = await ethers.getSigner(proposerAddress)

  const { chainId } = await ethers.provider.getNetwork()
  const { address, abi } = getDeployment(chainId, 'UnlockProtocolGovernor')

  const gov = await new ethers.Contract(address, abi, voterWallet)
  return await gov.queue(targets, values, calldatas, descriptionHash)
}

const executeProposal = async ({ proposal }) => {
  const { proposerAddress } = proposal
  const [targets, values, calldatas, description] = await parseProposal(
    proposal
  )
  const descriptionHash = web3.utils.keccak256(description)
  const voterWallet = await ethers.getSigner(proposerAddress)

  const { chainId } = await ethers.provider.getNetwork()
  const { address, abi } = getDeployment(chainId, 'UnlockProtocolGovernor')

  const gov = await new ethers.Contract(address, abi, voterWallet)
  return await gov.execute(targets, values, calldatas, descriptionHash)
}

/**
 * Submits a proposal
 */
const submitProposal = async ({ proposerAddress, proposal }) => {
  const { chainId } = await ethers.provider.getNetwork()
  const { address, abi } = getDeployment(chainId, 'UnlockProtocolGovernor')
  const proposerWallet = await ethers.getSigner(proposerAddress)
  const gov = new ethers.Contract(address, abi, proposerWallet)
  return await gov.propose(...proposal)
}

const getProposalVotes = async (proposalId) => {
  const { chainId } = await ethers.provider.getNetwork()
  const { address, abi } = getDeployment(chainId, 'UnlockProtocolGovernor')
  const gov = await ethers.getContractAt(abi, address)
  const votes = await gov.proposalVotes(proposalId)
  return votes
}
const getProposalState = async (proposalId) => {
  const states = [
    'Pending',
    'Active',
    'Canceled',
    'Defeated',
    'Succeeded',
    'Queued',
    'Expired',
    'Executed',
  ]

  const { chainId } = await ethers.provider.getNetwork()
  const { address, abi } = getDeployment(chainId, 'UnlockProtocolGovernor')
  const gov = await ethers.getContractAt(abi, address)
  const state = await gov.state(proposalId)
  return states[state]
}

module.exports = {
  getProposalVotes,
  getProposalState,
  encodeProposalFunc,
  getProposalId,
  getProposalIdFromContract,
  parseProposal,
  submitProposal,
  queueProposal,
  executeProposal,
}

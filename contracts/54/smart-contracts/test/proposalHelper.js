const { ethers } = require('hardhat')
const {
  encodeProposalFunc,
  parseProposal,
  getProposalId,
  getProposalIdFromContract,
} = require('../helpers/gov')
const { getDeployment } = require('../helpers/deployments')

const tokenRecipientAddress = '0x8d533d1A48b0D5ddDEF513A0B0a3677E991F3915' // ramdomly generated but deterministic for tests

contract('Proposal Helper', () => {
  let udt
  let interface
  beforeEach(async () => {
    udt = await ethers.getContractFactory('UnlockDiscountTokenV2')
    ;({ interface } = udt)
  })

  describe('calldata encoder', () => {
    it('encode correctly a function call', () => {
      const encoded = encodeProposalFunc({
        interface,
        functionName: 'transfer',
        functionArgs: [
          tokenRecipientAddress,
          ethers.utils.parseUnits('0.01', 18),
        ],
      })
      assert.equal(
        encoded,
        '0xa9059cbb0000000000000000000000008d533d1a48b0d5dddef513a0b0a3677e991f3915000000000000000000000000000000000000000000000000002386f26fc10000'
      )
    })
    it('throw if function does not exist', () => {
      assert.throws(() =>
        encodeProposalFunc({
          interface,
          functionName: 'doesNotExist',
          functionArgs: [],
        })
      )
    })
    it('throw if parameters are wrong', () => {
      assert.throws(() =>
        encodeProposalFunc({
          interface,
          functionName: 'transfer',
          functionArgs: [],
        })
      )
    })
  })

  describe('proposal parser', () => {
    it('encode correctly a function call', async () => {
      const { address } = getDeployment(31337, 'UnlockDiscountTokenV2')
      const proposalName = 'Send some tokens to a grantee'

      const [to, value, calldata, proposalNameParsed] = await parseProposal({
        contractName: 'UnlockDiscountTokenV2',
        functionName: 'transfer',
        functionArgs: [
          tokenRecipientAddress,
          ethers.utils.parseUnits('0.01', 18),
        ],
        proposalName,
      })

      assert.equal(to[0], address)
      assert.equal(value[0], 0)
      assert.equal(calldata[0], [
        '0xa9059cbb0000000000000000000000008d533d1a48b0d5dddef513a0b0a3677e991f3915000000000000000000000000000000000000000000000000002386f26fc10000',
      ])
      assert.equal(proposalNameParsed, proposalName)
    })
  })

  describe('proposal ID', () => {
    it('can be retrieved', async () => {
      // eslint-disable-next-line global-require
      const proposalExample = require('../proposals/000-example')
      const proposalId = await getProposalId(proposalExample)
      const proposalIdFromContract = await getProposalIdFromContract(
        proposalExample
      )
      assert.equal(proposalId.toString(), proposalIdFromContract.toString())
    })
  })
})

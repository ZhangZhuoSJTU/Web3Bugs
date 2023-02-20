const ethers = require('ethers')

const tokenRecipientAddress = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8'
const proposerAddress = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'

module.exports = {
  contractName: 'UnlockDiscountTokenV2',
  functionName: 'transfer',
  functionArgs: [tokenRecipientAddress, ethers.utils.parseUnits('0.01', 18)],
  proposalName: '#000 This is just an example!',
  proposerAddress,
  // no payable value specified default to 0
}

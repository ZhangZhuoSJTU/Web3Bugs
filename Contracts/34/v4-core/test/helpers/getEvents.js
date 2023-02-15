const hardhat = require('hardhat')

async function getEvents(contract, tx) {
  let receipt = await hardhat.ethers.provider.getTransactionReceipt(tx.hash)
  return receipt.logs.reduce((parsedEvents, log) => {
    try {
      parsedEvents.push(contract.interface.parseLog(log))
    } catch (e) {}
    return parsedEvents
  }, [])
}

module.exports = { getEvents }

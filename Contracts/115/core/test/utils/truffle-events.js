const fs = require("fs");
const abiDecoder = require("abi-decoder");

module.exports = {
  decodeEvents(transaction, contractName) {
    const abi = this.getAbi(contractName);
    abiDecoder.addABI(abi);
    const logs = transaction.receipt.rawLogs;
    const _decoded = abiDecoder.decodeLogs(logs);

    const processedEvents = [];
    _decoded.forEach((logItem) => {
      if (!logItem)
        // Skip events that did not get parsed
        return;
      const temporaryArgs = {};
      const processedEvent = { event: logItem.name };
      for (let i = 0; i < logItem.events.length; i++) {
        const key = logItem.events[i].name;
        const { value } = logItem.events[i];
        temporaryArgs[`${key}`] = value;
      }

      processedEvent.args = temporaryArgs;
      processedEvents.push(processedEvent);
    });

    return processedEvents;
  },

  getAbi(contractName) {
    const c = JSON.parse(fs.readFileSync(`./build/contracts/${contractName}.json`, `utf8`));
    return c.abi;
  },
};

const { assert } = require('chai');
const { ethers } = require('hardhat');

const deployContract = async (contractName, args) => {
  [alice] = await ethers.getSigners();
  const Contract = await ethers.getContractFactory(contractName);
  const contract = await Contract.connect(alice).deploy(...(args || []));
  await contract.deployed();

  return contract;
};

const findEvents = ({ receipt, eventName }) => {
  return receipt.events?.filter((x) => {
    return x.event == eventName;
  });
};

const getParamFromEvent = (transaction, interface, eventName, paramIndex) => {
  const logs = transaction.logs.filter((l) =>
    l.topics.includes(ethers.utils.id(eventName)),
  );

  assert.equal(logs.length, 1, 'Too many logs found!');

  const event = interface.parseLog(logs[0]);
  return event.args[paramIndex];
};

module.exports = {
  getParamFromEvent,
  deployContract,
  findEvents,
};

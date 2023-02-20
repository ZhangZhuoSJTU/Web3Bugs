'use strict';

const {
  utils: { defaultAbiCoder, id, arrayify, keccak256 },
} = require('ethers');
const { sortBy } = require('lodash');

const getRandomInt = (max) => {
  return Math.floor(Math.random() * max);
};

module.exports = {
  bigNumberToNumber: (bigNumber) => bigNumber.toNumber(),

  getSignedExecuteInput: (data, wallet) =>
    wallet
      .signMessage(arrayify(keccak256(data)))
      .then((signature) =>
        defaultAbiCoder.encode(['bytes', 'bytes'], [data, signature]),
      ),

  getSignedMultisigExecuteInput: (data, wallets) =>
    Promise.all(
      sortBy(wallets, (wallet) => wallet.address.toLowerCase()).map((wallet) =>
        wallet.signMessage(arrayify(keccak256(data))),
      ),
    ).then((signatures) =>
      defaultAbiCoder.encode(['bytes', 'bytes[]'], [data, signatures]),
    ),

  getRandomInt,

  getRandomID: () => id(getRandomInt(1e10).toString()),

  tickBlockTime: (provider, seconds) =>
    provider.send('evm_increaseTime', [seconds]),
};

const Promise = require('bluebird');

const advanceTime = Promise.promisify(function(delay, done) {
    web3.currentProvider.send({
        jsonrpc: "2.0",
        "method": "evm_increaseTime",
        params: [delay]}, done)
});

const mine = Promise.promisify(function(done) {
    web3.currentProvider.send({
        jsonrpc: "2.0",
        "method": "evm_mine",
        }, done)
});


module.exports = {
    advanceTime, mine
}


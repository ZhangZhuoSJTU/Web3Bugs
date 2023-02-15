const { BigNumber } = require('ethers');

const ONE = BigNumber.from(1);
exports.MAXIMUM_U32 = ONE.shl(31);
exports.MAXIMUM_U256 = ONE.shl(255);
exports.ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const mine = async (provider) => {
    return provider.send('evm_mine', []);
};

exports.snapshot = async (provider) => {
    await provider.send('evm_snapshot', []);
    return await mine(provider);
};

exports.revert = async (provider, snapshotId) => {
    return await provider.send('evm_revert', [snapshotId]);
};

exports.increaseTime = async (provider, seconds) => {
    return provider.send('evm_increaseTime', [seconds]);
};

exports.setNextBlockTime = async (provider, time) => {
    return provider.send('evm_setNextBlockTimestamp', [time.unix()]);
};

exports.mineBlocks = async (provider, numberBlocks) => {
    for (let i = 0; i < numberBlocks; i++) {
        await provider.send('evm_mine', []);
    }
    return Promise.resolve();
};

const feeOn = (value, numerator, resolution) => {
    return ONE.mul(value).mul(numerator).div(resolution);
};

exports.takeFee = (value, numerator, resolution) => {
    return ONE.mul(value).sub(feeOn(value, numerator, resolution));
};

exports.delay = (ms) => new Promise((res) => setTimeout(res, ms));

exports.ONE = ONE;
exports.mine = mine;
exports.feeOn = feeOn;

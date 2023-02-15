const { BN } = require('web3-utils');

const constants = {
    ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
    ZERO_BYTES32: '0x0000000000000000000000000000000000000000000000000000000000000000',
    MAX_UINT256: new BN('2').pow(new BN('256')).sub(new BN('1')),
    MAX_INT256: new BN('2').pow(new BN('255')).sub(new BN('1')),
    MIN_INT256: new BN('2').pow(new BN('255')).mul(new BN('-1')),
    DEFAULT_FACTOR: new BN(10).pow(new BN(18)),
    PERCENT_FACTOR: new BN(10000),
};

module.exports = {
    constants,
};

const {ethers} = require("hardhat");
const BigNum = require("bignumber.js");

const waitNBlocks = async n => {
    await Promise.all(
        [...Array(n).keys()].map(async () => {
            await ethers.provider.send("evm_mine");
        })
    );
};

const increaseTime = async seconds => {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine");
};

const encodeParameters = (types, values) => {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
};

function etherMantissa(num, scale = 1e18) {
    if (num < 0) return ethers.BigNumber.from(new BigNum(2).pow(256).plus(num).toFixed());
    return ethers.BigNumber.from(new BigNum(num).times(scale).toFixed());
}

function etherUnsigned(num) {
    return ethers.BigNumber.from(new BigNum(num).toFixed());
}

module.exports = {
    waitNBlocks,
    increaseTime,
    encodeParameters,
    etherMantissa,
    etherUnsigned
};

const { BigNumber } = ethers

const constants = {
    _1e18: ethers.constants.WeiPerEther,
    _1e8: BigNumber.from(10).pow(8),
    _1e6: BigNumber.from(10).pow(6),
    ZERO: BigNumber.from(0),
    NULL: '0x0000000000000000000000000000000000000000'
}

async function impersonateAccount(account) {
    await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [account],
    })
}

module.exports = {
    constants,
    impersonateAccount
}

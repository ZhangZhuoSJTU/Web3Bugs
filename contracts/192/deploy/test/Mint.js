module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer, node } = await getNamedAccounts();

    const Stable = await deployments.get('StableToken');

    const chainId = await getChainId();

    if (chainId == '421613') {
        await execute(
            'StableToken',
            { from: deployer, log: true },
            'setMinter(address,bool)',
            deployer,
            true
        );

        await execute(
            'StableToken',
            { from: deployer, log: true },
            'mintFor(address,uint256)',
            deployer,
            ethers.utils.parseEther("1000000000")
        );
    }
};

module.exports.tags = ['minttest'];

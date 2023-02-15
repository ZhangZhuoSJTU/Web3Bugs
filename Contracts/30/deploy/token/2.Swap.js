module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = await getChainId();
    let { SYAX, YAX } = await getNamedAccounts();
    const YAXIS = await deployments.get('YaxisToken');

    if (chainId != '1') {
        const yax = await deployments.get('YAX');
        YAX = yax.address;
        const syax = await deployments.get('sYAX');
        SYAX = syax.address;
    }

    const Swap = await deploy('Swap', {
        from: deployer,
        log: true,
        args: [YAXIS.address, YAX, SYAX]
    });

    if (Swap.newlyDeployed) {
        await execute(
            'YaxisToken',
            { from: deployer, log: true },
            'transfer',
            Swap.address,
            ethers.utils.parseEther('1000000')
        );
    }
};

module.exports.tags = ['token'];

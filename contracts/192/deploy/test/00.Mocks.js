module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer } = await getNamedAccounts();

    const chainId = await getChainId();

    await deploy('MockDAI', {
        contract: 'MockERC20',
        from: deployer,
        log: true,
        args: ["DAI", "DAI", 18, deployer, ethers.utils.parseEther("100000000")]
    });

    await deploy('MockMIM', {
        contract: 'MockERC20',
        from: deployer,
        log: true,
        args: ["MIM", "MIM", 18, deployer, ethers.utils.parseEther("1000")]
    });

    await deploy('MockFRAX', {
        contract: 'MockERC20',
        from: deployer,
        log: true,
        args: ["FRAX", "FRAX", 18, deployer, ethers.utils.parseEther("1000")]
    });

    await deploy('MockUSDC', {
        contract: 'MockERC20',
        from: deployer,
        log: true,
        args: ["USDC", "USDC", 6, deployer, 1000000000]
    });

    await deploy('MockUSDT', {
        contract: 'MockERC20',
        from: deployer,
        log: true,
        args: ["USDT", "USDT", 6, deployer, 1000000000]
    });

    if (chainId == '31337') {
        const MockEndpoint = await deploy('MockEndpoint', {
            contract: 'LZEndpointMock',
            from: deployer,
            log: true,
            args: [31337]
        });
    }
};

module.exports.tags = ['test', 'mocktokens'];

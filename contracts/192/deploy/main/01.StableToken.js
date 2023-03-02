module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer } = await getNamedAccounts();

    const StableToken = await deploy('StableToken', {
        contract: 'StableToken',
        from: deployer,
        log: true,
        args: ["Tigris USD Stablecoin", "tigUSD"]
    });

    // await execute(
    //     'StableToken',
    //     { from: deployer, log: true },
    //     'mintFor(address,uint256)',
    //     "0xbDfa3C57d9E37e6FB6DEE067feBf081D3048fd53",
    //     ethers.utils.parseEther("100000")
    // );

    // await execute(
    //     'TradingExtension',
    //     { from: deployer, log: true },
    //     'setSpread(uint256,uint256)',
    //     0,
    //     2e6
    // );

    // await execute(
    //     'TradingExtension',
    //     { from: deployer, log: true },
    //     'setValidSignatureTimer(uint256)',
    //     120
    // );
};

module.exports.tags = ['main', 'xx'];

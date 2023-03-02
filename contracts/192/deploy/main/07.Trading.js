module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer, node } = await getNamedAccounts();

    const Stable = await deployments.get('StableToken');
    const GovNFT = await deployments.get('GovNFT');
    const StableVault = await deployments.get('StableVault');
    const Position = await deployments.get('Position');
    const PairsContract = await deployments.get('PairsContract');
    const Referrals = await deployments.get('Referrals');
    
    const TradingLibrary = await deploy('TradingLibrary', {
        contract: 'TradingLibrary',
        from: deployer,
        log: true,
        args: []
    });

    const Trading = await deploy('Trading', {
        contract: 'Trading',
        from: deployer,
        log: true,
        args: [Position.address, GovNFT.address, PairsContract.address],
        libraries: {
            TradingLibrary: TradingLibrary.address
        }
    });

    const TradingExt = await deploy('TradingExtension', {
        contract: 'TradingExtension',
        from: deployer,
        log: true,
        args: [Trading.address, PairsContract.address, Referrals.address, Position.address],
        libraries: {
            TradingLibrary: TradingLibrary.address
        }
    });

    const chainId = await getChainId();

    if (Trading.newlyDeployed) {
        await execute(
            'Trading',
            { from: deployer, log: true },
            'setTradingExtension(address)',
            TradingExt.address
        );

        await execute(
            'StableToken',
            { from: deployer, log: true },
            'setMinter(address,bool)',
            Trading.address,
            true
        );

        await execute(
            'Position',
            { from: deployer, log: true },
            'setMinter(address,bool)',
            Trading.address,
            true
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'setProtocol(address)',
            TradingExt.address
        );

        await execute(
            'Referrals',
            { from: deployer, log: true },
            'setProtocol(address)',
            TradingExt.address
        );

        await execute(
            'TradingExtension',
            { from: deployer, log: true },
            'setAllowedMargin(address,bool)',
            Stable.address,
            true
        );

        await execute(
            'TradingExtension',
            { from: deployer, log: true },
            'setNode(address,bool)',
            node,
            true
        );

        await execute(
            'Trading',
            { from: deployer, log: true },
            'setMaxWinPercent(uint256)',
            6e10
        );

        await execute(
            'Trading',
            { from: deployer, log: true },
            'setFees(bool,uint256,uint256,uint256,uint256,uint256)',
            true,
            50e5,
            50e5,
            0,
            0,
            2e9
        );

        await execute(
            'Trading',
            { from: deployer, log: true },
            'setFees(bool,uint256,uint256,uint256,uint256,uint256)',
            false,
            50e5,
            50e5,
            0,
            0,
            2e9
        );

        await execute(
            'TradingExtension',
            { from: deployer, log: true },
            'setValidSignatureTimer(uint256)',
            chainId == '137' ? 2 : 6
        );

        await execute(
            'Trading',
            { from: deployer, log: true },
            'setBlockDelay(uint256)',
            chainId == '137' ? 6 : 1
        );

        await execute(
            'TradingExtension',
            { from: deployer, log: true },
            'setMinPositionSize(address,uint256)',
            Stable.address,
            ethers.utils.parseEther("500")
        );

        await execute(
            'Trading',
            { from: deployer, log: true },
            'setAllowedVault(address,bool)',
            StableVault.address,
            true
        );
    }
};

module.exports.tags = ['main', 'maintrading', 'xxx'];

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer } = await getNamedAccounts();

    const Stable = await deployments.get('StableToken');
    const GovNFT = await deployments.get('GovNFT');
    const StableVault = await deployments.get('StableVault');
    const Position = await deployments.get('Position');
    const PairsContract = await deployments.get('PairsContract');
    const Referrals = await deployments.get('Referrals');

    const Nonce = await ethers.provider.getTransactionCount(deployer);
    
    const TradingLibrary = await deploy('TradingLibrary', {
        contract: 'TradingLibrary',
        from: deployer,
        log: true,
        nonce: Nonce,
        args: []
    });

    const Trading = await deploy('Trading', {
        contract: 'Trading',
        from: deployer,
        log: true,
        nonce: Nonce+1,
        gasLimit: 100000000,
        args: [Position.address, GovNFT.address, PairsContract.address],
        libraries: {
            TradingLibrary: TradingLibrary.address
        }
    });

    const TradingExt = await deploy('TradingExtension', {
        contract: 'TradingExtension',
        from: deployer,
        nonce: Nonce+2,
        log: true,
        args: [Trading.address, PairsContract.address, Referrals.address, Position.address],
        libraries: {
            TradingLibrary: TradingLibrary.address
        }
    });

    if (Trading.newlyDeployed) {
        await execute(
            'StableToken',
            { from: deployer, log: true, nonce: Nonce+3 },
            'setMinter(address,bool)',
            Trading.address,
            true
        );

        await execute(
            'Position',
            { from: deployer, log: true, nonce: Nonce+4 },
            'setMinter(address,bool)',
            Trading.address,
            true
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true, nonce: Nonce+5 },
            'setProtocol(address)',
            TradingExt.address
        );

        await execute(
            'Trading',
            { from: deployer, log: true, nonce: Nonce+6 },
            'setTradingExtension(address)',
            TradingExt.address
        );

        await execute(
            'Referrals',
            { from: deployer, log: true, nonce: Nonce+7 },
            'setProtocol(address)',
            TradingExt.address
        );

        await execute(
            'TradingExtension',
            { from: deployer, log: true, nonce: Nonce+8 },
            'setAllowedMargin(address,bool)',
            Stable.address,
            true
        );

        await execute(
            'TradingExtension',
            { from: deployer, log: true, nonce: Nonce+9 },
            'setValidSignatureTimer(uint256)',
            20
        );

        await execute(
            'Trading',
            { from: deployer, log: true, nonce: Nonce+10 },
            'setFees(bool,uint256,uint256,uint256,uint256,uint256)',
            true,
            1e7,
            0,
            1e6,
            2e6,
            0
        );

        await execute(
            'Trading',
            { from: deployer, log: true, nonce: Nonce+11 },
            'setFees(bool,uint256,uint256,uint256,uint256,uint256)',
            false,
            1e7,
            0,
            1e6,
            2e6,
            0
        );

        await execute(
            'Trading',
            { from: deployer, log: true, nonce: Nonce+12 },
            'setAllowedVault(address,bool)',
            StableVault.address,
            true
        );
    }
};

module.exports.tags = ['test'];

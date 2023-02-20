module.exports = async ({ getChainId, getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    const chainId = await getChainId();
    let { deployer, LINK } = await getNamedAccounts();
    const Controller = await deployments.get('Controller');
    const Manager = await deployments.get('Manager');
    const Minter = await deployments.get('Minter');
    const GaugeProxy = await deployments.get('GaugeProxy');

    if (chainId != '1') {
        const link = await deploy('LINK', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['LINK', 'LINK', 18]
        });

        LINK = link.address;
    }

    const VaultToken = await deploy('LINKVaultToken', {
        contract: 'VaultToken',
        from: deployer,
        log: true,
        args: ['yAxis LINK Vault', 'V:LINK', Manager.address]
    });

    const Vault = await deploy('LINKVault', {
        contract: 'Vault',
        from: deployer,
        log: true,
        args: [LINK, VaultToken.address, Manager.address]
    });

    const Gauge = await deploy('VaultLINKGauge', {
        contract: 'LiquidityGaugeV2',
        from: deployer,
        log: true,
        args: [VaultToken.address, Minter.address, GaugeProxy.address]
    });

    if (Gauge.newlyDeployed) {
        await execute(
            'GaugeController',
            { from: deployer, log: true },
            'add_gauge(address,int128,uint256)',
            Gauge.address,
            0,
            ethers.utils.parseEther('1')
        );
        await execute(
            'Manager',
            { from: deployer, log: true },
            'setAllowedVault',
            Vault.address,
            true
        );
        await execute('Manager', { from: deployer, log: true }, 'addVault', Vault.address);
        await execute(
            'Manager',
            { from: deployer, log: true },
            'setController',
            Vault.address,
            Controller.address
        );
        await execute('LINKVault', { from: deployer, log: true }, 'setGauge', Gauge.address);
    }
};

module.exports.tags = ['v3', 'gauges'];

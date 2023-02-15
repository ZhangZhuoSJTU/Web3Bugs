module.exports = async ({ getChainId, getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    const chainId = await getChainId();
    let { deployer, vault3crv } = await getNamedAccounts();
    const Manager = await deployments.get('Manager');

    if (chainId != '1') {
        const yax = await deployments.get('YAX');
        const dai = await deployments.get('DAI');
        const usdc = await deployments.get('USDC');
        const usdt = await deployments.get('USDT');
        const t3crv = await deployments.get('T3CRV');
        const MetaVault = await deploy('MetaVault', {
            from: deployer,
            log: true,
            args: [
                dai.address,
                usdc.address,
                usdt.address,
                t3crv.address,
                yax.address,
                '10000000000000',
                1
            ]
        });
        vault3crv = MetaVault.address;

        const NonConverter = await deploy('MetaVaultNonConverter', {
            from: deployer,
            log: true,
            args: [t3crv.address, Manager.address]
        });

        await execute('MetaVault', { from: deployer }, 'setConverter', NonConverter.address);
        await execute(
            'DAI',
            { from: deployer },
            'mint',
            MetaVault.address,
            ethers.utils.parseEther('1')
        );
    }

    await deploy('LegacyController', {
        from: deployer,
        log: true,
        args: [Manager.address, vault3crv]
    });
};

module.exports.tags = ['v3'];

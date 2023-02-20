module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    let { deployer, MIMCRV } = await getNamedAccounts();
    const Vault = await deployments.get('Vault3CRV'); // TODO: need to use MIM Vault

    const AlToken = await deploy('AlToken', {
        from: deployer,
        log: true,
        args: []
    });

    const YaxisVaultAdapter = await deploy('YaxisVaultAdapter', {
        from: deployer,
        log: true,
        args: [Vault.address, deployer]
    });

    const Alchemist = await deploy('Alchemist', {
        from: deployer,
        log: true,
        args: [MIMCRV, AlToken.address, deployer, deployer]
    });

    const Transmuter = await deploy('Transmuter', {
        from: deployer,
        log: true,
        args: [AlToken.address, MIMCRV, deployer]
    });

    await execute(
        'AlToken',
        { from: deployer, log: true },
        'setWhitelist',
        Alchemist.address,
        true
    );
    await execute(
        'Transmuter',
        { from: deployer, log: true },
        'setWhitelist',
        Alchemist.address,
        true
    );
    await execute('Alchemist', { from: deployer, log: true }, 'setRewards', deployer);
    await execute(
        'Alchemist',
        { from: deployer, log: true },
        'setTransmuter',
        Transmuter.address
    );

    await execute(
        'Alchemist',
        { from: deployer, log: true },
        'initialize',
        YaxisVaultAdapter.address
    );
};

module.exports.tags = ['Alchemist'];

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    let {
        CRV,
        CVX,
        PBTC,
        WETH,
        deployer,
        convexBoost,
        stableSwapPBTCPool,
        unirouter
    } = await getNamedAccounts();
    const Controller = await deployments.get('Controller');
    const Manager = await deployments.get('Manager');
    const Vault = await deployments.get('VaultStables');
    const name = 'Convex: PBTC';
    let pid = 18;

    const Strategy = await deploy('BTCConvexStrategy', {
        contract: 'GeneralConvexStrategy',
        from: deployer,
        log: true,
        args: [
            name,
            PBTC,
            CRV,
            CVX,
            WETH,
            pid,
            49,
            convexBoost,
            stableSwapPBTCPool,
            Controller.address,
            Manager.address,
            unirouter
        ]
    });

    if (Strategy.newlyDeployed) {
        await execute(
            'Manager',
            { from: deployer, log: true },
            'setAllowedStrategy',
            Strategy.address,
            true
        );
        await execute(
            'Controller',
            { from: deployer, log: true },
            'addStrategy',
            Vault.address,
            Strategy.address,
            0,
            86400
        );
    }
};

module.exports.tags = ['v3-strategies', 'GeneralConvexStrategy'];

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, execute } = deployments;
    let {
        CRV,
        CVX,
        LINKCRV,
        WETH,
        deployer,
        convexBoost,
        stableSwapLINKPool,
        unirouter
    } = await getNamedAccounts();
    const Controller = await deployments.get('Controller');
    const Manager = await deployments.get('Manager');
    const Vault = await deployments.get('VaultStables');
    const name = 'Convex: LINKCRV';
    let pid = 30;

    const Strategy = await deploy('LINKConvexStrategy', {
        contract: 'GeneralConvexStrategy',
        from: deployer,
        log: true,
        args: [
            name,
            LINKCRV,
            CRV,
            CVX,
            WETH,
            pid,
            2,
            convexBoost,
            stableSwapLINKPool,
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

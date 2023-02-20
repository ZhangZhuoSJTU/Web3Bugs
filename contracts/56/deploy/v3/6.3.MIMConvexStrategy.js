module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let {
        CRV,
        CVX,
        MIM,
        T3CRV,
        MIMCRV,
        WETH,
        deployer,
        convexBoost,
        stableSwapMIMPool,
        unirouter
    } = await getNamedAccounts();
    const chainId = await getChainId();
    const Controller = await deployments.get('Controller');
    const Manager = await deployments.get('Manager');
    const Vault = await deployments.get('Vault3CRV');
    const name = 'Convex: MIMCRV';
    let pid = 40;

    if (chainId != '1') {
        const mim = await deployments.get('MIM');
        MIM = mim.address;
        const t3crv = await deployments.get('T3CRV');
        T3CRV = t3crv.address;
        const mim3crv = await deployments.get('MIM3CRV');
        MIMCRV = mim3crv.address;
        const weth = await deployments.get('WETH');
        WETH = weth.address;
        await deploy('CRV', {
            from: deployer,
            contract: 'MockERC20',
            log: true,
            args: ['Curve.fi', 'CRV', 18]
        });
        let crv = await deployments.get('CRV');
        CRV = crv.address;
        crv = await ethers.getContractAt('MockERC20', CRV, deployer);
        await deploy('CVX', {
            from: deployer,
            contract: 'MockERC20',
            log: true,
            args: ['Convex Token', 'CVX', 18]
        });
        let cvx = await deployments.get('CVX');
        CVX = cvx.address;
        cvx = await ethers.getContractAt('MockERC20', CVX, deployer);

        await deploy('MockConvexVault', {
            from: deployer,
            log: true,
            args: [deployer, deployer, crv.address, cvx.address]
        });

        const mockConvexVault = await deployments.get('MockConvexVault');
        convexBoost = mockConvexVault.address;

        await execute('CVX', { from: deployer }, 'mint', convexBoost, '10000000000000000000');

        await execute(
            'MockConvexVault',
            { from: deployer, log: true },
            'addPool(address,address,uint256)',
            MIMCRV,
            MIMCRV,
            0
        );

        const mockStableSwap2Pool = await deployments.get('MockStableSwap2Pool');
        stableSwapMIMPool = mockStableSwap2Pool.address;
        const router = await deployments.get('MockUniswapRouter');
        unirouter = router.address;

        pid = 0;
    }

    const Strategy = await deploy('MIMConvexStrategy', {
        from: deployer,
        log: true,
        args: [
            name,
            MIMCRV,
            CRV,
            CVX,
            WETH,
            MIM,
            T3CRV,
            pid,
            convexBoost,
            stableSwapMIMPool,
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

module.exports.tags = ['v3-strategies', 'MIMConvexStrategy'];

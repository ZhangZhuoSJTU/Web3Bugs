module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let {
        CRV,
        CVX,
        DAI,
        USDC,
        USDT,
        T3CRV,
        WETH,
        deployer,
        convex3poolVault,
        stableSwap3Pool,
        unirouter
    } = await getNamedAccounts();
    const chainId = await getChainId();
    const Controller = await deployments.get('Controller');
    const Manager = await deployments.get('Manager');
    const Vault = await deployments.get('Vault3CRV');
    const name = 'Convex: 3CRV';
    let pid = 9;

    if (chainId != '1') {
        const dai = await deployments.get('DAI');
        DAI = dai.address;
        const usdc = await deployments.get('USDC');
        USDC = usdc.address;
        const usdt = await deployments.get('USDT');
        USDT = usdt.address;
        const t3crv = await deployments.get('T3CRV');
        T3CRV = t3crv.address;
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
        convex3poolVault = mockConvexVault.address;

        await execute(
            'CVX',
            { from: deployer },
            'mint',
            convex3poolVault,
            '10000000000000000000'
        );

        await execute(
            'MockConvexVault',
            { from: deployer, log: true },
            'addPool(address,address,uint256)',
            T3CRV,
            T3CRV,
            0
        );

        const mockStableSwap3Pool = await deployments.get('MockStableSwap3Pool');
        stableSwap3Pool = mockStableSwap3Pool.address;
        const router = await deployments.get('MockUniswapRouter');
        unirouter = router.address;

        pid = 0;
    }

    const Strategy = await deploy('ConvexStrategy', {
        from: deployer,
        log: true,
        args: [
            name,
            T3CRV,
            CRV,
            CVX,
            WETH,
            DAI,
            USDC,
            USDT,
            pid,
            convex3poolVault,
            stableSwap3Pool,
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

module.exports.tags = ['v3-strategies', 'ConvexStrategy'];

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deploy, execute } = deployments;
    let { deployer, stableSwap3Pool } = await getNamedAccounts();
    const chainId = await getChainId();

    if (chainId != '1') {
        const YAX = await deploy('YAX', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['yAxis', 'YAX', 18]
        });
        const dai = await deploy('DAI', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['Dai Stablecoin', 'DAI', 18]
        });
        const usdc = await deploy('USDC', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['USD Coin', 'USDC', 6]
        });
        const usdt = await deploy('USDT', {
            from: deployer,
            log: true,
            contract: 'MockERC20NonStandard',
            args: ['Tether', 'USDT', 6]
        });
        const WETH = await deploy('WETH', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['Wrapped ETH', 'WETH', 18]
        });
        const t3crv = await deploy('T3CRV', {
            from: deployer,
            log: true,
            contract: 'MockERC20',
            args: ['Curve.fi DAI/USDC/USDT', '3CRV', 18]
        });
        const mim3crv = await deployments.deploy('MIM3CRV', {
            from: deployer,
            contract: 'MockERC20',
            args: [
                'Curve.fi Factory USD Metapool: Magic Internet Money 3Pool',
                'MIM-3LP3CRV',
                18
            ]
        });
        const mim = await deployments.deploy('MIM', {
            from: deployer,
            contract: 'MockERC20',
            args: ['MIM Stablecoin', 'MIM', 18]
        });
        const mock3crv = await deployments.deploy('MOCK3CRV', {
            from: deployer,
            contract: 'MockERC20',
            args: ['Curve.fi DAI/USDC/USDT', 'MOCK3CRV', 18]
        });

        await deploy('MockUniswapRouter', {
            from: deployer,
            log: true,
            args: ['0x0000000000000000000000000000000000000000']
        });

        stableSwap3Pool = await deploy('MockStableSwap3Pool', {
            from: deployer,
            log: true,
            args: [
                deployer,
                [dai.address, usdc.address, usdt.address],
                t3crv.address,
                200,
                4000000,
                5000000000
            ]
        });
        stableSwap3Pool = stableSwap3Pool.address;
        const mimStableSwap = await deployments.deploy('MockStableSwap2Pool', {
            from: deployer,
            args: [
                deployer,
                [mim.address, mock3crv.address],
                mim3crv.address,
                200,
                4000000,
                5000000000
            ]
        });

        if (t3crv.newlyDeployed) {
            await execute('T3CRV', { from: deployer }, 'transferOwnership', stableSwap3Pool);
            await execute(
                'DAI',
                { from: deployer },
                'mint',
                deployer,
                ethers.utils.parseEther('10000000000000')
            );
            await execute(
                'USDC',
                { from: deployer },
                'mint',
                deployer,
                '10000000000000000000'
            );
            await execute(
                'USDT',
                { from: deployer },
                'mint',
                deployer,
                '10000000000000000000'
            );
            await execute(
                'DAI',
                { from: deployer },
                'approve',
                stableSwap3Pool,
                ethers.constants.MaxUint256
            );
            await execute(
                'USDC',
                { from: deployer },
                'approve',
                stableSwap3Pool,
                ethers.constants.MaxUint256
            );
            await execute(
                'USDT',
                { from: deployer },
                'approve',
                stableSwap3Pool,
                ethers.constants.MaxUint256
            );
            await execute(
                'MockStableSwap3Pool',
                { from: deployer },
                'add_liquidity',
                [ethers.utils.parseEther('200000000'), '200000000000000', '200000000000000'],
                0
            );
        }

        if (mim3crv.newlyDeployed) {
            await execute(
                'MIM3CRV',
                { from: deployer },
                'transferOwnership',
                mimStableSwap.address
            );
            await execute(
                'MIM',
                { from: deployer },
                'mint',
                deployer,
                ethers.utils.parseEther('10000000000000')
            );
            await execute(
                'MOCK3CRV',
                { from: deployer },
                'mint',
                deployer,
                ethers.utils.parseEther('10000000000000')
            );
            await execute(
                'MIM',
                { from: deployer },
                'approve',
                mimStableSwap.address,
                ethers.constants.MaxUint256
            );
            await execute(
                'MOCK3CRV',
                { from: deployer },
                'approve',
                mimStableSwap.address,
                ethers.constants.MaxUint256
            );

            await execute(
                'MockStableSwap2Pool',
                { from: deployer },
                'add_liquidity',
                [ethers.utils.parseEther('200000000'), ethers.utils.parseEther('200000000')],
                0
            );
        }

        await deploy('sYAX', {
            contract: 'MockYaxisBar',
            from: deployer,
            log: true,
            args: [YAX.address]
        });

        await deploy('YaxEthUniswapV2Pair', {
            contract: 'MockUniswapPair',
            from: deployer,
            log: true,
            args: [YAX.address, WETH.address]
        });

        await deploy('MockYaxisChef', {
            from: deployer,
            log: true
        });
    }
};

module.exports.tags = ['metavault', 'governance', 'token', 'rewards', 'v3', 'gauges'];

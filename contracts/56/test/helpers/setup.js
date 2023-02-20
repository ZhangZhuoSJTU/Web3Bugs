const { deployments } = require('hardhat');

exports.advanceBlocks = async (blocks) => {
    for (let i = 0; i < blocks; i++) {
        await network.provider.request({
            method: 'evm_mine'
        });
    }
};

exports.increaseTime = async (time) => {
    await network.provider.request({
        method: 'evm_increaseTime',
        params: [time]
    });
    await network.provider.request({
        method: 'evm_mine'
    });
};

exports.setupTestGovernance = deployments.createFixture(async ({ deployments, ethers }) => {
    await deployments.fixture(['token', 'rewards', 'governance']);
    const YAXIS = await deployments.get('YaxisToken');
    const yaxis = await ethers.getContractAt('YaxisToken', YAXIS.address);
    const RewardsYaxis = await deployments.get('RewardsYaxis');
    const rewardsYaxis = await ethers.getContractAt('Rewards', RewardsYaxis.address);
    const RewardsYaxisEth = await deployments.get('RewardsYaxisEth');
    const rewardsYaxisEth = await ethers.getContractAt('Rewards', RewardsYaxisEth.address);
    const Pair = await deployments.get('YaxisEthUniswapV2Pair');
    const pair = await ethers.getContractAt('MockUniswapPair', Pair.address);
    const WETH = await deployments.get('WETH');
    const weth = await ethers.getContractAt('MockERC20', WETH.address);

    return { rewardsYaxis, yaxis, rewardsYaxisEth, pair, weth };
});

exports.setupTestToken = deployments.createFixture(
    async ({ deployments, getNamedAccounts, ethers }) => {
        await deployments.fixture(['token']);
        const { deployer, user } = await getNamedAccounts();
        const YAXIS = await deployments.get('YaxisToken');
        const yaxis = await ethers.getContractAt('YaxisToken', YAXIS.address, deployer);
        const YAX = await deployments.get('YAX');
        const yax = await ethers.getContractAt('MockERC20', YAX.address, user);
        const SYAX = await deployments.get('sYAX');
        const syax = await ethers.getContractAt('MockYaxisBar', SYAX.address, user);
        const Swap = await deployments.get('Swap');
        const swap = await ethers.getContractAt('Swap', Swap.address, deployer);

        return { deployer, swap, syax, user, yax, yaxis };
    }
);

exports.setupTestMetavault = deployments.createFixture(
    async ({ deployments, getNamedAccounts, ethers }) => {
        await deployments.fixture('metavault');
        const {
            deployer,
            user,
            stakingPool,
            treasury,
            insurancePool
        } = await getNamedAccounts();
        const YAX = await deployments.get('YAX');
        const yax = await ethers.getContractAt('MockERC20', YAX.address, user);
        const DAI = await deployments.get('DAI');
        const dai = await ethers.getContractAt('MockERC20', DAI.address, user);
        const USDC = await deployments.get('USDC');
        const usdc = await ethers.getContractAt('MockERC20', USDC.address, user);
        const USDT = await deployments.get('USDT');
        const usdt = await ethers.getContractAt('MockERC20', USDT.address, user);
        const T3CRV = await deployments.get('T3CRV');
        const t3crv = await ethers.getContractAt('MockERC20', T3CRV.address, user);
        const WETH = await deployments.get('WETH');
        const weth = await ethers.getContractAt('MockERC20', WETH.address, user);
        const Router = await deployments.get('MockUniswapRouter');
        const router = await ethers.getContractAt(
            'MockUniswapRouter',
            Router.address,
            deployer
        );
        const Vault = await deployments.get('yAxisMetaVault');
        const vault = await ethers.getContractAt('yAxisMetaVault', Vault.address, user);
        const Manager = await deployments.get('yAxisMetaVaultManager');
        const vaultManager = await ethers.getContractAt(
            'yAxisMetaVaultManager',
            Manager.address,
            deployer
        );
        const Controller = await deployments.get('StrategyControllerV2');
        const controller = await ethers.getContractAt(
            'StrategyControllerV2',
            Controller.address,
            deployer
        );
        const Pool = await deployments.get('MockStableSwap3Pool');
        const pool = await ethers.getContractAt('MockStableSwap3Pool', Pool.address, user);
        const Converter = await deployments.get('StableSwap3PoolConverter');
        const converter = await ethers.getContractAt(
            'StableSwap3PoolConverter',
            Converter.address,
            deployer
        );
        const NonConverter = await deployments.get('StableSwap3PoolNonConverter');
        const nonConverter = await ethers.getContractAt(
            'StableSwap3PoolNonConverter',
            NonConverter.address
        );
        const Harvester = await deployments.get('yAxisMetaVaultHarvester');
        const harvester = await ethers.getContractAt(
            'yAxisMetaVaultHarvester',
            Harvester.address,
            deployer
        );

        await dai.faucet(ethers.utils.parseEther('1000'));
        await usdc.faucet('1000000000');
        await usdt.faucet('1000000000');
        await dai.approve(Vault.address, ethers.constants.MaxUint256, { from: user });
        await usdc.approve(Vault.address, ethers.constants.MaxUint256, { from: user });
        await usdt.approve(Vault.address, ethers.constants.MaxUint256, { from: user });
        await t3crv.approve(Vault.address, ethers.constants.MaxUint256, { from: user });
        await vault.approve(Vault.address, ethers.utils.parseEther('1000'), { from: user });

        return {
            deployer,
            stakingPool,
            treasury,
            insurancePool,
            user,
            yax,
            dai,
            usdc,
            usdt,
            t3crv,
            weth,
            vault,
            vaultManager,
            harvester,
            controller,
            converter,
            nonConverter,
            pool,
            router
        };
    }
);

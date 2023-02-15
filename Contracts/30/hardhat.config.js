require('@nomiclabs/hardhat-waffle');
require('hardhat-deploy');
require('hardhat-deploy-ethers');
require('solidity-coverage');
require('@nomiclabs/hardhat-vyper');

const ethers = require('ethers');
// Prevents the "Duplicate definition of Transfer" logs when running tests/scripts
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

// If not set, we only need to default these with something to get hardhat to run
const kovanRpcUrl = process.env.KOVAN_RPC_URL || 'http://localhost:8545';
const mainnetRpcUrl = process.env.MAINNET_RPC_URL || 'http://localhost:8545';
const kovanPrivateKey = process.env.KOVAN_PRIVATE_KEY || '0x00';
const mainnetPrivateKey = process.env.MAINNET_PRIVATE_KEY || '0x00';
const mainnetAccounts = process.env.FORK ? undefined : [mainnetPrivateKey];
const chainId = process.env.LIVE ? 1 : 31337;

task('contracts', 'Prints the contract addresses for a network').setAction(async () => {
    // eslint-disable-next-line no-undef
    const contracts = await deployments.all();
    for (const contract in contracts) {
        console.log(contract, contracts[contract].address);
    }
});

module.exports = {
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {
            chainId: chainId
        },
        kovan: {
            url: kovanRpcUrl,
            accounts: [kovanPrivateKey]
        },
        mainnet: {
            url: mainnetRpcUrl,
            accounts: mainnetAccounts
        }
    },
    namedAccounts: {
        COMP: {
            1: '0xc00e94Cb662C3520282E6f5717214004A7f26888'
        },
        CRV: {
            1: '0xD533a949740bb3306d119CC777fa900bA034cd52'
        },
        converter: {
            1: '0xA5c16eb6eBD72BC72c70Fca3e4faCf389AD4aBE7'
        },
        DAI: {
            1: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
        },
        DAIETH: {
            1: '0x773616E4d11A78F511299002da57A0a94577F1f4'
        },
        DF: {
            1: '0x431ad2ff6a9C365805eBaD47Ee021148d6f7DBe0'
        },
        dDAI: {
            1: '0x02285AcaafEB533e03A7306C55EC031297df9224'
        },
        dRewardsDAI: {
            1: '0xD2fA07cD6Cd4A5A96aa86BacfA6E50bB3aaDBA8B'
        },
        dRewardsUSDT: {
            1: '0x324EebDAa45829c6A8eE903aFBc7B61AF48538df'
        },
        dUSDT: {
            1: '0x868277d475E0e475E38EC5CdA2d9C83B5E1D9fc8'
        },
        deployer: {
            default: 0,
            1: '0x65F84A48e640a908d0DF7B6f00B871352F77022D',
            42: '0x36D68d13dD18Fe8076833Ef99245Ef33B00A7259'
        },
        developFund: {
            default: 5,
            1: '0x5118Df9210e1b97a4de0df15FBbf438499d6b446'
        },
        ETHUSD: {
            1: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'
        },
        gauge: {
            1: '0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A'
        },
        IDLE: {
            1: '0x875773784Af8135eA0ef43b5a374AaD105c5D39e'
        },
        idleDAI: {
            1: '0x3fE7940616e5Bc47b0775a0dccf6237893353bB4'
        },
        idleUSDT: {
            1: '0xF34842d05A1c888Ca02769A633DF37177415C2f8'
        },
        idleUSDC: {
            1: '0x5274891bEC421B39D23760c04A6755eCB444797C'
        },
        insurancePool: {
            default: 4
        },
        minter: {
            1: '0xd061D61a4d941c39E5453435B6345Dc261C2fcE0'
        },
        multisig: {
            1: '0xC1d40e197563dF727a4d3134E8BD1DeF4B498C6f',
            42: '0x36D68d13dD18Fe8076833Ef99245Ef33B00A7259'
        },
        oldController: {
            1: '0x2ebE1461D2Fc6dabF079882CFc51e5013BbA49B6'
        },
        oldStrategyCrv: {
            1: '0xED93BeCebaB166AbEeAC1C5FA3b5a0cAA0d34891'
        },
        p3crv: {
            1: '0x1BB74b5DdC1f4fC91D6f9E7906cf68bc93538e33'
        },
        pchef: {
            1: '0xbD17B1ce622d73bD438b9E658acA5996dc394b0d'
        },
        PICKLE: {
            1: '0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5'
        },
        pjar: {
            1: '0x1BB74b5DdC1f4fC91D6f9E7906cf68bc93538e33'
        },
        stableSwap3Pool: {
            1: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7',
            42: '0xE2C2a45850375c0A8B92b853fcd0a110463ed5Ab'
        },
        stakingPool: {
            default: 2,
            1: '0xeF31Cb88048416E301Fee1eA13e7664b887BA7e8',
            42: '0x36D68d13dD18Fe8076833Ef99245Ef33B00A7259'
        },
        STBZ: {
            1: '0xb987d48ed8f2c468d52d6405624eadba5e76d723'
        },
        STBZOperator: {
            1: '0xEe9156C93ebB836513968F92B4A67721f3cEa08a'
        },
        SYAX: {
            1: '0xeF31Cb88048416E301Fee1eA13e7664b887BA7e8'
        },
        T3CRV: {
            1: '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490'
        },
        teamFund: {
            default: 6,
            1: '0xEcD3aD054199ced282F0608C4f0cea4eb0B139bb'
        },
        timelock: {
            1: '0x66C5c16d13a38461648c1D097f219762D374B412',
            42: '0x36D68d13dD18Fe8076833Ef99245Ef33B00A7259'
        },
        treasury: {
            default: 1,
            1: '0xC1d40e197563dF727a4d3134E8BD1DeF4B498C6f',
            42: '0x36D68d13dD18Fe8076833Ef99245Ef33B00A7259'
        },
        unirouter: {
            1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
        },
        user: {
            default: 3,
            1: '0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE'
        },
        USDC: {
            1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        },
        USDCETH: {
            1: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46'
        },
        USDT: {
            1: '0xdAC17F958D2ee523a2206206994597C13D831ec7'
        },
        USDTETH: {
            1: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46'
        },
        vault3crv: {
            1: '0xBFbEC72F2450eF9Ab742e4A27441Fa06Ca79eA6a'
        },
        WETH: {
            1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
        },
        YAX: {
            1: '0xb1dC9124c395c1e97773ab855d66E879f053A289'
        },
        YaxEthUniswapV2Pair: {
            1: '0x1107B6081231d7F256269aD014bF92E041cb08df'
        },
        YaxisEthUniswapV2Pair: {
            1: '0xF0E3FdF48661CD10d56692f60BD4eCcd01E9CF64'
        },
        YaxisChef: {
            1: '0xC330E7e73717cd13fb6bA068Ee871584Cf8A194F'
        },
        yvDAI: {
            1: '0x19D3364A399d251E894aC732651be8B0E4e85001'
        },
        yvUSDC: {
            1: '0x5f18C75AbDAe578b483E5F43f12a39cF75b973a9'
        },
        zpaUSDC: {
            1: '0x4dEaD8338cF5cb31122859b2Aec2b60416D491f0',
            poolId: 5
        },
        zpaUSDT: {
            1: '0x6B2e59b8EbE61B5ee0EF30021b7740C63F597654',
            poolId: 6
        },
        zpaDAI: {
            1: '0xfa8c04d342FBe24d871ea77807b1b93eC42A57ea',
            poolId: 8
        },
        zpasUSD: {
            1: '0x89Cc19cece29acbD41F931F3dD61A10C1627E4c4',
            poolId: 7
        },
        flamIncomeUSDT: {
            1: '0x54bE9254ADf8D5c8867a91E44f44c27f0c88e88A'
        },
        dYdXSoloMargin: {
            1: '0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e'
        }
    },
    solidity: {
        version: '0.6.12',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    vyper: {
        version: '0.2.8'
    },
    paths: {
        sources: './contracts',
        tests: './test'
    },
    mocha: {
        timeout: 0
    }
};

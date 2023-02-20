import { PriceOracle, SublimeProxy, IUniswapV3Factory } from '../../typechain';
import { waffle, ethers } from 'hardhat';

import DeployHelper from '../../utils/deploys';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { ChainlinkPriceOracleData, UniswapPoolData } from '../../utils/types';

const { loadFixture } = waffle;
import { Contracts } from '../../existingContracts/compound.json';
import { ChainLinkAggregators, zeroAddress } from '../../config/constants';
import { expect } from 'chai';

const uniswapV3FactoryContract = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

describe('Price Oracle', async () => {
    let priceOracle: PriceOracle;
    let admin: SignerWithAddress;

    let chainlinkData: ChainlinkPriceOracleData[];
    let uniswapPoolData: UniswapPoolData[];
    let uniswapV3Factory: IUniswapV3Factory;

    async function fixture() {
        const [proxyAdmin, admin]: SignerWithAddress[] = await ethers.getSigners();
        let deployHelper: DeployHelper = new DeployHelper(proxyAdmin);
        uniswapV3Factory = await (await deployHelper.mock.getIUniswapV3Factory(uniswapV3FactoryContract)).connect(admin);

        let priceOracleLogic: PriceOracle = await deployHelper.helper.deployPriceOracle();
        let proxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(priceOracleLogic.address, proxyAdmin.address);
        let priceOracle = await deployHelper.helper.getPriceOracle(proxy.address);
        priceOracle = await priceOracle.connect(admin);
        await priceOracle.initialize(admin.address, Contracts.WETH);

        for (let index = 0; index < chainlinkData.length; index++) {
            const element = chainlinkData[index];
            await priceOracle.setChainlinkFeedAddress(element.token, element.priceOracle);
        }

        for (let index = 0; index < uniswapPoolData.length; index++) {
            const element = uniswapPoolData[index];
            let uniswapPool = await uniswapV3Factory.getPool(element.token1, element.token2, element.fee);
            await priceOracle.setUniswapFeedAddress(element.token1, element.token2, uniswapPool);
        }

        return { priceOracle, admin, uniswapV3Factory };
    }

    beforeEach(async () => {
        chainlinkData = [
            { token: Contracts.USDT, priceOracle: ChainLinkAggregators['USDT/USD'] },
            { token: Contracts.WBTC, priceOracle: ChainLinkAggregators['BTC/USD'] },
        ];
        uniswapPoolData = [
            {
                token1: Contracts.USDT,
                token2: Contracts.WBTC,
                fee: '3000',
            },
        ];
        let result = await loadFixture(fixture);
        priceOracle = result.priceOracle;
        admin = result.admin;
        await priceOracle.connect(admin).setUniswapPriceAveragingPeriod(1000);
    });

    it('get weth decimals', async () => {
        let wethDecimals = await priceOracle.connect(admin).getDecimals(Contracts.WETH);
        expect(wethDecimals).to.eq(18);
    });

    it('get 0 address decimals', async () => {
        await expect(priceOracle.connect(admin).getDecimals(zeroAddress)).to.be.revertedWith('GD1');
    });

    it("get decimals of a some random contract which doesn't have decimals field", async () => {
        expect(await priceOracle.connect(admin).getDecimals(priceOracle.address)).to.eq(0);
    });
});

import { PriceOracle, SublimeProxy, IUniswapV3Factory, MockV3Aggregator, MockV3Aggregator__factory } from '../../typechain';
import { waffle, ethers } from 'hardhat';

import DeployHelper from '../../utils/deploys';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { ChainlinkPriceOracleData, UniswapPoolData } from '../../utils/types';

const { loadFixture } = waffle;
import { Contracts } from '../../existingContracts/compound.json';
import { ChainLinkAggregators, zeroAddress } from '../../config/constants';
import { expect } from 'chai';
import { BigNumber, ContractTransaction } from 'ethers';

const uniswapV3FactoryContract = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

describe('Overflow checks', async () => {
    let priceOracle: PriceOracle;
    let admin: SignerWithAddress;

    let chainlinkData: ChainlinkPriceOracleData[];
    let uniswapPoolData: UniswapPoolData[];
    let uniswapV3Factory: IUniswapV3Factory;

    let mockBTCAggregator: MockV3Aggregator;
    let mockUSDTAggregator: MockV3Aggregator;
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
        const [, someAddress]: SignerWithAddress[] = await ethers.getSigners();
        mockBTCAggregator = await new MockV3Aggregator__factory(someAddress).deploy('18', '273654726537');
        mockUSDTAggregator = await new MockV3Aggregator__factory(someAddress).deploy('18', '273654726537');

        chainlinkData = [
            { token: Contracts.USDT, priceOracle: mockBTCAggregator.address },
            { token: Contracts.WBTC, priceOracle: mockUSDTAggregator.address },
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
    });

    it('Overflow check', async () => {
        await mockBTCAggregator.setAnswer(121);
        await mockUSDTAggregator.setAnswer(1);

        const MAX_INT = '0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

        let maxInt256 = BigNumber.from(MAX_INT);
        let minInt256 = BigNumber.from(1);

        console.log(
            'max price ratio supported',
            await (await getMaxPossibleValue(minInt256, maxInt256, priceOracle.getChainlinkLatestPrice)).toString()
        );
    });

    async function getMaxPossibleValue(
        min: BigNumber,
        max: BigNumber,
        func: (num: string, den: string) => Promise<[BigNumber, BigNumber]>
    ): Promise<BigNumber> {
        let diff = max.sub(min);
        if (diff.eq(0) || diff.eq(1)) {
            return min;
        }
        let valueToTest = min.add(max).div(2);
        await mockBTCAggregator.setAnswer(valueToTest);
        try {
            let result = await func(Contracts.WBTC, Contracts.USDT);
            if (result[0].eq(0)) {
                return getMaxPossibleValue(min, valueToTest, func);
            } else {
                return getMaxPossibleValue(valueToTest, max, func);
            }
        } catch (ex) {
            return getMaxPossibleValue(min, valueToTest, func);
        }
    }
});

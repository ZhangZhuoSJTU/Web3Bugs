import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import DeployHelper from '../deploys';

import { PriceOracle } from '@typechain/PriceOracle';
import { SublimeProxy } from '@typechain/SublimeProxy';
import { Address } from 'hardhat-deploy/dist/types';
import { PriceOracleSource } from '@utils/types';

import { run } from 'hardhat';
const confirmations = 6;

export async function createPriceOracle(proxyAdmin: SignerWithAddress, admin: SignerWithAddress, weth: Address): Promise<PriceOracle> {
    let chainid = await proxyAdmin.getChainId();
    if (chainid != 31337) {
        console.log('deploying price oracle');
    }
    let deployHelper: DeployHelper = await new DeployHelper(proxyAdmin);
    let priceOracleLogic: PriceOracle = await deployHelper.helper.deployPriceOracle();
    let priceOracleProxy: SublimeProxy = await deployHelper.helper.deploySublimeProxy(priceOracleLogic.address, proxyAdmin.address);
    let priceOracle: PriceOracle = await deployHelper.helper.getPriceOracle(priceOracleProxy.address);

    if (chainid != 31337) {
        await priceOracleLogic.deployTransaction.wait(confirmations);
        await verifyPriceOracle(priceOracleLogic.address, []);
    }
    await (await priceOracle.connect(admin).initialize(admin.address, weth)).wait();
    return priceOracle;
}

export async function setPriceOracleFeeds(priceOracle: PriceOracle, admin: SignerWithAddress, pricePairs: PriceOracleSource[]) {
    for (let index = 0; index < pricePairs.length; index++) {
        let chainid = await admin.getChainId();
        if (chainid != 31337) {
            console.log(
                `setting price feed in price oracle  token == ${pricePairs[index].tokenAddress}, feedAggregator == ${pricePairs[index].feedAggregator}`
            );
        }
        const pair = pricePairs[index];
        await (await priceOracle.connect(admin).setChainlinkFeedAddress(pair.tokenAddress, pair.feedAggregator)).wait();
    }
}

async function verifyPriceOracle(address: string, constructorArguments: any[]) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: 'contracts/PriceOracle.sol:PriceOracle',
    }).catch(console.log);
}

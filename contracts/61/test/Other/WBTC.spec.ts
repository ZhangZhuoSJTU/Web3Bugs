import { ethers, network } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from '@ethersproject/bignumber';
import { expect } from 'chai';

import { WBTCWhale as wbtcwhale } from '../../utils/constants';

import DeployHelper from '../../utils/deploys';

import { ERC20 } from '@typechain/ERC20';

import { Contracts } from '../../existingContracts/compound.json';

import { ICToken } from '../../typechain/ICToken';
import { ICToken__factory } from '../../typechain/factories/ICToken__factory';

describe('WBTC to CWBTC conversion', async () => {
    let admin: SignerWithAddress;
    let WBTCWhale: any;
    let CWBTCTokenContract: ICToken;
    let WBTCTokenContract: ERC20;

    before(async () => {
        [, admin] = await ethers.getSigners();

        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [wbtcwhale],
        });

        await admin.sendTransaction({
            to: wbtcwhale,
            value: ethers.utils.parseEther('100'),
        });

        WBTCWhale = await ethers.provider.getSigner(wbtcwhale);
        let deployHelper: DeployHelper = new DeployHelper(admin);

        WBTCTokenContract = await deployHelper.mock.getMockERC20(Contracts.WBTC);
        await WBTCTokenContract.connect(WBTCWhale).transfer(admin.address, BigNumber.from('10').pow(9)); // 10 BTC

        CWBTCTokenContract = await ICToken__factory.connect(Contracts.cWBTC2, admin);
    });

    it('Deposit to compound yield', async () => {
        let amount = BigNumber.from('100000000');

        await WBTCTokenContract.connect(admin).approve(CWBTCTokenContract.address, amount);
        await CWBTCTokenContract.connect(admin).mint(amount);
    });
});

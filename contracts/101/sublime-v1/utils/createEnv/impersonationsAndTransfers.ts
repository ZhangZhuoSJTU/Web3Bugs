import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Address } from 'hardhat-deploy/dist/types';

export async function impersonateAccount(hre: HardhatRuntimeEnvironment, accounts: Address[], etherSourceAgent: SignerWithAddress) {
    const { network, ethers } = hre;
    for (let index = 0; index < accounts.length; index++) {
        const account = accounts[index];
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [account],
        });
        await etherSourceAgent.sendTransaction({
            to: account,
            value: ethers.utils.parseEther('100'),
        });
    }
}

export async function getImpersonatedAccounts(hre: HardhatRuntimeEnvironment, accounts: Address[]): Promise<any[]> {
    var signers = [];
    const { ethers } = hre;
    for (let index = 0; index < accounts.length; index++) {
        const account = accounts[index];
        signers.push(await ethers.provider.getSigner(account));
    }
    return signers;
}

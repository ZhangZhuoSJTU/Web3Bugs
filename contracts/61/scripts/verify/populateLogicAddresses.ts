import { ethers } from 'hardhat';

import { contractsToVerify as contracts } from './contractsToVerify';

export async function getAddressesToVerify() {
    let addresses: any = {} as string;
    for (let i = 0; i < contracts.length; i++) {
        let proxyAddress = contracts[i].proxy as string;
        const logicAddressRaw = await ethers.provider.getStorageAt(
            proxyAddress,
            '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
        );
        const logicAddress = ethers.utils.defaultAbiCoder.decode(['address'], logicAddressRaw)[0];
        addresses[contracts[i].contract] = {
            logic: logicAddress,
            proxy: proxyAddress,
        };
    }
    console.log(addresses);
    return addresses;
}

import { MockTwitterVerifier__factory } from '../../typechain/factories/MockTwitterVerifier__factory';
import DeployHelper from '../../utils/deploys';
import { ethers, run } from 'hardhat';

async function main() {
    const [proxyAdmin, admin] = await ethers.getSigners();
    let deployHelper = new DeployHelper(proxyAdmin);
    let mockTwitterVerifier = await (await new MockTwitterVerifier__factory(admin).deploy()).deployed();
    let proxy = await deployHelper.helper.getSublimeProxy('0xc9406F3A4C3B57b4067001591B0b36fDa9aec6E5');
    await (await proxy.upgradeTo(mockTwitterVerifier.address)).wait(6);
    await verifyVerification(mockTwitterVerifier.address, [], 'contracts/mocks/MockTwitterVerifier.sol:MockTwitterVerifier');
}

main().then(console.log);

async function verifyVerification(address: string, constructorArguments: any[], contractPath: string) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: contractPath,
    }).catch(console.log);
}

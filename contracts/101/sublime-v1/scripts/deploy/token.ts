import { Token__factory } from '../../typechain/factories/Token__factory';
import { ethers, run } from 'hardhat';

async function main() {
    const [proxyAdmin, admin] = await ethers.getSigners();
    const token1 = await (
        await new Token__factory(proxyAdmin).deploy('Mock WBTC', 'M-WBTC', '18', '1000000000000000000000000', admin.address)
    ).deployed();
    await token1.deployTransaction.wait(6);

    await verify(
        token1.address,
        ['Mock WBTC', 'M-WBTC', '18', '1000000000000000000000000', admin.address],
        'contracts/mocks/Token.sol:Token'
    );

    const token2 = await (
        await new Token__factory(proxyAdmin).deploy('Mock DAI', 'M-DAI', '18', '99999999900000000000000000000', admin.address)
    ).deployed();
    await token2.deployTransaction.wait(6);

    await verify(
        token2.address,
        ['Mock DAI', 'M-DAI', '18', '99999999900000000000000000000', admin.address],
        'contracts/mocks/Token.sol:Token'
    );

    return { token1: token1.address, token2: token2.address };
}
main().then(console.log);

async function verify(address: string, constructorArguments: any[], contractPath: string) {
    await run('verify:verify', {
        address,
        constructorArguments,
        contract: contractPath,
    }).catch(console.log);
}

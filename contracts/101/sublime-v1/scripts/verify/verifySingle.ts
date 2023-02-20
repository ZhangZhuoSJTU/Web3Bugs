import { ethers, run } from 'hardhat';

async function main() {
    await verify(
        '0x0068652D8E7AE9e02aB2c03DE428a7a1Fe7C9E11',
        ['0x4468530963e9925393A7BD530446D557C97ddc7A', '0xe22da380ee6B445bb8273C81944ADEB6E8450422'],
        'contracts/PooledCreditLine/PooledCreditLine.sol:PooledCreditLine'
    );
}

main().then(console.log);

async function verify(address: string, Arguments: any[], path: string) {
    await run('verify:verify', {
        address,
        Arguments,
        contract: path,
    }).catch(console.log);
}

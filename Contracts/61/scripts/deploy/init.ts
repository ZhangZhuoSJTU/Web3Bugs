import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { CreditLine } from '../../typechain/CreditLine';
import { ethers, network } from 'hardhat';
import DeployHelper from '../../utils/deploys';

const contracts = {
    savingsAccount: '0x3a495b65EFbB4Db0BE408C862ca8d33d9703209c',
    strategyRegistry: '0x9Af5CaF81b9985cB691f7763b7bE0412bb05b3dC',
    creditLines: '0xD077B6d3ed11d0aDD036D7d9b1Ac9d4FdE561fF4',
    proxyAdmin: '0x03f484190bc6889B28739Af182D996df57B02CC9',
    admin: '0x4813CB98f2322CFb9fbf2f2dAFe01297FD70D19e',
    noYield: '0x4EB3d11dC0ffD11fEBb379413840371b66384B4B',
    aaveYield: '0xf15bB845dFDeDB72c4E7c31356f03C46b64fcE60',
    yearnYield: '0x0000000000000000000000000000000000000000',
    compoundYield: '0x90a17f297CC6e85CA67251e7B4A888F9de16b192',
    verification: '0x19c388671f9B773fcBad80009e20eEE470F1AD26',
    adminVerifier: '0x6c906de6bcb1e3bFAd75F049e6C4F6f4DAC7043E',
    priceOracle: '0xeD24708d93576ca2296BE201a5e105ECAF2f6F2f',
    extension: '0xe493BA7Bee4468b8FBA61256E457A098Aa7cCA17',
    poolLogic: '0x0f5E1f09Ff37a4f2F68939cEb1A3a151Fa0AB418',
    repaymentLogic: '0x71E925ad07dA7542855d89a52bf6d139349F9b33',
    poolFactory: '0xa50E7C3444844Ef6773f3181f0a1f42B6321b677',
};

async function initCreditLines() {
    const signers = await ethers.getSigners();
    let [proxyAdmin, admin, deployer]: SignerWithAddress[] = signers;
    let deployHelper: DeployHelper = new DeployHelper(admin);
    let creditLine: CreditLine = await deployHelper.core.getCreditLines(contracts.creditLines);
    await creditLine.initialize(
        contracts.noYield,
        contracts.priceOracle,
        contracts.savingsAccount,
        contracts.strategyRegistry,
        admin.address,
        '1750000000000000000000000000',
        admin.address,
        '92000000000000000000000000000'
    );
    return 'Init Credit Lines Succesfully';
}

initCreditLines().then(console.log);

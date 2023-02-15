const contractAddresses = {
    savingsAccount: '0x5e4C098db291D4b44B8537Da21C672AdFffD42Ae',
    strategyRegistry: '0x991f82ecA95C3fF3Fa261C7703F46b63a550d444',
    creditLines: '0x108D41C3E22D011410b0eb9a414A1241f5DE8E0d',
    proxyAdmin: '0x03f484190bc6889B28739Af182D996df57B02CC9',
    admin: '0x4813CB98f2322CFb9fbf2f2dAFe01297FD70D19e',
    noYield: '0x3692eFfB781ebA88b517C30e34286F0387fb9CfD',
    aaveYield: '0xd90e1d32F298EfF7555Bb5a81Bf6a57B8c8D8d72',
    yearnYield: '0x0000000000000000000000000000000000000000',
    compoundYield: '0x85AE94D3360bC9492A4e47A0B30B5A6a1bEE90Be',
    verification: '0xBA9526beBCaAdE4144A7E3384fb47a6CFB531534',
    twitterVerifier: '0x920CeE2DE25AFaDd1F560d48662Ca28E328CBa5a',
    priceOracle: '0xcDdc6d5FA6657F4c093bbF1e2fd0607d59872D4B',
    extension: '0x560b713223BD8099E057aCeB218b7BEe83cdB948',
    poolLogic: '0x23cB8a0817920F4a383DEd9958098c6a67b5D7E9',
    repaymentLogic: '0xb45e4932faC89dA7dc22c4C7F7F24B75E116c8dC',
    poolFactory: '0x2C15EE56d8B938Add7a0B9Cbf20ebF71bC16a994',
    weth: '0xd0A1E359811322d97991E03f863a0C30C2cF029C',
    usdc: '0xdCFaB8057d08634279f8201b55d311c2a67897D2',
    beacon: '0x17AE511b86CC47590ea1330194e3C05414656722',
    poolUtils: '0x44A43F2E8EbA51Dd708010FDCeC3e19f61d87891',
    creditLineUtils: '0x58728A2BFf9A19ec253748d24636AB0Bb02E5a6d',
    savingsAccountEthUtils: '0x055C6451DA6893e80003439ab6E01EDBad2F6F5B',
    minimumBeaconProxy: '0x820a611BC2D58024060C908E0ae28Fb77bBA818F',
};

const contractsToVerify = [
    {
        contract: 'savingsAccount',
        proxy: contractAddresses.savingsAccount,
    },
    {
        contract: 'strategyRegistry',
        proxy: contractAddresses.strategyRegistry,
    },
    {
        contract: 'creditLines',
        proxy: contractAddresses.creditLines,
    },
    {
        contract: 'noYield',
        proxy: contractAddresses.noYield,
    },
    {
        contract: 'aaveYield',
        proxy: contractAddresses.aaveYield,
    },
    {
        contract: 'compoundYield',
        proxy: contractAddresses.compoundYield,
    },
    {
        contract: 'verification',
        proxy: contractAddresses.verification,
    },
    {
        contract: 'adminVerifier',
        proxy: contractAddresses.twitterVerifier,
    },
    {
        contract: 'priceOracle',
        proxy: contractAddresses.priceOracle,
    },
    {
        contract: 'extension',
        proxy: contractAddresses.extension,
    },
    {
        contract: 'pool',
        proxy: contractAddresses.poolLogic,
    },
    {
        contract: 'repayments',
        proxy: contractAddresses.repaymentLogic,
    },
    {
        contract: 'poolFactory',
        proxy: contractAddresses.poolFactory,
    },
];

const supportingContracts = {
    weth: contractAddresses.weth,
    savingsAccount: contractsToVerify.filter((a) => a.contract === 'savingsAccount')[0].proxy,
    creditLines: contractsToVerify.filter((a) => a.contract === 'creditLines')[0].proxy,
    bin: contractAddresses.admin, // admin,
    owner: contractAddresses.admin, //admin,
    poolLogic: contractsToVerify.filter((a) => a.contract === 'pool')[0].proxy,
};

const helperContractsToVerify = {
    CreditLineUtils: contractAddresses.creditLineUtils,
    PoolUtils: contractAddresses.poolUtils,
    SavingsAccountEthUtils: contractAddresses.savingsAccountEthUtils,
    beacon: contractAddresses.beacon,
    minimumBeaconProxy: contractAddresses.minimumBeaconProxy,
};

export { contractsToVerify, helperContractsToVerify, supportingContracts, contractAddresses };

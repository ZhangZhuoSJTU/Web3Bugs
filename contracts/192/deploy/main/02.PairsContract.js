module.exports = async ({ getNamedAccounts, deployments }) => {
    const { ethers } = require('hardhat');
    const { deploy, execute } = deployments;
    let { deployer } = await getNamedAccounts();

    const StableToken = await deployments.get('StableToken');
   
    const Nonce = await ethers.provider.getTransactionCount(deployer);
    const PairsContract = await deploy('PairsContract', {
        contract: 'PairsContract',
        from: deployer,
        log: true,
        nonce: Nonce,
        args: []
    });


    if (PairsContract.newlyDeployed) {
        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            0,
            "BTC/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            1,
            "ETH/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            2,
            "XAU/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            3,
            "MATIC/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            4,
            "LINK/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            5,
            "EUR/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("4"),
            ethers.utils.parseEther("500"),
            2e9,
            1e9
        );
    
        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            6,
            "GBP/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("4"),
            ethers.utils.parseEther("500"),
            2e9,
            1e9
        );
    
        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            7,
            "JPY/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("4"),
            ethers.utils.parseEther("500"),
            2e9,
            1e9
        );
    
        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            8,
            "RUB/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("10"),
            5e10,
            1e10
        );
    
        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            9,
            "CHF/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("4"),
            ethers.utils.parseEther("500"),
            2e9,
            1e9
        );
    
        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            10,
            "CAD/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("4"),
            ethers.utils.parseEther("500"),
            2e9,
            1e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            11,
            "ETH/BTC",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            12,
            "XRP/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            13,
            "BNB/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            14,
            "ADA/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            15,
            "ATOM/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            16,
            "HBAR/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            17,
            "TRX/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            18,
            "SOL/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            19,
            "DOGE/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            20,
            "LTC/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            21,
            "BCH/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            22,
            "ETC/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            23,
            "DOT/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            24,
            "XMR/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            25,
            "SHIB/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            26,
            "AVAX/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            27,
            "UNI/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            28,
            "XLM/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            29,
            "NEAR/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            30,
            "ALGO/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            31,
            "ICP/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );

        await execute(
            'PairsContract',
            { from: deployer, log: true },
            'addAsset(uint256,string,address,uint256,uint256,uint256,uint256)',
            32,
            "XAG/USD",
            "0x0000000000000000000000000000000000000000",
            ethers.utils.parseEther("2"),
            ethers.utils.parseEther("100"),
            1e10,
            5e9
        );
    }
};

module.exports.tags = ['main', 'pairscontract'];

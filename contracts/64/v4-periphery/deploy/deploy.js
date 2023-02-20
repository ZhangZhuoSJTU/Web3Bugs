const { action, info, success, warning } = require("../helpers");

function displayResult(name, result) {
    if (!result.newlyDeployed) {
        warning(`Re-used existing ${name} at ${result.address}`);
    } else {
        success(`${name} deployed at ${result.address}`);
    }
}

const chainName = (chainId) => {
    switch (chainId) {
        case 1:
            return "Mainnet";
        case 3:
            return "Ropsten";
        case 4:
            return "Rinkeby";
        case 5:
            return "Goerli";
        case 42:
            return "Kovan";
        case 56:
            return "Binance Smart Chain";
        case 77:
            return "POA Sokol";
        case 97:
            return "Binance Smart Chain (testnet)";
        case 99:
            return "POA";
        case 100:
            return "xDai";
        case 137:
            return "Matic";
        case 31337:
            return "HardhatEVM";
        case 80001:
            return "Matic (Mumbai)";
        default:
            return "Unknown";
    }
};

module.exports = async (hardhat) => {
    const { getNamedAccounts, deployments, getChainId, ethers } = hardhat;
    const { deploy } = deployments;
    console.log(deploy, "deploy");

    let { deployer } = await getNamedAccounts();
    const chainId = parseInt(await getChainId(), 10);

    // 31337 is unit testing, 1337 is for coverage
    const isTestEnvironment = chainId === 31337 || chainId === 1337;

    const signer = await ethers.provider.getSigner(deployer);

    info("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
    info("PoolTogether Pool Contracts - Deploy Script");
    info("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");

    info(`Network: ${chainName(chainId)} (${isTestEnvironment ? "local" : "remote"})`);
    info(`Deployer: ${deployer}`);

    action(`\nDeploying PrizeFlush...`);
    const prizeFlushResult = await deploy("PrizeFlush", {
        from: deployer,
        args: [deployer, deployer, deployer, deployer],
    });

    displayResult("PrizeFlush", prizeFlushResult);

    action(`\nDeploying ERC20Mintable...`);
    const erc20MintableResult = await deploy("ERC20Mintable", {
        from: deployer,
        args: ["Ticket", "TICK"],
    });

    displayResult("ERC20Mintable", erc20MintableResult);

    info("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
    success("Contract Deployments Complete!");
    info("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n");
};

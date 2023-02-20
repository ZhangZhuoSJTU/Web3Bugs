const {ethers, upgrades} = require("hardhat");

const deployAndInitDAI = async () => {
    return upgrades.deployProxy(
        await ethers.getContractFactory("FaucetERC20"),
        ["Dai Stablecoin", "DAI"], //Must be "Dai Stablecoin" or permit signature verification will fail
        {initializer: "__FaucetERC20_init(string,string)"}
    );
};

const deployAndInitUnionToken = async () => {
    const latestBlock = await ethers.provider.getBlock("latest");

    const UnionToken = await ethers.getContractFactory("UnionToken");
    return await UnionToken.deploy("Union Token", "Union", latestBlock.timestamp + 100);
};

const deployAndInitFixedInterestRateModel = async () => {
    const FixedInterestRateModel = await ethers.getContractFactory("FixedInterestRateModel");
    return await FixedInterestRateModel.deploy(ethers.utils.parseEther("0.000001"));
};

const deployAndInitSumOfTrust = async () => {
    const SumOfTrust = await ethers.getContractFactory("SumOfTrust");
    return await SumOfTrust.deploy(3);
};

const deployMarketRegistry = async () => {
    return upgrades.deployProxy(await ethers.getContractFactory("MarketRegistry"), {
        initializer: "__MarketRegistry_init()"
    });
};

const deployAndInitComptroller = async ({unionToken, marketRegistry}) => {
    return upgrades.deployProxy(
        await ethers.getContractFactory("Comptroller"),
        [unionToken.address, marketRegistry.address],
        {initializer: "__Comptroller_init(address,address)"}
    );
};

const deployAndInitAssetManager = async ({marketRegistry}) => {
    return upgrades.deployProxy(await ethers.getContractFactory("AssetManager"), [marketRegistry.address], {
        initializer: "__AssetManager_init(address)"
    });
};

const deployUToken = async () => {
    return upgrades.deployProxy(await ethers.getContractFactory("UToken"), {initializer: false});
};

const deployUErc20 = async () => {
    const UErc20 = await ethers.getContractFactory("UErc20");
    return await UErc20.deploy("UToken", "UToken");
};

const deployUserManager = async () => {
    return upgrades.deployProxy(await ethers.getContractFactory("UserManager"), {initializer: false});
};

const initMarketRegistry = async ({marketRegistry, dai, uToken, userManager}) => {
    await marketRegistry.deleteMarket(dai.address);
    await marketRegistry.addUToken(dai.address, uToken.address);
    await marketRegistry.addUserManager(dai.address, userManager.address);
};

const initUToken = async ({uErc20, uToken, dai, assetManager, fixedInterestRateModel, userManager}) => {
    const [admin] = await ethers.getSigners();
    await uErc20.transferOwnership(uToken.address);
    await uToken["__UToken_init(address,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address)"](
        uErc20.address,
        dai.address,
        ethers.utils.parseEther("1"), // initialExchangeRateMantissa
        ethers.utils.parseEther("0.5"), // reserveFactorMantissa
        ethers.utils.parseEther("0.01"), // originationFee, 1%
        ethers.utils.parseEther("1000"), // debtCeiling
        ethers.utils.parseEther("1000"), // maxBorrow
        ethers.utils.parseEther("1"), // minBorrow
        10, // overdueBlocks,
        admin.address
    );
    await uToken.setAssetManager(assetManager.address);
    await uToken.setInterestRateModel(fixedInterestRateModel.address);
    await uToken.setUserManager(userManager.address);
};

const initUserManager = async ({userManager, assetManager, unionToken, dai, sumOfTrust, comptroller, uToken}) => {
    const [admin] = await ethers.getSigners();
    await userManager["__UserManager_init(address,address,address,address,address,address)"](
        assetManager.address,
        unionToken.address,
        dai.address,
        sumOfTrust.address,
        comptroller.address,
        admin.address
    );
    await userManager.setUToken(uToken.address);
};

const deployFullSuite = async () => {
    const dai = await deployAndInitDAI();
    const unionToken = await deployAndInitUnionToken();
    const fixedInterestRateModel = await deployAndInitFixedInterestRateModel();
    const sumOfTrust = await deployAndInitSumOfTrust();
    const marketRegistry = await deployMarketRegistry();
    const comptroller = await deployAndInitComptroller({unionToken, marketRegistry});
    const assetManager = await deployAndInitAssetManager({marketRegistry});
    const uErc20 = await deployUErc20();
    const uToken = await deployUToken();
    const userManager = await deployUserManager();

    await initMarketRegistry({marketRegistry, dai, uToken, userManager});
    await initUToken({uErc20, uToken, dai, assetManager, fixedInterestRateModel, userManager});
    await initUserManager({userManager, assetManager, unionToken, dai, sumOfTrust, comptroller, uToken});
    await unionToken.whitelist(comptroller.address);
    return {
        dai,
        unionToken,
        fixedInterestRateModel,
        sumOfTrust,
        comptroller,
        marketRegistry,
        assetManager,
        uErc20,
        uToken,
        userManager
    };
};

module.exports = {
    deployAndInitDAI,
    deployAndInitUnionToken,
    deployAndInitFixedInterestRateModel,
    deployAndInitSumOfTrust,
    deployAndInitComptroller,
    deployMarketRegistry,
    deployAndInitAssetManager,
    deployUToken,
    deployUserManager,
    initMarketRegistry,
    initUToken,
    initUserManager,
    deployFullSuite
};

const {ethers, upgrades} = require("hardhat");
const {expect} = require("chai");
require("chai").should();
const {parseEther} = require("ethers").utils;

const {waitNBlocks} = require("../../utils");

const INFLATION_TEST_DATA = [
    ["1", "1"],
    ["10", "0.9"],
    ["100", "0.8"],
    ["1000", "0.7"],
    ["10000", "0.6"],
    ["100000", "0.5"],
    ["500000", "0.25"],
    ["1000000", "0.1"],
    ["10000000", "0.01"],
    ["100000000", "0.001"],
    ["1000000000", "0.0001"],
    ["10000000000", "0.00001"],
    ["10000000001", "0.000001"]
];

describe("Comptroller Contract", () => {
    let comptrollerContract;
    let ADMIN, ALICE, BOB, APP, PROXY_ADMIN;
    before(async function () {
        // await deployments.fixture(); // ensure we start from a fresh deployments

        [ADMIN, ALICE, BOB, APP, PROXY_ADMIN] = await ethers.getSigners();

        const AssetManager = await ethers.getContractFactory("AssetManagerMock");
        const ERC20 = await ethers.getContractFactory("FaucetERC20");
        const MarketRegistry = await ethers.getContractFactory("MarketRegistryMock");
        const UnionToken = await ethers.getContractFactory("UnionTokenMock");
        const SumOfTrust = await ethers.getContractFactory("SumOfTrustMock");
        const UToken = await ethers.getContractFactory("UTokenMock");

        testToken = await upgrades.deployProxy(ERC20, ["Mock DAI", "DAI"], {
            initializer: "__FaucetERC20_init(string,string)"
        });
        await testToken.mint(ADMIN.address, parseEther("100000000"));

        sumOfTrust = await SumOfTrust.deploy(3);

        const latestBlock = await ethers.provider.getBlock("latest");
        unionToken = await UnionToken.deploy("Union Token", "UNION");

        marketRegistry = await upgrades.deployProxy(MarketRegistry, [], {
            initializer: "__MarketRegistryMock_init()"
        });

        assetManager = await upgrades.deployProxy(AssetManager, [], {
            initializer: "__AssetManager_init()"
        });

        uToken = await upgrades.deployProxy(UToken, [], {
            initializer: "__UToken_init()"
        });

        const UserManager = await ethers.getContractFactory("UserManagerMock");
        userManager = await upgrades.deployProxy(UserManager, [], {
            initializer: "__UserManager_init()"
        });
    });

    beforeEach(async () => {
        await marketRegistry.deleteMarket(testToken.address);
        const Comptroller = await ethers.getContractFactory("Comptroller");
        comptrollerContract = await upgrades.deployProxy(Comptroller, [unionToken.address, marketRegistry.address], {
            initializer: "__Comptroller_init(address,address)"
        });

        await marketRegistry.addUserManager(testToken.address, userManager.address);
        await marketRegistry.addUToken(testToken.address, uToken.address);
        await unionToken.transfer(comptrollerContract.address, parseEther("1000"));
    });

    it("Calculate inflation", async () => {
        const promises = INFLATION_TEST_DATA.map(async arr => {
            const inflation = await comptrollerContract.inflationPerBlock(ethers.utils.parseEther(arr[0]));
            (inflation / 1e18).toString().should.eq(arr[1]);
        });

        await Promise.all(promises);
    });

    it("Calculate inflation exceeds the maximum", async () => {
        const inflation = await comptrollerContract.inflationPerBlock(ethers.utils.parseEther("10000000001"));
        (inflation / 1e18).toString().should.eq(INFLATION_TEST_DATA[INFLATION_TEST_DATA.length - 1][1]);
    });

    it("Should withdraw rewards based on calucated ones", async () => {
        // forward 1 block
        await waitNBlocks(1);

        const oldBalance = await unionToken.balanceOf(BOB.address);

        await testToken.transfer(BOB.address, ethers.utils.parseEther("100"));
        await testToken.connect(BOB).approve(userManager.address, ethers.utils.parseEther("100"));
        await userManager.connect(BOB).stake(ethers.utils.parseEther("100"));
        // Calculate the rewards for the next block
        const nextRewards = await comptrollerContract.calculateRewardsByBlocks(BOB.address, testToken.address, 1);

        await userManager.connect(BOB).withdrawRewards();

        const newBalance = await unionToken.balanceOf(BOB.address);

        nextRewards.toString().should.eq((newBalance - oldBalance).toString());
    });

    it("not member rewards multiplier should be nonMemberRatio", async () => {
        const nonMemberRatio = await comptrollerContract.nonMemberRatio();

        multiplier = await comptrollerContract.getRewardsMultiplier(ALICE.address, testToken.address);
        multiplier.toString().should.eq(nonMemberRatio.toString());
    });

    it("Rewards multiplier when locked ratio less than 100% and greater than 0%", async () => {
        await userManager.setIsMember(true);
        await userManager.setStakerBalance("100");
        await userManager.setTotalLockedStake("50");

        const memberRatio = await comptrollerContract.memberRatio();
        let multiplier = await comptrollerContract.getRewardsMultiplier(ADMIN.address, testToken.address);
        const usage = ethers.utils.parseEther("0.5");
        multiplier.toString().should.eq(memberRatio.add(usage).toString());
    });

    it("Rewards multiplier when locked ratio equal 100% should be memberRatio * 2", async () => {
        await userManager.setIsMember(true);
        await userManager.setStakerBalance("100");
        await userManager.setTotalLockedStake("100");

        const memberRatio = await comptrollerContract.memberRatio();
        let multiplier = await comptrollerContract.getRewardsMultiplier(ADMIN.address, testToken.address);
        multiplier.should.eq(memberRatio.mul(2));
    });

    it("Rewards multiplier when locked frozen ratio equal 100% should be memberRatio", async () => {
        await userManager.setIsMember(true);
        await userManager.setStakerBalance("100");
        await userManager.setTotalLockedStake("100");
        await userManager.setTotalFrozenAmount("100");

        const memberRatio = await comptrollerContract.memberRatio();
        let multiplier = await comptrollerContract.getRewardsMultiplier(ADMIN.address, testToken.address);
        multiplier.toString().should.eq(memberRatio.toString());
    });

    it("Should calculate rewards", async () => {
        let rewards = await comptrollerContract.calculateRewards(ADMIN.address, testToken.address);
        rewards.toString().should.eq("0");
    });

    it("Should calculate rewards per year", async () => {
        // forward 1 block
        await network.provider.send("evm_mine");

        const blockPerYear = 2102400;
        let rewardsPerYear = await comptrollerContract.calculateRewardsByBlocks(
            ADMIN.address,
            testToken.address,
            blockPerYear
        );
        console.log(rewardsPerYear.toString());
    });
});

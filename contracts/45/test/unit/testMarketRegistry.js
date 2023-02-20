const {ethers, upgrades} = require("hardhat");
require("chai").should();

describe("MarketRegistry Contract", () => {
    let marketRegistry, uToken, userManager;
    const ETH = "0x0000000000000000000000000000000000000001";

    before(async function () {
        [uToken, userManager] = await ethers.getSigners();

        marketRegistry = await upgrades.deployProxy(await ethers.getContractFactory("MarketRegistry"), [], {
            initializer: "__MarketRegistry_init()"
        });
    });

    it("Get utokens and userManagers", async () => {
        const utokens = await marketRegistry.getUTokens();
        utokens.length.should.eq(0);

        const userManagers = await marketRegistry.getUserManagers();
        userManagers.length.should.eq(0);
    });

    it("Add and delete utoken", async () => {
        await marketRegistry.addUToken(ETH, uToken.address);

        let res = await marketRegistry.tokens(ETH);
        res.uToken.should.eq(uToken.address);

        utokens = await marketRegistry.getUTokens();
        utokens.length.should.eq(1);

        await marketRegistry.deleteMarket(ETH);

        utokens = await marketRegistry.getUTokens();
        utokens.length.should.eq(0);

        res = await marketRegistry.tokens(ETH);
        res.uToken.should.eq(ethers.constants.AddressZero);

        //delete not exist market
        await marketRegistry.deleteMarket(ETH);
    });

    it("Add and delete userManager", async () => {
        await marketRegistry.addUserManager(ETH, userManager.address);

        let res = await marketRegistry.tokens(ETH);
        res.userManager.should.eq(userManager.address);

        markets = await marketRegistry.getUserManagers();
        markets.length.should.eq(1);

        await marketRegistry.deleteMarket(ETH);

        markets = await marketRegistry.getUserManagers();
        markets.length.should.eq(0);

        res = await marketRegistry.tokens(ETH);
        res.userManager.should.eq(ethers.constants.AddressZero);

        //delete not exist market
        await marketRegistry.deleteMarket(ETH);
    });
});

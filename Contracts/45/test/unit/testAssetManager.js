const {ethers, upgrades} = require("hardhat");
const {expect} = require("chai");

require("chai").should();

describe("AssetManager Contract", async () => {
    let ADMIN, CONTRACT, CONTRACT2, ALICE, BOB, MARKET_REGISTRY;
    let erc20, assetManager, marketRegistry, compoundAdapter, compoundAdapter2, testToken;

    before(async () => {
        [ADMIN, CONTRACT, CONTRACT2, ALICE, BOB, MARKET_REGISTRY] = await ethers.getSigners();

        erc20 = await upgrades.deployProxy(
            await ethers.getContractFactory("FaucetERC20"),
            ["Dai Stablecoin", "DAI"], // exact name needed for signature verifaction
            {initializer: "__FaucetERC20_init(string,string)"}
        );

        testToken = await upgrades.deployProxy(await ethers.getContractFactory("FaucetERC20"), {initializer: false});

        marketRegistry = await upgrades.deployProxy(await ethers.getContractFactory("MarketRegistryMock"), [], {
            initializer: "__MarketRegistryMock_init()"
        });

        assetManager = await upgrades.deployProxy(
            await ethers.getContractFactory("AssetManager"),
            [marketRegistry.address],
            {initializer: "__AssetManager_init(address)"}
        );

        compoundAdapter = await upgrades.deployProxy(await ethers.getContractFactory("CompoundAdapterMock"), [], {
            initializer: "__CompoundAdapterMock_init()"
        });
        await compoundAdapter.setSupport();

        compoundAdapter2 = await upgrades.deployProxy(await ethers.getContractFactory("CompoundAdapterMock"), [], {
            initializer: "__CompoundAdapterMock_init()"
        });

        await assetManager.addAdapter(compoundAdapter.address);
        await assetManager.changeWithdrawSequence([0]);

        await erc20.mint(CONTRACT.address, ethers.utils.parseEther("1000"));
        await erc20.mint(CONTRACT2.address, ethers.utils.parseEther("1000"));
        await erc20.mint(ADMIN.address, ethers.utils.parseEther("1000"));
        await erc20.mint(ALICE.address, ethers.utils.parseEther("1000"));
        await erc20.mint(BOB.address, ethers.utils.parseEther("1000"));
    });

    it("Token is exist", async () => {
        await assetManager.addToken(erc20.address);
        await expect(assetManager.addToken(erc20.address)).to.be.revertedWith("AssetManager: token is exist");
    });

    it("Amount can not be zero", async () => {
        await marketRegistry.addUToken(erc20.address, CONTRACT.address);
        await expect(assetManager.connect(CONTRACT).deposit(erc20.address, 0)).to.be.revertedWith(
            "AssetManager: amount can not be zero"
        );
    });

    it("Not enough allowance to transferFrom", async () => {
        await marketRegistry.addUToken(erc20.address, CONTRACT.address);
        await compoundAdapter.setFloor(erc20.address, ethers.utils.parseEther("0"));
        await compoundAdapter.setCeiling(erc20.address, ethers.utils.parseEther("999999"));

        await erc20.connect(CONTRACT).approve(assetManager.address, 0);
        await expect(
            assetManager.connect(CONTRACT).deposit(erc20.address, ethers.utils.parseEther("1"))
        ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    });

    it("Deposit and withdraw erc20", async () => {
        const depositAmount = ethers.utils.parseEther("1");
        const withdrawAmount = ethers.utils.parseEther("1");
        await erc20.connect(CONTRACT).approve(assetManager.address, depositAmount);
        await assetManager.connect(CONTRACT).deposit(erc20.address, depositAmount);
        const balanceStart = await assetManager.getPoolBalance(erc20.address);
        balanceStart.toString().should.eq(depositAmount.toString());

        await assetManager.connect(CONTRACT).withdraw(erc20.address, CONTRACT.address, withdrawAmount);
        const balanceEnd = await assetManager.getPoolBalance(erc20.address);
        balanceEnd.toString().should.eq((depositAmount - withdrawAmount).toString());

        //supply > 0 && supply >= remaining;
        await erc20.connect(CONTRACT).approve(assetManager.address, 100);
        await assetManager.connect(CONTRACT).deposit(erc20.address, 1);
        await assetManager.connect(CONTRACT).withdraw(erc20.address, CONTRACT.address, 1);
        //supply > 0 && supply < remaining;
        await assetManager.connect(CONTRACT).deposit(erc20.address, 20);
        await assetManager.connect(CONTRACT).withdraw(erc20.address, CONTRACT.address, 20);
    });

    it("Claim tokens", async () => {
        const amount = ethers.utils.parseEther("1");
        await erc20.connect(CONTRACT).transfer(assetManager.address, amount);
        let balance = await erc20.balanceOf(assetManager.address);
        balance.toString().should.eq(amount);
        await assetManager.claimTokens(erc20.address, ADMIN.address);
        balance = await erc20.balanceOf(assetManager.address);
        balance.toString().should.eq("0");
    });

    it("Claim tokens from adapter", async () => {
        await assetManager.claimTokensFromAdapter(0, erc20.address, ADMIN.address);
        const balance = await assetManager.getPoolBalance(erc20.address);
        balance.toString().should.eq("0");
    });

    it("Claim tokens: recipient can not be zero", async () => {
        await expect(assetManager.claimTokens(erc20.address, ethers.constants.AddressZero)).to.be.revertedWith(
            "AsstManager: recipient can not be zero"
        );
    });

    it("Rebalance", async () => {
        await assetManager.rebalance(erc20.address, []);
    });

    it("Rebalance: percentages error", async () => {
        await expect(assetManager.rebalance(erc20.address, [10000])).to.be.revertedWith(
            "AssetManager: percentages error"
        );
    });

    it("Rebalance: remaining funds in the fund pool", async () => {
        await erc20.transfer(assetManager.address, "10000");
        await assetManager.addAdapter(compoundAdapter2.address);
        await expect(assetManager.rebalance(erc20.address, [5000])).to.be.revertedWith(
            "AssetManager: there are remaining funds in the fund pool"
        );
    });

    it("Pausable and unpause", async () => {
        await assetManager.pause();
        await expect(assetManager.connect(CONTRACT).deposit(erc20.address, 1)).to.be.revertedWith("Controller: paused");
        await expect(assetManager.connect(CONTRACT).withdraw(erc20.address, BOB.address, 1)).to.be.revertedWith(
            "Controller: paused"
        );
        await assetManager.unpause();
    });

    it("Add adapter and token", async () => {
        const marketCount = await assetManager.moneyMarketsCount();
        marketCount.toString().should.eq("2");

        const supportedTokensCount = await assetManager.supportedTokensCount();
        supportedTokensCount.toString().should.eq("1");

        const isSupported = await assetManager.isMarketSupported(erc20.address);
        isSupported.should.eq(true);
    });

    it("Get total supply", async () => {
        let totalSupply = await assetManager.totalSupplyView(erc20.address);
        totalSupply.toString().should.eq("0");
        totalSupply = await assetManager.totalSupply(erc20.address);

        totalSupply = await assetManager.totalSupplyView(testToken.address);
        totalSupply.toString().should.eq("0");
        totalSupply = await assetManager.totalSupply(testToken.address);

        totalSupply = await assetManager.totalSupply(erc20.address);
    });

    it("Get pool balance", async () => {
        let balance = await assetManager.getPoolBalance(erc20.address);
        balance.toString().should.eq("10000");

        balance = await assetManager.getPoolBalance(testToken.address);
        balance.toString().should.eq("0");
    });

    it("Get loanable amount", async () => {
        const depositAmount = ethers.utils.parseEther("1");
        let balance = await assetManager.getLoanableAmount(erc20.address);
        balance.toString().should.eq("10000");

        await erc20.connect(CONTRACT).approve(assetManager.address, depositAmount);
        await assetManager.connect(CONTRACT).deposit(erc20.address, depositAmount);
        balance = await assetManager.getLoanableAmount(erc20.address);
        //ether("1") + 10000
        balance.toString().should.eq("1000000000000010000");
    });

    it("Approve all markets max", async () => {
        await assetManager.approveAllMarketsMax(erc20.address);
    });

    it("User balance not enough", async () => {
        await expect(
            assetManager.connect(CONTRACT).deposit(erc20.address, ethers.utils.parseEther("10001"))
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Debt write off", async () => {
        const amount = ethers.utils.parseEther("1");
        await marketRegistry.addUserManager(erc20.address, CONTRACT2.address);
        await erc20.connect(CONTRACT2).approve(assetManager.address, amount);
        await assetManager.connect(CONTRACT2).deposit(erc20.address, amount);
        const balanceBefore = await assetManager.balances(CONTRACT2.address, erc20.address);
        await assetManager.connect(CONTRACT2).debtWriteOff(erc20.address, amount);
        const balanceAfter = await assetManager.balances(CONTRACT2.address, erc20.address);
        balanceAfter.toString().should.eq(balanceBefore.sub(amount));
    });

    it("Call from lending market", async () => {
        await marketRegistry.addUToken(erc20.address, CONTRACT.address);
        await erc20.connect(CONTRACT).approve(assetManager.address, ethers.utils.parseEther("10000000"));
        await assetManager.connect(CONTRACT).deposit(erc20.address, ethers.utils.parseEther("1"));

        await assetManager.connect(CONTRACT).withdraw(erc20.address, BOB.address, ethers.utils.parseEther("1"));
    });

    it("Balance not enough to withdraw", async () => {
        await marketRegistry.addUToken(erc20.address, CONTRACT.address);
        await expect(
            assetManager.connect(CONTRACT).withdraw(erc20.address, BOB.address, ethers.utils.parseEther("100000000"))
        ).to.be.revertedWith("AssetManager: balance not enough to withdraw");
    });

    it("Set new marketRegistry", async () => {
        await assetManager.setMarketRegistry(MARKET_REGISTRY.address);

        let res = await assetManager.marketRegistry();
        res.should.eq(MARKET_REGISTRY.address);
    });

    describe("Overwirte adapter order", () => {
        it("Adaptor 1 should be at postion 0", async () => {
            const adaptor = await assetManager.moneyMarkets(0);
            adaptor.should.eq(compoundAdapter.address);
        });

        it("Adaptor 2 should be at postion 1", async () => {
            const adaptor = await assetManager.moneyMarkets(1);
            adaptor.should.eq(compoundAdapter2.address);
        });

        it("Swap adapter order", async () => {
            await assetManager.overwriteAdapters([compoundAdapter2.address, compoundAdapter.address]);
        });

        it("Adaptor 2 should be at postion 0", async () => {
            const adaptor = await assetManager.moneyMarkets(0);
            adaptor.should.eq(compoundAdapter2.address);
        });

        it("Adaptor 1 should be at postion 1", async () => {
            const adaptor = await assetManager.moneyMarkets(1);
            adaptor.should.eq(compoundAdapter.address);
        });

        it("Non admin Alice should not be able to overwrite adapter order", async () => {
            await expect(
                assetManager.connect(ALICE).overwriteAdapters([compoundAdapter.address, compoundAdapter2.address])
            ).to.be.revertedWith("Controller: not admi");
        });
    });
});

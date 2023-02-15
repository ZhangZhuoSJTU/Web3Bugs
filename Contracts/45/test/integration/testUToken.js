const {ethers} = require("hardhat");
const {parseEther} = ethers.utils;
const {waitNBlocks} = require("../../utils");

const {deployFullSuite} = require("../../utils/deployer");

require("chai").should();

describe("UToken Contract", async () => {
    before(async () => {
        [ADMIN, STAKER_A, STAKER_B, STAKER_C, BORROWER_Z, proxyAdmin] = await ethers.getSigners();
        ({
            dai: erc20Proxy,
            sumOfTrust,
            fixedInterestRateModel,
            unionToken,
            userManager,
            uToken,
            uErc20,
            marketRegistry,
            comptroller,
            assetManager
        } = await deployFullSuite());
        const amount = parseEther("10000");
        await erc20Proxy.mint(ADMIN.address, parseEther("10000000"));
        await erc20Proxy.transfer(STAKER_A.address, amount);
        await erc20Proxy.transfer(STAKER_B.address, amount);
        await erc20Proxy.transfer(STAKER_C.address, amount);
        await erc20Proxy.transfer(BORROWER_Z.address, amount);
        //Handling fee is set to 0
        await userManager.setNewMemberFee(0);
        await erc20Proxy.connect(STAKER_A).approve(userManager.address, amount);
        await erc20Proxy.connect(STAKER_B).approve(userManager.address, amount);
        await erc20Proxy.connect(STAKER_C).approve(userManager.address, amount);
        await userManager.addMember(STAKER_A.address);
        await userManager.addMember(STAKER_B.address);
        await userManager.addMember(STAKER_C.address);
        await userManager.addMember(BORROWER_Z.address);
        await userManager.connect(STAKER_A).stake(parseEther("100"));
        await userManager.connect(STAKER_B).stake(parseEther("100"));
        await userManager.connect(STAKER_C).stake(parseEther("100"));
        await userManager.connect(STAKER_A).updateTrust(BORROWER_Z.address, parseEther("100"));
        await userManager.connect(STAKER_B).updateTrust(BORROWER_Z.address, parseEther("100"));
        await userManager.connect(STAKER_C).updateTrust(BORROWER_Z.address, parseEther("100"));
    });

    it("mint and redeemable", async () => {
        const borrowRatePerBlock = parseEther("0.000001");
        const mintAmount = parseEther("200");
        const redeemAmount = parseEther("100");
        const WAD = parseEther("1");
        await fixedInterestRateModel.setInterestRate(borrowRatePerBlock);
        exchangeRate = await uToken.exchangeRateStored();
        exchangeRate.toString().should.eq(WAD.toString());

        await erc20Proxy.approve(uToken.address, mintAmount);
        await uToken.mint(mintAmount);
        balance = await uErc20.balanceOf(ADMIN.address);
        balance.toString().should.eq(mintAmount.toString());
        await uToken.redeem(redeemAmount);
        balance = await uErc20.balanceOf(ADMIN.address);
        balance.toString().should.eq(mintAmount.sub(redeemAmount).toString());

        totalSupply = await uErc20.totalSupply();
        await uToken.connect(BORROWER_Z).borrow(totalSupply.mul(exchangeRate).div(WAD));

        await waitNBlocks(10);

        const borrowed = await uToken.borrowBalanceView(BORROWER_Z.address);
        await erc20Proxy.connect(BORROWER_Z).approve(uToken.address, borrowed);
        await uToken.connect(BORROWER_Z).repayBorrow(borrowed);

        supplyRatePerBlock = await uToken.supplyRatePerBlock();
        exchangeRate = await uToken.exchangeRateStored();

        await uToken.redeemUnderlying(mintAmount.sub(redeemAmount).mul(exchangeRate).div(WAD));
        balance = await uErc20.balanceOf(ADMIN.address);
        balance.toString().should.eq("0");
    });
});

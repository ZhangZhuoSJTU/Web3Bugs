const {waitNBlocks} = require("../../utils");
const {ethers, upgrades, waffle} = require("hardhat");
const {expect} = require("chai");

require("chai").should();
const {signDaiPermit, signERC2612Permit} = require("eth-permit");

describe("UToken Contract", async () => {
    let admin, alice, bob, staker1, staker2, staker3;
    let erc20, assetManager, unionToken, fixedInterestRateModel, userManager, comptroller, marketRegistry, uToken;

    const borrowInterestPerBlock = ethers.utils.parseEther("0.000001"); //0.0001%
    const initialExchangeRateMantissa = ethers.utils.parseEther("1");
    const reserveFactorMantissa = ethers.utils.parseEther("0.5");
    const originationFee = ethers.utils.parseEther("0.01"); //1%
    const debtCeiling = ethers.utils.parseEther("1000");
    const maxBorrow = ethers.utils.parseEther("100");
    const minBorrow = ethers.utils.parseEther("1");
    const overdueBlocks = 10;

    before(async () => {
        [admin, alice, bob, staker1, staker2, staker3] = await ethers.getSigners();

        erc20 = await upgrades.deployProxy(
            await ethers.getContractFactory("FaucetERC20"),
            ["Dai Stablecoin", "DAI"], // exact name needed for signature verifaction
            {initializer: "__FaucetERC20_init(string,string)"}
        );

        const UnionToken = await ethers.getContractFactory("UnionTokenMock");
        unionToken = await UnionToken.deploy("Union Token", "Union");

        FixedInterestRateModel = await ethers.getContractFactory("FixedInterestRateModelMock");
        fixedInterestRateModel = await FixedInterestRateModel.deploy(borrowInterestPerBlock);

        marketRegistry = await upgrades.deployProxy(await ethers.getContractFactory("MarketRegistryMock"), [], {
            initializer: "__MarketRegistryMock_init()"
        });

        comptroller = await upgrades.deployProxy(await ethers.getContractFactory("ComptrollerMock"), [], {
            initializer: "__ComptrollerMock_init()"
        });

        assetManager = await upgrades.deployProxy(await ethers.getContractFactory("AssetManagerMock"), [], {
            initializer: "__AssetManager_init()"
        });

        userManager = await upgrades.deployProxy(await ethers.getContractFactory("UserManagerMock"), [], {
            initializer: "__UserManager_init()"
        });

        await unionToken.transfer(comptroller.address, ethers.utils.parseEther("1000"));

        const amount = ethers.utils.parseEther("1000");
        await erc20.mint(assetManager.address, ethers.utils.parseEther("20"));
        await erc20.mint(alice.address, amount);
        await erc20.mint(bob.address, amount);
        await erc20.mint(staker1.address, amount);
        await erc20.mint(staker2.address, amount);
        await erc20.mint(staker3.address, amount);
    });

    beforeEach(async () => {
        const UErc20 = await ethers.getContractFactory("UErc20");
        uErc20 = await UErc20.deploy("uToken", "uToken");
        const UToken = await ethers.getContractFactory("UToken");
        uToken = await upgrades.deployProxy(
            UToken,
            [
                uErc20.address,
                erc20.address,
                initialExchangeRateMantissa,
                reserveFactorMantissa,
                originationFee,
                debtCeiling,
                maxBorrow,
                minBorrow,
                overdueBlocks,
                admin.address
            ],
            {
                initializer:
                    "__UToken_init(address,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address)"
            }
        );
        await uErc20.transferOwnership(uToken.address);

        await marketRegistry.deleteMarket(erc20.address);
        await marketRegistry.addUToken(erc20.address, uToken.address);
        await marketRegistry.addUserManager(erc20.address, userManager.address);
        await uToken.setUserManager(userManager.address);
        await uToken.setAssetManager(assetManager.address);
        await uToken.setInterestRateModel(fixedInterestRateModel.address);
    });

    it("Get and set params", async () => {
        let assetManagerNew = await uToken.assetManager();
        assetManagerNew.should.eq(assetManager.address);
        await expect(uToken.connect(alice).setAssetManager(ethers.constants.AddressZero)).to.be.revertedWith(
            "Controller: not admin"
        );
        await uToken.setAssetManager(ethers.constants.AddressZero);
        assetManagerNew = await uToken.assetManager();
        assetManagerNew.should.eq(ethers.constants.AddressZero);

        let userManagerNew = await uToken.userManager();
        userManagerNew.should.eq(userManager.address);
        await expect(uToken.connect(alice).setUserManager(ethers.constants.AddressZero)).to.be.revertedWith(
            "Controller: not admin"
        );

        await uToken.setUserManager(ethers.constants.AddressZero);
        userManagerNew = await uToken.userManager();
        userManagerNew.should.eq(ethers.constants.AddressZero);

        let originationFeeNew = await uToken.originationFee();
        originationFeeNew.toString().should.eq(originationFee.toString());
        await expect(uToken.connect(alice).setOriginationFee(0)).to.be.revertedWith("Controller: not admin");
        await uToken.setOriginationFee(0);
        userManagerNew = await uToken.originationFee();
        userManagerNew.toString().should.eq("0");

        let debtCeilingNew = await uToken.debtCeiling();
        debtCeilingNew.toString().should.eq(debtCeiling.toString());
        await expect(uToken.connect(alice).setDebtCeiling(0)).to.be.revertedWith("Controller: not admin");
        await uToken.setDebtCeiling(0);
        debtCeilingNew = await uToken.debtCeiling();
        debtCeilingNew.toString().should.eq("0");

        let minBorrowNew = await uToken.minBorrow();
        minBorrowNew.toString().should.eq(minBorrow.toString());
        await expect(uToken.connect(alice).setMinBorrow(0)).to.be.revertedWith("Controller: not admin");
        await uToken.setMinBorrow(0);
        minBorrowNew = await uToken.minBorrow();
        minBorrowNew.toString().should.eq("0");

        let maxBorrowNew = await uToken.maxBorrow();
        maxBorrowNew.toString().should.eq(maxBorrow.toString());
        await expect(uToken.connect(alice).setMaxBorrow(0)).to.be.revertedWith("Controller: not admin");
        await uToken.setMaxBorrow(0);
        maxBorrowNew = await uToken.maxBorrow();
        maxBorrowNew.toString().should.eq("0");

        let overdueBlocksNew = await uToken.overdueBlocks();
        overdueBlocksNew.toString().should.eq(overdueBlocks.toString());
        await expect(uToken.connect(alice).setOverdueBlocks(0)).to.be.revertedWith("Controller: not admin");
        await uToken.setOverdueBlocks(0);
        overdueBlocksNew = await uToken.overdueBlocks();
        overdueBlocksNew.toString().should.eq("0");

        let reserveFactorMantissaNew = await uToken.reserveFactorMantissa();
        reserveFactorMantissaNew.toString().should.eq(reserveFactorMantissa.toString());
        await expect(uToken.connect(alice).setReserveFactor(0)).to.be.revertedWith("Controller: not admin");
        await uToken.setReserveFactor(0);
        reserveFactorMantissaNew = await uToken.reserveFactorMantissa();
        reserveFactorMantissaNew.toString().should.eq("0");

        let interestRateModelNew = await uToken.interestRateModel();
        interestRateModelNew.should.eq(fixedInterestRateModel.address);
        await expect(uToken.connect(alice).setInterestRateModel(ethers.constants.AddressZero)).to.be.revertedWith(
            "Controller: not admin"
        );
        await expect(uToken.setInterestRateModel(ethers.constants.AddressZero)).to.be.reverted;
        let fixedInterestRateModelNew = await FixedInterestRateModel.deploy(borrowInterestPerBlock);
        await uToken.setInterestRateModel(fixedInterestRateModelNew.address);
        interestRateModelNew = await uToken.interestRateModel();
        interestRateModelNew.should.eq(fixedInterestRateModelNew.address);
    });

    it("Only member can borrow", async () => {
        await expect(uToken.connect(bob).borrow(ethers.utils.parseEther("1"))).to.be.revertedWith(
            "UToken: caller is not a member"
        );
    });

    it("Verify various borrow restrictions", async () => {
        //mock isMember
        await userManager.setIsMember(true);
        await userManager.setCreditLimit(ethers.utils.parseEther("10"));

        await expect(uToken.connect(alice).borrow(minBorrow.sub(ethers.utils.parseEther("0.01")))).to.be.revertedWith(
            "UToken: amount less than loan size min"
        );

        const remainingLoanSize = await uToken.getRemainingLoanSize();
        await expect(
            uToken.connect(alice).borrow(remainingLoanSize.add(ethers.utils.parseEther("1")))
        ).to.be.revertedWith("UToken: amount more than loan global size max");

        await expect(uToken.connect(alice).borrow(maxBorrow.add(ethers.utils.parseEther("1")))).to.be.revertedWith(
            "UToken: amount large than borrow size max"
        );

        const loanableAmount = await assetManager.getLoanableAmount(erc20.address);
        await expect(uToken.connect(alice).borrow(loanableAmount.add(ethers.utils.parseEther("1")))).to.be.revertedWith(
            "UToken: Not enough to lend out"
        );

        const creditLimit = await userManager.getCreditLimit(alice.address);
        await expect(uToken.connect(alice).borrow(creditLimit.add(ethers.utils.parseEther("1")))).to.be.revertedWith(
            "UToken: The loan amount plus fee is greater than credit limit"
        );

        await uToken.connect(alice).borrow(ethers.utils.parseEther("1"));
        await waitNBlocks(overdueBlocks);
        await expect(uToken.connect(alice).borrow(ethers.utils.parseEther("1"))).to.be.revertedWith(
            "UToken: Member has loans overdue"
        );
    });

    it("Borrow and calc interest, fee", async () => {
        const WAD = ethers.utils.parseEther("1");
        await uToken.connect(alice).borrow(ethers.utils.parseEther("1"));
        const fee = parseFloat(originationFee) / parseFloat(WAD);
        let expectedBorrowed = ethers.utils.parseEther(1 + 1 * fee + "");
        let borrowed = await uToken.borrowBalanceView(alice.address);
        borrowed.toString().should.eq(expectedBorrowed.toString());

        await waitNBlocks(1);
        expectedBorrowed = borrowed.add(borrowed.mul(borrowInterestPerBlock).div(WAD));
        borrowed = await uToken.borrowBalanceView(alice.address);
        borrowed.toString().should.eq(expectedBorrowed.toString());
    });

    it("Repay borrow when no overdue", async () => {
        await uToken.connect(alice).borrow(ethers.utils.parseEther("1"));
        let borrowed = await uToken.borrowBalanceView(alice.address);
        borrowed.toString().should.not.eq("0");
        const repayAmount = borrowed.add(ethers.utils.parseEther("0.001")); //In order to repay cleanly and avoid the interest incurred when repaying
        await erc20.connect(alice).approve(uToken.address, repayAmount);
        await uToken.connect(alice).repayBorrow(repayAmount);
        borrowed = await uToken.borrowBalanceView(alice.address);
        borrowed.toString().should.eq("0");
    });

    it("Repay borrow when is overdue", async () => {
        await uToken.connect(alice).borrow(ethers.utils.parseEther("1"));
        await waitNBlocks(overdueBlocks + 1);
        let isOverdue = await uToken.checkIsOverdue(alice.address);
        isOverdue.should.eq(true);
        let borrowed = await uToken.borrowBalanceView(alice.address);
        borrowed.toString().should.not.eq("0");
        const repayAmount = borrowed.add(ethers.utils.parseEther("0.001")); //In order to repay cleanly and avoid the interest incurred when repaying
        await erc20.connect(alice).approve(uToken.address, repayAmount);
        await uToken.connect(alice).repayBorrow(repayAmount);
        isOverdue = await uToken.checkIsOverdue(alice.address);
        isOverdue.should.eq(false);
        borrowed = await uToken.borrowBalanceView(alice.address);
        borrowed.toString().should.eq("0");
    });

    it("Repay borrow by behalf", async () => {
        await uToken.connect(alice).borrow(ethers.utils.parseEther("1"));
        let borrowed = await uToken.borrowBalanceView(alice.address);
        borrowed.toString().should.not.eq("0");
        const repayAmount = borrowed.add(ethers.utils.parseEther("0.001")); //In order to repay cleanly and avoid the interest incurred when repaying
        await erc20.connect(bob).approve(uToken.address, repayAmount);
        await uToken.connect(bob).repayBorrowBehalf(alice.address, repayAmount);
        borrowed = await uToken.borrowBalanceView(alice.address);
        borrowed.toString().should.eq("0");
    });

    it("Repay borrow with permit", async () => {
        await uToken.connect(alice).borrow(ethers.utils.parseEther("1"));
        let borrowed = await uToken.borrowBalanceView(alice.address);
        borrowed.toString().should.not.eq("0");
        const repayAmount = borrowed.add(ethers.utils.parseEther("0.001")); //In order to repay cleanly and avoid the interest incurred when repaying
        await erc20.connect(alice).approve(uToken.address, repayAmount);

        const result = await signDaiPermit(
            waffle.provider._hardhatNetwork.provider,
            {
                name: "Dai Stablecoin",
                version: "1",
                chainId: "31337",
                verifyingContract: erc20.address
            },
            alice.address,
            uToken.address
        );

        await uToken
            .connect(alice)
            .repayBorrowWithPermit(
                alice.address,
                repayAmount,
                result.nonce,
                result.expiry,
                result.v,
                result.r,
                result.s
            );

        borrowed = await uToken.borrowBalanceView(alice.address);
        borrowed.toString().should.eq("0");
    });

    it("Mint uToken and calc uToken balance of underlying", async () => {
        const WAD = ethers.utils.parseEther("1");
        const borrowAmount = ethers.utils.parseEther("1");
        let exchangeRate = await uToken.exchangeRateStored();
        exchangeRate.toString().should.eq(initialExchangeRateMantissa.toString());
        const mintAmount = ethers.utils.parseEther("1");
        await erc20.connect(alice).approve(uToken.address, mintAmount);
        await uToken.connect(alice).mint(mintAmount);

        let totalRedeemable = await uToken.totalRedeemable();
        totalRedeemable.toString().should.eq(mintAmount.toString());
        let balance = await uErc20.balanceOf(alice.address);
        let totalSupply = await uErc20.totalSupply();
        totalSupply.toString().should.eq(balance.toString());
        exchangeRate = await uToken.exchangeRateStored();
        balance.toString().should.eq(mintAmount.mul(WAD).div(exchangeRate).toString());

        await uToken.connect(alice).borrow(borrowAmount);
        await waitNBlocks(10);
        let borrowed = await uToken.borrowBalanceView(alice.address);
        borrowed.toString().should.not.eq("0");
        const repayAmount = borrowed.add(ethers.utils.parseEther("0.001")); //In order to repay cleanly and avoid the interest incurred when repaying
        await erc20.connect(alice).approve(uToken.address, repayAmount);
        const borrowFee = mintAmount.mul(originationFee).div(WAD);
        const interest = await uToken.calculatingInterest(alice.address);
        const oneBlockInterest = borrowAmount.add(borrowFee).mul(borrowInterestPerBlock).div(WAD);
        const toRedeemableInterest = interest
            .add(oneBlockInterest)
            .mul(ethers.utils.parseEther("1").sub(reserveFactorMantissa))
            .div(WAD); //repayBorrow will add one block, so you have to calculate the interest of one more block
        await uToken.connect(alice).repayBorrow(repayAmount);

        const expectedTotalReserves = totalRedeemable.add(toRedeemableInterest);
        const expectedExchangeRate = mintAmount.add(toRedeemableInterest).mul(WAD).div(totalSupply);
        totalRedeemable = await uToken.totalRedeemable();
        totalRedeemable.toString().should.eq(expectedTotalReserves.toString());

        exchangeRate = await uToken.exchangeRateStored();
        exchangeRate.toString().should.eq(expectedExchangeRate.toString());
    });

    it("Redeem and redeemUnderlying", async () => {
        const mintAmount = ethers.utils.parseEther("1");
        const borrowAmount = ethers.utils.parseEther("1");
        await erc20.connect(alice).approve(uToken.address, mintAmount);
        await uToken.connect(alice).mint(mintAmount);

        let uBalance = await uErc20.balanceOf(alice.address);
        let erc20Balance = await erc20.balanceOf(alice.address);
        uBalance.toString().should.eq(mintAmount.toString());
        await uToken.connect(alice).redeem(uBalance);
        uBalance = await uErc20.balanceOf(alice.address);
        let erc20BalanceAfter = await erc20.balanceOf(alice.address);
        uBalance.toString().should.eq("0");
        erc20BalanceAfter.toString().should.eq(erc20Balance.add(mintAmount).toString());

        await erc20.connect(alice).approve(uToken.address, mintAmount);
        await uToken.connect(alice).mint(mintAmount);

        //In order to make exchangeRate greater than 1
        await uToken.connect(alice).borrow(borrowAmount);
        await waitNBlocks(10);
        let borrowed = await uToken.borrowBalanceView(alice.address);
        borrowed.toString().should.not.eq("0");
        const repayAmount = borrowed.add(ethers.utils.parseEther("0.001")); //In order to repay cleanly and avoid the interest incurred when repaying
        await erc20.connect(alice).approve(uToken.address, repayAmount);
        await uToken.connect(alice).repayBorrow(repayAmount);

        uBalance = await uErc20.balanceOf(alice.address);
        erc20Balance = await erc20.balanceOf(alice.address);
        await uToken.connect(alice).redeemUnderlying(mintAmount);
        uBalance = await uErc20.balanceOf(alice.address);
        uBalance.toString().should.not.eq("0");
        erc20BalanceAfter = await erc20.balanceOf(alice.address);
        erc20BalanceAfter.toString().should.eq(erc20Balance.add(mintAmount).toString());
    });

    it("Add reserves and remove reserves", async () => {
        const WAD = ethers.utils.parseEther("1");
        const addReserveAmount = ethers.utils.parseEther("1");
        const borrowAmount = ethers.utils.parseEther("1");
        let totalReserves = await uToken.totalReserves();
        totalReserves.toString().should.eq("0");

        await erc20.connect(alice).approve(uToken.address, addReserveAmount);
        await uToken.connect(alice).addReserves(addReserveAmount);
        totalReserves = await uToken.totalReserves();
        totalReserves.toString().should.eq(addReserveAmount.toString());

        await uToken.connect(alice).borrow(borrowAmount);
        await waitNBlocks(10);
        let borrowed = await uToken.borrowBalanceView(alice.address);
        borrowed.toString().should.not.eq("0");
        const repayAmount = borrowed.add(ethers.utils.parseEther("0.001")); //In order to repay cleanly and avoid the interest incurred when repaying
        await erc20.connect(alice).approve(uToken.address, repayAmount);
        const borrowFee = addReserveAmount.mul(originationFee).div(WAD);
        const interest = await uToken.calculatingInterest(alice.address);
        const oneBlockInterest = borrowAmount.add(borrowFee).mul(borrowInterestPerBlock).div(WAD);
        const toReserveInterest = interest.add(oneBlockInterest).mul(reserveFactorMantissa).div(WAD); //repayBorrow will add one block, so you have to calculate the interest of one more block
        await uToken.connect(alice).repayBorrow(repayAmount);

        const expectedTotalReserves = addReserveAmount.add(borrowFee).add(toReserveInterest);
        totalReserves = await uToken.totalReserves();
        totalReserves.toString().should.eq(expectedTotalReserves.toString());

        await expect(uToken.connect(alice).removeReserves(alice.address, expectedTotalReserves)).to.be.revertedWith(
            "Controller: not admin"
        );

        const erc20BalanceBefore = await erc20.balanceOf(alice.address);
        await uToken.removeReserves(alice.address, expectedTotalReserves);
        const erc20BalanceAfter = await erc20.balanceOf(alice.address);
        erc20BalanceAfter.toString().should.eq(erc20BalanceBefore.add(expectedTotalReserves).toString());
    });

    it("Test pause", async () => {
        await uToken.pause();
        await expect(uToken.connect(alice).borrow(ethers.utils.parseEther("1"))).to.be.revertedWith(
            "Controller: paused"
        );
        await expect(uToken.connect(alice).borrow(ethers.utils.parseEther("1"))).to.be.revertedWith(
            "Controller: paused"
        );
        await expect(uToken.connect(alice).repayBorrow(ethers.utils.parseEther("1"))).to.be.revertedWith(
            "Controller: paused"
        );
        await expect(
            uToken.connect(bob).repayBorrowBehalf(alice.address, ethers.utils.parseEther("1"))
        ).to.be.revertedWith("Controller: paused");
        await expect(uToken.connect(alice).mint(ethers.utils.parseEther("1"))).to.be.revertedWith("Controller: paused");
        await expect(uToken.connect(alice).redeem(ethers.utils.parseEther("1"))).to.be.revertedWith(
            "Controller: paused"
        );
        await expect(uToken.connect(alice).redeemUnderlying(ethers.utils.parseEther("1"))).to.be.revertedWith(
            "Controller: paused"
        );
        await expect(uToken.connect(alice).addReserves(ethers.utils.parseEther("1"))).to.be.revertedWith(
            "Controller: paused"
        );
        await expect(uToken.removeReserves(alice.address, ethers.utils.parseEther("1"))).to.be.revertedWith(
            "Controller: paused"
        );
        await expect(uToken.connect(alice).updateOverdueInfo(alice.address)).to.be.revertedWith("Controller: paused");
    });

    it("Update overdue info", async () => {
        await uToken.updateOverdueInfo(alice.address);

        await uToken.connect(alice).borrow(ethers.utils.parseEther("1"));
        let isOverdue = await uToken.checkIsOverdue(alice.address);
        isOverdue.should.eq(false);

        // wait for the loan to be overdue
        await waitNBlocks(overdueBlocks + 1);

        isOverdue = await uToken.checkIsOverdue(alice.address);
        isOverdue.should.eq(true);

        // make sure the call goes thru
        await uToken.updateOverdueInfo(alice.address);
    });

    it("Batch update overdue infos", async () => {
        const amount = ethers.utils.parseEther("1000");

        // accredit bob first
        await userManager.addMember(bob.address);
        await userManager.connect(staker1).updateTrust(bob.address, amount);
        await userManager.connect(staker2).updateTrust(bob.address, amount);
        await userManager.connect(staker3).updateTrust(bob.address, amount);

        await uToken.batchUpdateOverdueInfos([alice.address, bob.address]);

        await uToken.connect(alice).borrow(ethers.utils.parseEther("1"));
        await uToken.connect(bob).borrow(ethers.utils.parseEther("1"));

        let isOverdue = await uToken.checkIsOverdue(alice.address);
        isOverdue.should.eq(false);
        isOverdue = await uToken.checkIsOverdue(bob.address);
        isOverdue.should.eq(false);

        // wait for the loan to be overdue
        await waitNBlocks(overdueBlocks + 1);

        isOverdue = await uToken.checkIsOverdue(alice.address);
        isOverdue.should.eq(true);

        isOverdue = await uToken.checkIsOverdue(bob.address);
        isOverdue.should.eq(true);

        // make sure the call goes thru
        await uToken.batchUpdateOverdueInfos([alice.address, bob.address]);
    });

    it("Admin should be able to send tx in which Bob permits Alice to spend tokens", async () => {
        const amount = ethers.utils.parseEther("1");
        const name = "uToken";
        const deadline = ethers.constants.MaxUint256;

        const result = await signERC2612Permit(
            waffle.provider._hardhatNetwork.provider,
            {
                name,
                version: "1",
                chainId: 31337,
                verifyingContract: uErc20.address
            },
            bob.address,
            alice.address,
            amount.toString()
        );

        await expect(uErc20.permit(bob.address, alice.address, amount, deadline, result.v, result.r, result.s))
            .to.emit(uErc20, "Approval")
            .withArgs(bob.address, alice.address, amount);
    });
});
